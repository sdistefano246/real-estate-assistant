import { verifySession } from "@/lib/dal.server";
import { prisma } from "@/lib/db.server";
import { isAnthropicConfigured } from "@/lib/anthropic.server";
import { isResendConfigured } from "@/lib/resend.server";
import { getContactsDueForTouch } from "@/lib/contacts-due.server";
import { ContactCard } from "./contact-card";
import { AddContactForm } from "./add-contact-form";

export default async function SpherePage() {
  const { agentId } = await verifySession();

  const [contacts, dueContacts, agent] = await Promise.all([
    prisma.contact.findMany({
      where: { agentId },
      orderBy: { createdAt: "desc" },
      include: {
        checkInLogs: { orderBy: { createdAt: "desc" } },
        contactTouches: { orderBy: { createdAt: "desc" } },
      },
    }),
    getContactsDueForTouch(agentId),
    prisma.agent.findUniqueOrThrow({ where: { id: agentId }, select: { googleRefreshToken: true } }),
  ]);

  const dueMap = new Map(dueContacts.map((c) => [c.id, c.reason]));

  const anthropicConfigured = isAnthropicConfigured();
  const resendConfigured = isResendConfigured();
  // Only a truthiness check ever leaves this scope — the raw token itself is
  // never passed down to ContactCard (a client component).
  const googleConnected = Boolean(agent.googleRefreshToken);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-lg font-semibold text-teal-900">Sphere of Influence</h1>
        <p className="text-sm text-stone-500">
          Past clients, friends, family, and referral sources — nurtured on a slow, steady
          cadence, not urgency. A gap of a few months is normal, not an emergency.
        </p>
      </div>

      {dueContacts.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>{dueContacts.length}</strong>{" "}
          {dueContacts.length === 1 ? "contact is" : "contacts are"} due for a check-in — flagged
          below.
        </div>
      )}

      <AddContactForm />

      {contacts.length === 0 ? (
        <p className="text-sm text-stone-400">
          No contacts yet — add one above, or convert a closed transaction from the Transactions
          page.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {contacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              anthropicConfigured={anthropicConfigured}
              resendConfigured={resendConfigured}
              isDue={dueMap.has(contact.id)}
              reason={dueMap.get(contact.id)}
              googleConnected={googleConnected}
            />
          ))}
        </div>
      )}
    </div>
  );
}
