import "server-only";
import { prisma } from "@/lib/db.server";
import { getAnthropicClient, isAnthropicConfigured, CLAUDE_MODEL } from "@/lib/anthropic.server";
import { getResendClient, isResendConfigured } from "@/lib/resend.server";
import { getTwilioClient, isTwilioConfigured } from "@/lib/twilio.server";
import { extractJson } from "@/lib/extract-json";
import {
  INSTANT_ACK_EMAIL_SYSTEM_PROMPT,
  INSTANT_ACK_SMS_SYSTEM_PROMPT,
  buildInstantAckUserPrompt,
} from "@/lib/prompts/instant-ack";

type AckAgent = { businessName: string | null; autoAckEnabled: boolean };
type AckLead = { id: string; name: string; email: string | null; phone: string | null; source: string | null };

async function generateText(systemPrompt: string, userPrompt: string) {
  const client = getAnthropicClient();
  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 400,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Generation failed — no text returned");
  }
  return textBlock.text;
}

/**
 * Drafts (and, if the agent has opted in via autoAckEnabled, sends) an instant
 * first-touch acknowledgment for a brand-new inbound lead. Prefers email when
 * the lead left one; falls back to text only when no email was given, so a
 * lead never gets double-acknowledged. Never throws — a failure here must
 * never break the inbound-lead request itself, just log server-side.
 */
export async function sendInstantAck(agent: AckAgent, lead: AckLead) {
  if (!isAnthropicConfigured()) return;

  try {
    if (lead.email) {
      await ackViaEmail(agent, lead);
    } else if (lead.phone) {
      await ackViaText(agent, lead);
    }
  } catch (error) {
    console.error("Instant ack failed:", error);
  }
}

async function ackViaEmail(agent: AckAgent, lead: AckLead) {
  const userPrompt = buildInstantAckUserPrompt({
    leadName: lead.name,
    source: lead.source,
    businessName: agent.businessName,
  });
  const raw = await generateText(INSTANT_ACK_EMAIL_SYSTEM_PROMPT, userPrompt);
  const parsed = extractJson<{ subject: string; body: string }>(raw);

  const emailLog = await prisma.emailLog.create({
    data: { leadId: lead.id, kind: "instant_ack", subject: parsed.subject, body: parsed.body, status: "draft" },
  });

  if (agent.autoAckEnabled && isResendConfigured() && lead.email) {
    const resend = getResendClient();
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: lead.email,
      subject: parsed.subject,
      text: parsed.body,
    });
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: { status: "sent", sentAt: new Date() },
    });
  }
}

async function ackViaText(agent: AckAgent, lead: AckLead) {
  const userPrompt = buildInstantAckUserPrompt({
    leadName: lead.name,
    source: lead.source,
    businessName: agent.businessName,
  });
  const raw = await generateText(INSTANT_ACK_SMS_SYSTEM_PROMPT, userPrompt);
  const parsed = extractJson<{ body: string }>(raw);

  const textLog = await prisma.textLog.create({
    data: { leadId: lead.id, kind: "instant_ack", body: parsed.body, status: "draft" },
  });

  if (agent.autoAckEnabled && isTwilioConfigured() && lead.phone) {
    const client = getTwilioClient();
    await client.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: lead.phone,
      body: parsed.body,
    });
    await prisma.textLog.update({
      where: { id: textLog.id },
      data: { status: "sent", sentAt: new Date() },
    });
  }
}
