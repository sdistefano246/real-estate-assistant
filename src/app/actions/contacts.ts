"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal.server";
import { prisma } from "@/lib/db.server";
import { isContactRelationship } from "@/lib/contact-relationship";
import { isAnthropicConfigured } from "@/lib/anthropic.server";
import { getResendClient, isResendConfigured } from "@/lib/resend.server";
import { generateCheckIn } from "@/lib/check-in.server";

export type AddContactState = { error?: string } | undefined;

// Used both from a closed Transaction ("Add to sphere of influence", with
// transactionId set as a hidden field) and from a standalone "Add contact" form
// (transactionId omitted) — same validation either way, see Phase 4 task list, 4A.
export async function addContact(
  _prevState: AddContactState,
  formData: FormData
): Promise<AddContactState> {
  const { agentId } = await verifySession();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const relationship = String(formData.get("relationship") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const transactionId = String(formData.get("transactionId") ?? "").trim() || null;

  if (!name) {
    return { error: "Name is required." };
  }
  if (!isContactRelationship(relationship)) {
    return { error: "Pick a valid relationship." };
  }

  if (transactionId) {
    await prisma.transaction.findFirstOrThrow({ where: { id: transactionId, agentId } });
  }

  await prisma.contact.create({
    data: { agentId, transactionId, name, email, phone, relationship, notes },
  });

  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/sphere");
  return undefined;
}

function revalidateSpherePages() {
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/sphere");
}

export async function draftCheckIn(contactId: string) {
  const { agentId } = await verifySession();

  if (!isAnthropicConfigured()) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const [contact, agent] = await Promise.all([
    prisma.contact.findFirstOrThrow({ where: { id: contactId, agentId } }),
    prisma.agent.findUniqueOrThrow({ where: { id: agentId } }),
  ]);

  const parsed = await generateCheckIn(contact, agent);

  await prisma.checkInLog.create({
    data: { contactId: contact.id, subject: parsed.subject, body: parsed.body, status: "draft" },
  });

  revalidateSpherePages();
}

export async function sendCheckIn(checkInLogId: string) {
  const { agentId } = await verifySession();

  if (!isResendConfigured()) {
    throw new Error("RESEND_API_KEY / RESEND_FROM_EMAIL are not set");
  }

  const checkInLog = await prisma.checkInLog.findFirstOrThrow({
    where: { id: checkInLogId, contact: { agentId } },
    include: { contact: true },
  });

  if (!checkInLog.contact.email) {
    throw new Error("This contact has no email address on file");
  }

  const resend = getResendClient();
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: checkInLog.contact.email,
    subject: checkInLog.subject,
    text: checkInLog.body,
  });

  const sentAt = new Date();
  await prisma.$transaction([
    prisma.checkInLog.update({ where: { id: checkInLogId }, data: { status: "sent", sentAt } }),
    // Resets the 90-day cadence clock from 4B — a sent check-in is the actual
    // "touch" that getContactsDueForTouch() cares about.
    prisma.contact.update({ where: { id: checkInLog.contactId }, data: { lastContactedAt: sentAt } }),
  ]);

  revalidateSpherePages();
}

export async function logContactTouch(contactId: string, note: string) {
  const { agentId } = await verifySession();

  const trimmed = note.trim();
  if (!trimmed) {
    throw new Error("Note can't be empty");
  }

  const contact = await prisma.contact.findFirstOrThrow({ where: { id: contactId, agentId } });

  const loggedAt = new Date();
  await prisma.$transaction([
    prisma.contactTouch.create({ data: { contactId: contact.id, note: trimmed, createdAt: loggedAt } }),
    prisma.contact.update({ where: { id: contact.id }, data: { lastContactedAt: loggedAt } }),
  ]);

  revalidateSpherePages();
}
