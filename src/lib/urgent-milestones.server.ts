import "server-only";
import { prisma } from "@/lib/db.server";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * A milestone "needs attention" if it isn't completed, its transaction is still
 * active (not closed/fell_through), and its due date is within 3 days — including
 * already overdue. 3 days is tighter than the lead-follow-up thresholds (4h/24h,
 * see stale-leads.server.ts) since a blown contractual deadline is a materially
 * bigger failure than a slow reply. Tunable, not locked — see Phase 3 task list, 3B.
 */
export async function getUrgentMilestones(agentId: string) {
  const now = Date.now();
  const cutoff = new Date(now + THREE_DAYS_MS);

  const milestones = await prisma.milestone.findMany({
    where: {
      completed: false,
      dueDate: { lte: cutoff },
      transaction: { agentId, status: "active" },
    },
    orderBy: { dueDate: "asc" },
    include: { transaction: true },
  });

  return milestones;
}
