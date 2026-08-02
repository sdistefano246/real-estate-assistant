import "server-only";
import { prisma } from "@/lib/db.server";
import { getAppBaseUrl } from "@/lib/app-url.server";

// TikTok Content Posting API (photo mode) — auto-posts a listing's photo(s)
// as a TikTok photo post. Unlike Instagram/Facebook, TikTok has no static
// long-lived token option: this needs real per-agent OAuth (Login Kit), an
// access token that expires every 24h, and a refresh token that rotates on
// every use — both persisted on the Agent row and refreshed just-in-time
// before each publish (see ensureFreshAccessToken). Unaudited apps are also
// hard-restricted to SELF_ONLY posting until TikTok approves this app for
// public video.publish — see SETUP.md.

const API_BASE = "https://open.tiktokapis.com/v2";
const AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

export function isTiktokConfigured() {
  return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
}

export function isTiktokConnected(agent: { tiktokOpenId?: string | null }) {
  return Boolean(agent.tiktokOpenId);
}

function getRedirectUri(): string {
  const base = getAppBaseUrl();
  if (!base) throw new Error("Can't determine this app's URL for the TikTok redirect — set APP_URL.");
  return `${base}/api/tiktok/callback`;
}

export function getTiktokAuthorizeUrl(state: string): string {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) throw new Error("TIKTOK_CLIENT_KEY is not set");

  const params = new URLSearchParams({
    client_key: clientKey,
    scope: "video.publish",
    response_type: "code",
    redirect_uri: getRedirectUri(),
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

type TiktokTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  open_id?: string;
  error?: string;
  error_description?: string;
};

function requireAppCredentials() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) throw new Error("TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET are not set");
  return { clientKey, clientSecret };
}

export async function exchangeCodeForToken(code: string) {
  const { clientKey, clientSecret } = requireAppCredentials();

  const res = await fetch(`${API_BASE}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: getRedirectUri(),
    }),
  });
  const json = (await res.json()) as TiktokTokenResponse;
  if (!res.ok || !json.access_token || !json.refresh_token || !json.open_id) {
    throw new Error(`TikTok token exchange failed: ${json.error_description ?? json.error ?? res.statusText}`);
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in ?? 86400,
    openId: json.open_id,
  };
}

async function refreshAccessToken(refreshToken: string) {
  const { clientKey, clientSecret } = requireAppCredentials();

  const res = await fetch(`${API_BASE}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const json = (await res.json()) as TiktokTokenResponse;
  if (!res.ok || !json.access_token || !json.refresh_token) {
    throw new Error(`TikTok token refresh failed: ${json.error_description ?? json.error ?? res.statusText}`);
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in ?? 86400,
  };
}

// Returns a usable access token for the agent, refreshing first (and
// persisting the refresh — TikTok may rotate the refresh_token on every use,
// so the old one can't be reused) if the stored token is expired or close to
// it. Throws if the agent has never connected TikTok.
export async function ensureFreshAccessToken(agentId: string): Promise<string> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { tiktokAccessToken: true, tiktokRefreshToken: true, tiktokTokenExpiresAt: true },
  });
  if (!agent?.tiktokAccessToken || !agent.tiktokRefreshToken) {
    throw new Error("TikTok is not connected for this agent.");
  }

  const stillFresh =
    agent.tiktokTokenExpiresAt !== null &&
    agent.tiktokTokenExpiresAt.getTime() - TOKEN_REFRESH_MARGIN_MS > Date.now();
  if (stillFresh) return agent.tiktokAccessToken;

  const refreshed = await refreshAccessToken(agent.tiktokRefreshToken);
  await prisma.agent.update({
    where: { id: agentId },
    data: {
      tiktokAccessToken: refreshed.accessToken,
      tiktokRefreshToken: refreshed.refreshToken,
      tiktokTokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
    },
  });
  return refreshed.accessToken;
}

type TiktokApiError = { error?: { code?: string; message?: string; log_id?: string } };

// TikTok requires checking the creator's currently-allowed privacy levels
// immediately before every post. Prefers the most public option available;
// falls back to whatever TikTok actually offers (SELF_ONLY for an unaudited
// app) so this keeps working with no code change once the app passes
// TikTok's audit.
export async function getBestPrivacyLevel(accessToken: string): Promise<string> {
  const res = await fetch(`${API_BASE}/post/publish/creator_info/query/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
  });
  const json = (await res.json()) as TiktokApiError & { data?: { privacy_level_options?: string[] } };
  const options = json.data?.privacy_level_options;
  if (!res.ok || !options || options.length === 0) {
    throw new Error(`TikTok creator info lookup failed: ${json.error?.message ?? res.statusText}`);
  }

  return options.find((option) => option === "PUBLIC_TO_EVERYONE") ?? options[0];
}

export async function publishToTiktok({
  accessToken,
  photoUrls,
  title,
  description,
  privacyLevel,
}: {
  accessToken: string;
  photoUrls: string[];
  title: string;
  description: string;
  privacyLevel: string;
}): Promise<string> {
  const res = await fetch(`${API_BASE}/post/publish/content/init/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({
      media_type: "PHOTO",
      post_mode: "DIRECT_POST",
      post_info: {
        title: title.slice(0, 90),
        description: description.slice(0, 4000),
        privacy_level: privacyLevel,
        disable_comment: false,
        auto_add_music: true,
        brand_content_toggle: false,
        brand_organic_toggle: false,
      },
      source_info: {
        source: "PULL_FROM_URL",
        photo_images: photoUrls.slice(0, 35),
        photo_cover_index: 0,
      },
    }),
  });
  const json = (await res.json()) as TiktokApiError & { data?: { publish_id?: string } };
  if (!res.ok || !json.data?.publish_id) {
    throw new Error(`TikTok publish failed: ${json.error?.message ?? res.statusText}`);
  }

  return json.data.publish_id;
}
