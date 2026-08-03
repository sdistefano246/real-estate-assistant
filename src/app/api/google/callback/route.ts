import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal.server";
import { prisma } from "@/lib/db.server";
import { exchangeCodeForToken, fetchGoogleProfileEmail } from "@/lib/google.server";

export const dynamic = "force-dynamic";

const STATE_COOKIE_NAME = "google_oauth_state";

function settingsRedirect(request: Request, status: "connected" | "error") {
  return NextResponse.redirect(new URL(`/dashboard/settings?google=${status}`, request.url));
}

// Google redirects here after the agent approves (or denies) the connection
// request. Verifies the CSRF state, exchanges the authorization code for a
// real access/refresh token pair, and saves the connection on the agent's
// row — same shape as /api/tiktok/callback.
export async function GET(request: Request) {
  const { agentId } = await verifySession();

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE_NAME)?.value;
  cookieStore.delete(STATE_COOKIE_NAME);

  if (!code || !state || !expectedState || state !== expectedState) {
    return settingsRedirect(request, "error");
  }

  try {
    const { accessToken, refreshToken, expiresIn } = await exchangeCodeForToken(code);
    const email = await fetchGoogleProfileEmail(accessToken);
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        googleAccessToken: accessToken,
        // Google only re-issues a refresh_token on the first consent (or a
        // prompt=consent re-consent, which getGoogleAuthorizeUrl always
        // requests) — but if it's ever absent, don't null out a working one.
        ...(refreshToken ? { googleRefreshToken: refreshToken } : {}),
        googleTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        googleEmail: email,
      },
    });
    return settingsRedirect(request, "connected");
  } catch {
    return settingsRedirect(request, "error");
  }
}
