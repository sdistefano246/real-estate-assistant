import "server-only";
import { prisma } from "@/lib/db.server";

/**
 * All of an agent's buyers with their candidate properties and showings, newest
 * buyer first. Each showing is flagged isPast here (a non-component module) so
 * the buyer cards never call Date.now() during render.
 */
export async function getBuyersWithSearch(agentId: string) {
  const now = Date.now();

  const buyers = await prisma.buyer.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" },
    include: {
      properties: { orderBy: { createdAt: "desc" } },
      showings: { orderBy: { scheduledAt: "asc" } },
    },
  });

  return buyers.map((buyer) => ({
    ...buyer,
    showings: buyer.showings.map((showing) => ({
      ...showing,
      isPast: showing.scheduledAt.getTime() < now,
    })),
  }));
}
