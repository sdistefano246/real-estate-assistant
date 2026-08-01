"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal.server";
import { prisma } from "@/lib/db.server";
import { buildDefaultMilestones } from "@/lib/default-milestones";
import { getAnthropicClient, isAnthropicConfigured, CLAUDE_MODEL } from "@/lib/anthropic.server";
import { getResendClient, isResendConfigured } from "@/lib/resend.server";
import { CHASE_SYSTEM_PROMPT, buildChaseUserPrompt } from "@/lib/prompts/chase";
import { extractJson } from "@/lib/extract-json";
import { isTransactionContactRole } from "@/lib/transaction-contact-role";
import { isTransactionStatus } from "@/lib/transaction-status";

function revalidateTransactionPages() {
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/today");
}

function parseOptionalInt(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").replace(/[$,\s]/g, "");
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Commission rate is a percent (e.g. 2.5). Cap at 100 to reject fat-finger
// entries like "250"; a null clears it back to "use the assumed default".
function parseOptionalRate(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").replace(/[%,\s]/g, "");
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

export async function setTransactionFinancials(
  transactionId: string,
  salePrice: number | null,
  commissionRate: number | null
) {
  const { agentId } = await verifySession();

  const cleanPrice = salePrice != null && Number.isFinite(salePrice) && salePrice >= 0 ? Math.round(salePrice) : null;
  const cleanRate =
    commissionRate != null && Number.isFinite(commissionRate) && commissionRate >= 0 && commissionRate <= 100
      ? commissionRate
      : null;

  await prisma.transaction.updateMany({
    where: { id: transactionId, agentId },
    data: { salePrice: cleanPrice, commissionRate: cleanRate },
  });
  revalidateTransactionPages();
  revalidatePath("/dashboard/analytics");
}

export type ConvertToTransactionState = { error?: string } | undefined;

export async function convertToTransaction(
  leadId: string,
  _prevState: ConvertToTransactionState,
  formData: FormData
): Promise<ConvertToTransactionState> {
  const { agentId } = await verifySession();

  const propertyAddress = String(formData.get("propertyAddress") ?? "").trim();
  const side = String(formData.get("side") ?? "").trim();
  const contractDateRaw = String(formData.get("contractDate") ?? "").trim();
  const closingDateRaw = String(formData.get("closingDate") ?? "").trim();

  if (!propertyAddress) {
    return { error: "Property address is required." };
  }
  if (side !== "buyer" && side !== "seller") {
    return { error: "Pick buyer or seller." };
  }

  const contractDate = new Date(contractDateRaw);
  const closingDate = new Date(closingDateRaw);
  if (!contractDateRaw || isNaN(contractDate.getTime())) {
    return { error: "Contract date is required." };
  }
  if (!closingDateRaw || isNaN(closingDate.getTime())) {
    return { error: "Closing date is required." };
  }

  const salePrice = parseOptionalInt(formData.get("salePrice"));
  const commissionRate = parseOptionalRate(formData.get("commissionRate"));

  const lead = await prisma.lead.findFirstOrThrow({ where: { id: leadId, agentId } });

  await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        agentId,
        leadId: lead.id,
        propertyAddress,
        side,
        contractDate,
        closingDate,
        status: "active",
        salePrice,
        commissionRate,
      },
    });

    const milestones = buildDefaultMilestones(contractDate, closingDate);
    await tx.milestone.createMany({
      data: milestones.map((m) => ({ transactionId: transaction.id, label: m.label, dueDate: m.dueDate })),
    });

    await tx.lead.update({ where: { id: lead.id }, data: { status: "converted" } });
  });

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/analytics");
  return undefined;
}

export type AddTransactionContactState = { error?: string } | undefined;

export async function addTransactionContact(
  transactionId: string,
  _prevState: AddTransactionContactState,
  formData: FormData
): Promise<AddTransactionContactState> {
  const { agentId } = await verifySession();

  const role = String(formData.get("role") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!isTransactionContactRole(role)) {
    return { error: "Pick a valid role." };
  }
  if (!name) {
    return { error: "Name is required." };
  }
  if (!email) {
    return { error: "Email is required." };
  }

  await prisma.transaction.findFirstOrThrow({ where: { id: transactionId, agentId } });

  await prisma.transactionContact.create({ data: { transactionId, role, name, email } });

  revalidateTransactionPages();
  return undefined;
}

export async function draftChase(transactionContactId: string, whatIsNeeded: string) {
  const { agentId } = await verifySession();

  if (!isAnthropicConfigured()) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const [contact, agent] = await Promise.all([
    prisma.transactionContact.findFirstOrThrow({
      where: { id: transactionContactId, transaction: { agentId } },
      include: { transaction: true },
    }),
    prisma.agent.findUniqueOrThrow({ where: { id: agentId } }),
  ]);

  const client = getAnthropicClient();
  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 800,
    system: CHASE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildChaseUserPrompt({
          propertyAddress: contact.transaction.propertyAddress,
          contactName: contact.name,
          contactRole: contact.role,
          whatIsNeeded,
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

  await prisma.chaseLog.create({
    data: { transactionContactId: contact.id, subject: parsed.subject, body: parsed.body, status: "draft" },
  });

  revalidateTransactionPages();
}

export async function sendChase(chaseLogId: string) {
  const { agentId } = await verifySession();

  if (!isResendConfigured()) {
    throw new Error("RESEND_API_KEY / RESEND_FROM_EMAIL are not set");
  }

  const chaseLog = await prisma.chaseLog.findFirstOrThrow({
    where: { id: chaseLogId, transactionContact: { transaction: { agentId } } },
    include: { transactionContact: true },
  });

  const resend = getResendClient();
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: chaseLog.transactionContact.email,
    subject: chaseLog.subject,
    text: chaseLog.body,
  });

  await prisma.chaseLog.update({
    where: { id: chaseLogId },
    data: { status: "sent", sentAt: new Date() },
  });

  revalidateTransactionPages();
}

export async function updateTransactionStatus(transactionId: string, status: string) {
  const { agentId } = await verifySession();

  if (!isTransactionStatus(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  await prisma.transaction.updateMany({ where: { id: transactionId, agentId }, data: { status } });
  revalidateTransactionPages();
}

export async function toggleMilestoneComplete(milestoneId: string, completed: boolean) {
  const { agentId } = await verifySession();

  await prisma.milestone.updateMany({
    where: { id: milestoneId, transaction: { agentId } },
    data: { completed },
  });

  revalidateTransactionPages();
}

export async function addMilestone(transactionId: string, label: string, dueDate: string) {
  const { agentId } = await verifySession();

  const trimmedLabel = label.trim();
  if (!trimmedLabel) {
    throw new Error("Label can't be empty");
  }
  const parsedDate = new Date(dueDate);
  if (isNaN(parsedDate.getTime())) {
    throw new Error("Invalid due date");
  }

  await prisma.transaction.findFirstOrThrow({ where: { id: transactionId, agentId } });

  await prisma.milestone.create({ data: { transactionId, label: trimmedLabel, dueDate: parsedDate } });
  revalidateTransactionPages();
}

export async function deleteMilestone(milestoneId: string) {
  const { agentId } = await verifySession();
  await prisma.milestone.deleteMany({ where: { id: milestoneId, transaction: { agentId } } });
  revalidateTransactionPages();
}
