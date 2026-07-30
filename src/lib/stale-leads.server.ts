import "server-only";
import { prisma } from "@/lib/db.server";
import { formatRelativeTime } from "@/lib/relative-time";

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

type StalenessInput = { lastContactedAt: Date | null; createdAt: Date };

function isStale(lead: StalenessInput, now: number): boolean {
  if (!lead.lastContactedAt) {
    return now - lead.createdAt.getTime() > FOUR_HOURS_MS;
  }
  return now - lead.lastContactedAt.getTime() > TWENTY_FOUR_HOURS_MS;
}

function buildReason(lead: StalenessInput): string {
  if (!lead.lastContactedAt) {
    return `New lead, no reply yet — inquired ${formatRelativeTime(lead.createdAt)}`;
  }
  return `Contacted ${formatRelativeTime(lead.lastContactedAt)}, nothing since`;
}

/**
 * A lead is "stale" if it's still open (new/contacted, not qualified/closed) and:
 * - never contacted, and it's been more than 4 hours since it came in — the
 *   "lost the deal over a 6-hour reply gap" pain point this whole feature targets, or
 * - contacted at least once, but not again in the last 24 hours — still open,
 *   so it needs a follow-up, just held to a more forgiving threshold than the
 *   first touch.
 *
 * "Contacted" here means a manual sendEmail/sendText/logInteraction (see
 * actions/leads.ts) — the automatic instant-ack auto-send does NOT count, since
 * it's unsupervised boilerplate, not a real response to the lead.
 *
 * This is the single definition of "needs attention" — both the leads-page
 * banner/tag (1C) and the daily brief (2B) call this, not a second copy of it.
 */
export async function getStaleLeads(agentId: string) {
  const now = Date.now();
  const leads = await prisma.lead.findMany({
    where: { agentId, status: { in: ["new", "contacted"] } },
    orderBy: { createdAt: "asc" },
    include: {
      emailLogs: { orderBy: { createdAt: "desc" } },
      textLogs: { orderBy: { createdAt: "desc" } },
      interactions: { orderBy: { createdAt: "desc" } },
      transactions: { orderBy: { createdAt: "desc" } },
    },
  });

  return leads
    .filter((lead) => isStale(lead, now))
    .map((lead) => ({ ...lead, reason: buildReason(lead) }));
}

export async function getStaleLeadIds(agentId: string): Promise<Set<string>> {
  const stale = await getStaleLeads(agentId);
  return new Set(stale.map((lead) => lead.id));
}
