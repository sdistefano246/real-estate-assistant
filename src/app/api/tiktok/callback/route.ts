import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal.server";
import { prisma } from "@/lib/db.server";
import { exchangeCodeForToken } from "@/lib/tiktok.server";

export const dynamic = "force-dynamic";

const STATE_COOKIE_NAME = "tiktok_oauth_state";

function settingsRedirect(request: Request, status: "connected" | "error") {
  return NextResponse.redirect(new URL(`/dashboard/settings?tiktok=${status}`, request.url));
}

// TikTok redirects here after the agent approves (or denies) the connection
// request. Verifies the CSRF state, exchanges the authorization code for a
// real access/refresh token pair, and saves the connection on the agent's row
// — see src/lib/tiktok.server.ts for why these tokens can't just live in an
// env var the way Instagram/Facebook's do.
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
    const { accessToken, refreshToken, expiresIn, openId } = await exchangeCodeForToken(code);
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        tiktokAccessToken: accessToken,
        tiktokRefreshToken: refreshToken,
        tiktokTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        tiktokOpenId: openId,
      },
    });
    return settingsRedirect(request, "connected");
  } catch {
    return settingsRedirect(request, "error");
  }
}
