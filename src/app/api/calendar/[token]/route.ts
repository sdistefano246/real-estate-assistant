import { getAgentIdByCalendarToken, buildAgentCalendar } from "@/lib/calendar.server";

// The feed reads live data every fetch and is authenticated only by the secret
// token in the URL — never prerender or cache it.
export const dynamic = "force-dynamic";

/**
 * A per-agent iCalendar subscription feed (RFC 5545). The unguessable token in
 * the path is the credential — calendar apps fetch subscription URLs with no
 * auth header, so there's nowhere else to put one. An unknown token is a flat
 * 404: it never reveals whether a token merely lacks events.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const agentId = await getAgentIdByCalendarToken(token);
  if (!agentId) {
    return new Response("Not found", { status: 404 });
  }

  const ics = await buildAgentCalendar(agentId);

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="real-estate-assistant.ics"',
      "Cache-Control": "no-store",
    },
  });
}
