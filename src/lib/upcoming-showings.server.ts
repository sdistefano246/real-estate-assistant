import "server-only";
import { prisma } from "@/lib/db.server";

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Showings that "need attention": not yet marked complete and scheduled within
 * the next 2 days — including any already past their time but never closed out,
 * so a tour that happened yesterday still nags for its feedback. Mirrors the
 * shape of getUrgentMilestones (live query at call time, tight window) and feeds
 * the same Overview / Today "needs attention" surfaces.
 */
export async function getUpcomingShowings(agentId: string) {
  const now = Date.now();
  const cutoff = new Date(now + TWO_DAYS_MS);

  const showings = await prisma.showing.findMany({
    where: {
      completed: false,
      scheduledAt: { lte: cutoff },
      buyer: { agentId },
    },
    orderBy: { scheduledAt: "asc" },
    include: { buyer: { select: { id: true, name: true } } },
  });

  // Flag past-but-not-closed showings here (a non-component module) so the
  // component surfaces don't have to call Date.now() during render.
  return showings.map((showing) => ({
    ...showing,
    isPast: showing.scheduledAt.getTime() < now,
  }));
}
