import "server-only";
import { prisma } from "@/lib/db.server";

// Day-of-year style comparison, deliberately ignoring birthdayYear (often
// absent from Google Contacts, and irrelevant to "how many days until this
// year's birthday" anyway). Wraps across year-end so a birthday on Jan 3
// still shows as "coming up" from late December. Uses UTC "today" — matches
// this app's existing date-only convention (see formatDateOnly in
// relative-time.ts) rather than the server's local timezone.
function daysUntilNextBirthday(month: number, day: number, now: Date): number {
  const todayUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let nextOccurrence = Date.UTC(now.getUTCFullYear(), month - 1, day);
  if (nextOccurrence < todayUtcMidnight) {
    nextOccurrence = Date.UTC(now.getUTCFullYear() + 1, month - 1, day);
  }
  return Math.round((nextOccurrence - todayUtcMidnight) / (24 * 60 * 60 * 1000));
}

export type UpcomingBirthday = {
  id: string;
  name: string;
  email: string | null;
  month: number;
  day: number;
  daysUntil: number;
};

/**
 * Sphere contacts whose next birthday falls within `windowDays` — sourced
 * from birthdayMonth/birthdayDay synced via syncBirthdaysFromGoogle. Same
 * "needs attention" shape as getStaleLeads/getContactsDueForTouch: a plain
 * computed query, no stored "reminder" model. Returns [] naturally (no
 * special-casing) when no Contact has a birthday set yet — the same
 * deploy-inert behavior every other widget in this app already has.
 */
export async function getUpcomingBirthdays(agentId: string, windowDays = 14): Promise<UpcomingBirthday[]> {
  const contacts = await prisma.contact.findMany({
    where: { agentId, birthdayMonth: { not: null }, birthdayDay: { not: null } },
    select: { id: true, name: true, email: true, birthdayMonth: true, birthdayDay: true },
  });

  const now = new Date();

  return contacts
    .map((contact) => ({
      id: contact.id,
      name: contact.name,
      email: contact.email,
      month: contact.birthdayMonth as number,
      day: contact.birthdayDay as number,
      daysUntil: daysUntilNextBirthday(contact.birthdayMonth as number, contact.birthdayDay as number, now),
    }))
    .filter((entry) => entry.daysUntil <= windowDays)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}
