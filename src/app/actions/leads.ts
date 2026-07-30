"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal.server";
import { prisma } from "@/lib/db.server";
import { getAnthropicClient, isAnthropicConfigured, CLAUDE_MODEL } from "@/lib/anthropic.server";
import { getResendClient, isResendConfigured } from "@/lib/resend.server";
import { getTwilioClient, isTwilioConfigured } from "@/lib/twilio.server";
import { EMAIL_SYSTEM_PROMPT, buildEmailUserPrompt } from "@/lib/prompts/email";
import { extractJson } from "@/lib/extract-json";
import { isLeadStatus } from "@/lib/lead-status";

export type AddLeadState = { error?: string } | undefined;

export async function addLead(_prevState: AddLeadState, formData: FormData): Promise<AddLeadState> {
  const { agentId } = await verifySession();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const source = String(formData.get("source") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) {
    return { error: "Lead name is required." };
  }

  await prisma.lead.create({
    data: { agentId, name, email, phone, source, notes },
  });

  revalidatePath("/dashboard/leads");
  return undefined;
}

export async function deleteLead(leadId: string) {
  const { agentId } = await verifySession();
  await prisma.lead.deleteMany({ where: { id: leadId, agentId } });
  revalidatePath("/dashboard/leads");
}

export async function updateLeadStatus(leadId: string, status: string) {
  const { agentId } = await verifySession();

  if (!isLeadStatus(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  await prisma.lead.updateMany({ where: { id: leadId, agentId }, data: { status } });
  revalidatePath("/dashboard/leads");
}

export async function draftEmail(leadId: string) {
  const { agentId } = await verifySession();

  if (!isAnthropicConfigured()) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const [lead, agent] = await Promise.all([
    prisma.lead.findFirstOrThrow({ where: { id: leadId, agentId } }),
    prisma.agent.findUniqueOrThrow({ where: { id: agentId } }),
  ]);

  const client = getAnthropicClient();
  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 800,
    system: EMAIL_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildEmailUserPrompt({
          leadName: lead.name,
          source: lead.source,
          notes: lead.notes,
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

  await prisma.emailLog.create({
    data: { leadId, subject: parsed.subject, body: parsed.body, status: "draft" },
  });

  revalidatePath("/dashboard/leads");
}

export async function sendEmail(emailLogId: string) {
  const { agentId } = await verifySession();

  if (!isResendConfigured()) {
    throw new Error("RESEND_API_KEY / RESEND_FROM_EMAIL are not set");
  }

  const emailLog = await prisma.emailLog.findFirstOrThrow({
    where: { id: emailLogId, lead: { agentId } },
    include: { lead: true },
  });

  if (!emailLog.lead.email) {
    throw new Error("This lead has no email address on file");
  }

  const resend = getResendClient();
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: emailLog.lead.email,
    subject: emailLog.subject,
    text: emailLog.body,
  });

  const sentAt = new Date();
  await prisma.$transaction([
    prisma.emailLog.update({ where: { id: emailLogId }, data: { status: "sent", sentAt } }),
    // A manual send is the agent actually acting on the lead — resets the staleness
    // clock. The automatic instant-ack auto-send does NOT do this (see instant-ack.server.ts) —
    // that's unsupervised boilerplate, not real contact.
    prisma.lead.update({ where: { id: emailLog.leadId }, data: { lastContactedAt: sentAt } }),
  ]);

  revalidatePath("/dashboard/leads");
}

export async function sendText(textLogId: string) {
  const { agentId } = await verifySession();

  if (!isTwilioConfigured()) {
    throw new Error("Twilio is not configured");
  }

  const textLog = await prisma.textLog.findFirstOrThrow({
    where: { id: textLogId, lead: { agentId } },
    include: { lead: true },
  });

  if (!textLog.lead.phone) {
    throw new Error("This lead has no phone number on file");
  }

  const client = getTwilioClient();
  await client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    to: textLog.lead.phone,
    body: textLog.body,
  });

  const sentAt = new Date();
  await prisma.$transaction([
    prisma.textLog.update({ where: { id: textLogId }, data: { status: "sent", sentAt } }),
    prisma.lead.update({ where: { id: textLog.leadId }, data: { lastContactedAt: sentAt } }),
  ]);

  revalidatePath("/dashboard/leads");
}

export async function logInteraction(leadId: string, note: string) {
  const { agentId } = await verifySession();

  const trimmed = note.trim();
  if (!trimmed) {
    throw new Error("Note can't be empty");
  }

  const lead = await prisma.lead.findFirstOrThrow({ where: { id: leadId, agentId } });

  const loggedAt = new Date();
  await prisma.$transaction([
    prisma.interaction.create({ data: { leadId: lead.id, note: trimmed, createdAt: loggedAt } }),
    // A logged touch (a call, an in-person chat, anything) is real contact just
    // like a manual sendEmail/sendText — resets the same staleness clock.
    prisma.lead.update({ where: { id: lead.id }, data: { lastContactedAt: loggedAt } }),
  ]);

  revalidatePath("/dashboard/leads");
}

export async function setAutoAckEnabled(enabled: boolean) {
  const { agentId } = await verifySession();
  await prisma.agent.update({ where: { id: agentId }, data: { autoAckEnabled: enabled } });
  revalidatePath("/dashboard/leads");
}
