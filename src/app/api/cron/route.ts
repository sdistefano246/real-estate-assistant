import { NextRequest } from "next/server";
import { runAutomation } from "@/lib/automation.server";

// DB reads + LLM calls + email sends every time — never prerender or cache this.
export const dynamic = "force-dynamic";
// Nurture generation + sends can outrun the default serverless budget; give the
// job room. Vercel caps this per plan, but asking for more is harmless below it.
export const maxDuration = 60;

/**
 * The scheduled push-automation endpoint (Phase 5). Vercel Cron hits this on the
 * schedule in vercel.json and, when CRON_SECRET is set, sends it as
 * `Authorization: Bearer <CRON_SECRET>` — so requiring that header both
 * authenticates the cron and slams the door on the public internet.
 *
 * No secret configured => the endpoint refuses to run rather than sit open.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { ok: false, error: "CRON_SECRET is not set — refusing to run an unauthenticated job." },
      { status: 503 }
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const results = await runAutomation();

  const summary = results.reduce(
    (acc, r) => ({
      agents: acc.agents + 1,
      digestsSent: acc.digestsSent + (r.digestSent ? 1 : 0),
      nurtureSent: acc.nurtureSent + r.nurtureSent,
      errors: acc.errors + r.errors.length,
    }),
    { agents: 0, digestsSent: 0, nurtureSent: 0, errors: 0 }
  );

  return Response.json({ ok: true, ...summary, results });
}
