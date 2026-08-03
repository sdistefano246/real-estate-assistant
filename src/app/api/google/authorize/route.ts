import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal.server";
import { getGoogleAuthorizeUrl } from "@/lib/google.server";

export const dynamic = "force-dynamic";

const STATE_COOKIE_NAME = "google_oauth_state";
const STATE_COOKIE_MAX_AGE_SECONDS = 10 * 60;

// Kicks off the Google OAuth flow when the agent clicks "Connect Google" in
// Settings. verifySession() redirects to /login on its own if the agent
// isn't authenticated. The random state value is stored in a short-lived
// cookie so /api/google/callback can confirm the redirect actually came from
// this same browser session (CSRF protection) before trusting the code
// Google sends back — same pattern as /api/tiktok/authorize.
export async function GET() {
  await verifySession();

  const state = crypto.randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
  });

  return NextResponse.redirect(getGoogleAuthorizeUrl(state));
}
