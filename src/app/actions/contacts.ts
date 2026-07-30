"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal.server";
import { prisma } from "@/lib/db.server";
import { isContactRelationship } from "@/lib/contact-relationship";
import { getAnthropicClient, isAnthropicConfigured, CLAUDE_MODEL } from "@/lib/anthropic.server";
import { getResendClient, isResendConfigured } from "@/lib/resend.server";
import { CHECK_IN_SYSTEM_PROMPT, buildCheckInUserPrompt } from "@/lib/prompts/check-in";
import { extractJson } from "@/lib/extract-json";

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

  const client = getAnthropicClient();
  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 600,
    system: CHECK_IN_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildCheckInUserPrompt({
          contactName: contact.name,
          relationship: contact.relationship,
          notes: contact.notes,
          businessName: agent.businessName,
        }),
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Generation failed — no text returned");
  }

  const parsed = extractJson<{ subject: string; body: string }>(textBlock.text);

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
