import "server-only";
import { prisma } from "@/lib/db.server";
import { fetchGoogleContactBirthdays } from "@/lib/google-contacts.server";

// Matches the agent's Google Contacts (with a birthday set) to this app's
// own Contact records purely by email — no fuzzy/name matching, no
// auto-creation of new Contacts from the agent's address book. A Contact
// with no email, or whose email isn't found in Google Contacts, is silently
// left alone (same "skip, don't guess" behavior every other integration in
// this app already has for unmatched/unconfigured state).
export async function syncBirthdaysFromGoogle(agentId: string): Promise<{ matched: number; updated: number }> {
  const googleBirthdays = await fetchGoogleContactBirthdays(agentId);
  const byEmail = new Map(googleBirthdays.map((entry) => [entry.email, entry]));

  const contacts = await prisma.contact.findMany({
    where: { agentId, email: { not: null } },
    select: { id: true, email: true, birthdayMonth: true, birthdayDay: true, birthdayYear: true, googleContactResourceName: true },
  });

  let matched = 0;
  let updated = 0;

  for (const contact of contacts) {
    const email = contact.email?.toLowerCase().trim();
    if (!email) continue;
    const birthday = byEmail.get(email);
    if (!birthday) continue;

    matched += 1;
    const changed =
      contact.birthdayMonth !== birthday.month ||
      contact.birthdayDay !== birthday.day ||
      contact.birthdayYear !== birthday.year ||
      contact.googleContactResourceName !== birthday.resourceName;
    if (!changed) continue;

    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        birthdayMonth: birthday.month,
        birthdayDay: birthday.day,
        birthdayYear: birthday.year,
        googleContactResourceName: birthday.resourceName,
      },
    });
    updated += 1;
  }

  await prisma.agent.update({
    where: { id: agentId },
    data: { googleContactsSyncedAt: new Date() },
  });

  return { matched, updated };
}
