import "server-only";
import { prisma } from "@/lib/db.server";
import { formatRelativeTime } from "@/lib/relative-time";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

type DueInput = { lastContactedAt: Date | null; createdAt: Date };

function isDueForTouch(contact: DueInput, now: number): boolean {
  const reference = contact.lastContactedAt ?? contact.createdAt;
  return now - reference.getTime() > NINETY_DAYS_MS;
}

function buildReason(contact: DueInput): string {
  if (!contact.lastContactedAt) {
    return `Never touched since being added ${formatRelativeTime(contact.createdAt)}`;
  }
  return `Last touched ${formatRelativeTime(contact.lastContactedAt)}`;
}

/**
 * A contact is "due for a touch" if it's been more than 90 days (the
 * recommended default, tunable) since the last real contact — or since being
 * added, if never contacted at all.
 *
 * This is deliberately paced nurture, not urgency. Every other "needs
 * attention" query in this app (stale leads: 4h/24h, urgent milestones: 3 days)
 * targets same-day or same-week response; a past client going quiet for a
 * month is normal, not a problem. Same live-query-at-call-time shape as
 * getStaleLeads()/getUrgentMilestones() (no cron), but a completely different
 * order of magnitude and framing — see Phase 4 task list, 4B.
 */
export async function getContactsDueForTouch(agentId: string) {
  const now = Date.now();
  const contacts = await prisma.contact.findMany({
    where: { agentId },
    orderBy: { createdAt: "asc" },
  });

  return contacts
    .filter((contact) => isDueForTouch(contact, now))
    .map((contact) => ({ ...contact, reason: buildReason(contact) }));
}
