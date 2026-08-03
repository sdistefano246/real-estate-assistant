import "server-only";
import { prisma } from "@/lib/db.server";
import { getAppBaseUrl } from "@/lib/app-url.server";

// Google OAuth connection powering two read-only features: Google Contacts
// birthday sync (see google-contacts.server.ts / birthday-sync.server.ts) and
// on-demand Gmail thread history (see google-gmail.server.ts). Real per-agent
// OAuth, same shape as tiktok.server.ts — access token expires and is
// refreshed just-in-time via ensureFreshGoogleAccessToken, refresh token
// persisted on the Agent row. Unlike TikTok, Google doesn't rotate the
// refresh token on every use, so it's only ever overwritten when a token
// response actually includes a new one.

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/user.birthday.read",
].join(" ");
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function isGoogleConnected(agent: { googleRefreshToken?: string | null }) {
  return Boolean(agent.googleRefreshToken);
}

function getRedirectUri(): string {
  const base = getAppBaseUrl();
  if (!base) throw new Error("Can't determine this app's URL for the Google redirect — set APP_URL.");
  return `${base}/api/google/callback`;
}

function requireAppCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set");
  return { clientId, clientSecret };
}

export function getGoogleAuthorizeUrl(state: string): string {
  const { clientId } = requireAppCredentials();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    // Forces Google to re-issue a refresh_token even on a re-connect (by
    // default it's only returned on the very first consent) — without this,
    // disconnecting and reconnecting would silently leave no refresh token.
    prompt: "consent",
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

export async function exchangeCodeForToken(code: string) {
  const { clientId, clientSecret } = requireAppCredentials();

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: getRedirectUri(),
    }),
  });
  const json = (await res.json()) as GoogleTokenResponse;
  if (!res.ok || !json.access_token) {
    throw new Error(`Google token exchange failed: ${json.error_description ?? json.error ?? res.statusText}`);
  }

  return {
    accessToken: json.access_token,
    // null, not undefined, on a re-consent Google doesn't re-issue one for —
    // the callback route relies on this to know whether to preserve the
    // existing stored refresh token instead of clobbering it.
    refreshToken: json.refresh_token ?? null,
    expiresIn: json.expires_in ?? 3600,
    scope: json.scope ?? "",
  };
}

export async function fetchGoogleProfileEmail(accessToken: string): Promise<string> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json()) as { email?: string; error?: { message?: string } };
  if (!res.ok || !json.email) {
    throw new Error(`Google userinfo lookup failed: ${json.error?.message ?? res.statusText}`);
  }
  return json.email;
}

async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = requireAppCredentials();

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const json = (await res.json()) as GoogleTokenResponse;
  if (!res.ok || !json.access_token) {
    throw new Error(`Google token refresh failed: ${json.error_description ?? json.error ?? res.statusText}`);
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresIn: json.expires_in ?? 3600,
  };
}

// Returns a usable access token for the agent, refreshing first (and
// persisting the refresh) if the stored token is expired or close to it.
// Throws if the agent has never connected Google.
export async function ensureFreshGoogleAccessToken(agentId: string): Promise<string> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { googleAccessToken: true, googleRefreshToken: true, googleTokenExpiresAt: true },
  });
  if (!agent?.googleAccessToken || !agent.googleRefreshToken) {
    throw new Error("Google is not connected for this agent.");
  }

  const stillFresh =
    agent.googleTokenExpiresAt !== null &&
    agent.googleTokenExpiresAt.getTime() - TOKEN_REFRESH_MARGIN_MS > Date.now();
  if (stillFresh) return agent.googleAccessToken;

  const refreshed = await refreshAccessToken(agent.googleRefreshToken);
  await prisma.agent.update({
    where: { id: agentId },
    data: {
      googleAccessToken: refreshed.accessToken,
      // Only overwrite if Google actually sent a new one — refresh calls
      // don't reliably re-issue a refresh token.
      ...(refreshed.refreshToken ? { googleRefreshToken: refreshed.refreshToken } : {}),
      googleTokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
    },
  });
  return refreshed.accessToken;
}
