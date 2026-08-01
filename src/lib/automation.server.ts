import "server-only";
import { prisma } from "@/lib/db.server";
import { isAnthropicConfigured } from "@/lib/anthropic.server";
import { getResendClient, isResendConfigured } from "@/lib/resend.server";
import { generateCheckIn } from "@/lib/check-in.server";
import { getStaleLeads } from "@/lib/stale-leads.server";
import { getUrgentMilestones } from "@/lib/urgent-milestones.server";
import { getContactsDueForTouch } from "@/lib/contacts-due.server";
import { getUpcomingShowings } from "@/lib/upcoming-showings.server";
import { getAppBaseUrl } from "@/lib/app-url.server";

// A single scheduled run should never blast an entire back-catalog of quiet
// contacts in one morning — that reads as spam and burns sending reputation.
// Cap auto-nurture at a handful per agent per run; the 90-day cadence means the
// rest simply roll to subsequent days.
const MAX_NURTURE_PER_RUN = 5;

type AutomationAgent = {
  id: string;
  email: string;
  name: string;
  businessName: string | null;
  dailyDigestEnabled: boolean;
  autoNurtureEnabled: boolean;
};

export type AgentAutomationResult = {
  agentId: string;
  nurtureSent: number;
  nurtureSkippedNoEmail: number;
  digestSent: boolean;
  errors: string[];
};

/**
 * The whole push-automation job, run on a schedule from /api/cron. For each
 * agent it first sends any due nurture check-ins (Phase 4 cadence, now
 * unsupervised for opted-in agents), then emails a "needs attention" digest.
 *
 * Nurture runs BEFORE the digest on purpose: a contact that just got an
 * automatic check-in is no longer "due", so it correctly drops off the digest's
 * manual to-do list instead of nagging the agent about something already handled.
 *
 * Per-agent work is isolated — one agent's failure (a bad API key, a Resend
 * outage) is caught and recorded, never aborting the run for everyone else.
 */
export async function runAutomation(): Promise<AgentAutomationResult[]> {
  const agents = await prisma.agent.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      businessName: true,
      dailyDigestEnabled: true,
      autoNurtureEnabled: true,
    },
  });

  const results: AgentAutomationResult[] = [];
  for (const agent of agents) {
    results.push(await runForAgent(agent));
  }
  return results;
}

async function runForAgent(agent: AutomationAgent): Promise<AgentAutomationResult> {
  const result: AgentAutomationResult = {
    agentId: agent.id,
    nurtureSent: 0,
    nurtureSkippedNoEmail: 0,
    digestSent: false,
    errors: [],
  };

  if (agent.autoNurtureEnabled) {
    try {
      const nurture = await runAutoNurture(agent);
      result.nurtureSent = nurture.sent;
      result.nurtureSkippedNoEmail = nurture.skippedNoEmail;
    } catch (error) {
      result.errors.push(`nurture: ${errorMessage(error)}`);
    }
  }

  if (agent.dailyDigestEnabled) {
    try {
      result.digestSent = await sendDailyDigest(agent);
    } catch (error) {
      result.errors.push(`digest: ${errorMessage(error)}`);
    }
  }

  return result;
}

// --- Auto-nurture --------------------------------------------------------

async function runAutoNurture(agent: AutomationAgent): Promise<{ sent: number; skippedNoEmail: number }> {
  // Auto-nurture actually *sends* email drafted by Claude — it needs both keys.
  // Without them there's nothing to do (the manual, review-first flow on the
  // Sphere page still works regardless).
  if (!isAnthropicConfigured() || !isResendConfigured()) {
    return { sent: 0, skippedNoEmail: 0 };
  }

  const dueContacts = await getContactsDueForTouch(agent.id);
  const withEmail = dueContacts.filter((contact) => contact.email);
  const skippedNoEmail = dueContacts.length - withEmail.length;

  const resend = getResendClient();
  let sent = 0;

  for (const contact of withEmail.slice(0, MAX_NURTURE_PER_RUN)) {
    const draft = await generateCheckIn(contact, agent);

    const log = await prisma.checkInLog.create({
      data: { contactId: contact.id, subject: draft.subject, body: draft.body, status: "draft" },
    });

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: contact.email!,
      subject: draft.subject,
      text: draft.body,
    });

    const sentAt = new Date();
    await prisma.$transaction([
      prisma.checkInLog.update({ where: { id: log.id }, data: { status: "sent", sentAt } }),
      // Same cadence reset the manual sendCheckIn() does — this counts as the
      // real touch getContactsDueForTouch() keys off, so the contact won't come
      // due again for another 90 days.
      prisma.contact.update({ where: { id: contact.id }, data: { lastContactedAt: sentAt } }),
    ]);

    sent += 1;
  }

  return { sent, skippedNoEmail };
}

// --- Daily digest --------------------------------------------------------

async function sendDailyDigest(agent: AutomationAgent): Promise<boolean> {
  const [staleLeads, urgentMilestones, dueContacts, upcomingShowings] = await Promise.all([
    getStaleLeads(agent.id),
    getUrgentMilestones(agent.id),
    getContactsDueForTouch(agent.id),
    getUpcomingShowings(agent.id),
  ]);

  // Nothing needs the agent today — don't send an empty "all clear" every
  // morning. Silence is the signal.
  if (
    staleLeads.length === 0 &&
    urgentMilestones.length === 0 &&
    dueContacts.length === 0 &&
    upcomingShowings.length === 0
  ) {
    return false;
  }

  // The digest is only useful if it can actually reach the agent's inbox.
  if (!isResendConfigured()) {
    return false;
  }

  const { subject, text, html } = buildDigestEmail({
    agentName: agent.name,
    staleLeads,
    urgentMilestones,
    dueContacts,
    upcomingShowings,
  });

  const resend = getResendClient();
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: agent.email,
    subject,
    text,
    html,
  });

  return true;
}

type DigestInput = {
  agentName: string;
  staleLeads: Awaited<ReturnType<typeof getStaleLeads>>;
  urgentMilestones: Awaited<ReturnType<typeof getUrgentMilestones>>;
  dueContacts: Awaited<ReturnType<typeof getContactsDueForTouch>>;
  upcomingShowings: Awaited<ReturnType<typeof getUpcomingShowings>>;
};

function buildDigestEmail(input: DigestInput): { subject: string; text: string; html: string } {
  const { agentName, staleLeads, urgentMilestones, dueContacts, upcomingShowings } = input;
  const baseUrl = getAppBaseUrl();
  const todayUrl = baseUrl ? `${baseUrl}/dashboard/today` : null;
  const buyersUrl = baseUrl ? `${baseUrl}/dashboard/buyers` : null;
  const sphereUrl = baseUrl ? `${baseUrl}/dashboard/sphere` : null;

  const total =
    staleLeads.length + urgentMilestones.length + dueContacts.length + upcomingShowings.length;
  const subject = `${total} thing${total === 1 ? "" : "s"} need you today`;

  const leadLines = staleLeads.map((lead) => `${lead.name} — ${lead.reason}`);
  const milestoneLines = urgentMilestones.map(
    (milestone) => `${milestone.label} — ${milestone.transaction.propertyAddress} (${milestoneDueLabel(milestone.dueDate)})`
  );
  const showingLines = upcomingShowings.map(
    (showing) => `${showing.address} — ${showing.buyer.name} (${showingWhenLabel(showing.scheduledAt)})`
  );
  const contactLines = dueContacts.map((contact) => `${contact.name} — ${contact.reason}`);

  const sections: DigestSectionData[] = [
    { title: "Leads waiting on a follow-up", lines: leadLines, href: todayUrl },
    { title: "Deadlines coming up", lines: milestoneLines, href: todayUrl },
    { title: "Showings coming up", lines: showingLines, href: buyersUrl },
    { title: "Sphere contacts due for a check-in", lines: contactLines, href: sphereUrl },
  ];

  return {
    subject,
    text: buildDigestText(agentName, sections),
    html: buildDigestHtml(agentName, sections),
  };
}

type DigestSectionData = { title: string; lines: string[]; href: string | null };

function buildDigestText(agentName: string, sections: DigestSectionData[]): string {
  const parts: string[] = [`Good morning ${firstName(agentName)},`, ""];

  for (const section of sections) {
    if (section.lines.length === 0) continue;
    parts.push(`${section.title} (${section.lines.length}):`);
    parts.push(...section.lines.map((line) => `  - ${line}`));
    if (section.href) parts.push(`  ${section.href}`);
    parts.push("");
  }

  return parts.join("\n");
}

function buildDigestHtml(agentName: string, sections: DigestSectionData[]): string {
  const renderSection = ({ title, lines, href }: DigestSectionData) => {
    if (lines.length === 0) return "";
    const items = lines
      .map((line) => `<li style="margin: 0 0 6px; font-size: 14px; color: #1c1917;">${escapeHtml(line)}</li>`)
      .join("");
    const link = href
      ? `<p style="margin: 6px 0 0;"><a href="${href}" style="font-size: 13px; color: #0f766e;">Open in dashboard →</a></p>`
      : "";
    return `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #0f766e; margin: 0 0 8px;">${escapeHtml(title)} (${lines.length})</h2>
        <ul style="margin: 0; padding-left: 18px;">${items}</ul>
        ${link}
      </div>`;
  };

  return `<!doctype html>
<html>
  <body style="font-family: -apple-system, system-ui, sans-serif; max-width: 34rem; margin: 0 auto; padding: 24px; color: #1c1917;">
    <p style="font-size: 15px;">Good morning ${escapeHtml(firstName(agentName))},</p>
    <p style="font-size: 14px; color: #57534e;">Here's what needs you today.</p>
    ${sections.map(renderSection).join("")}
    <p style="font-size: 12px; color: #a8a29e; margin-top: 32px;">You're getting this because the daily digest is on. Turn it off from Settings in your dashboard.</p>
  </body>
</html>`;
}

// --- Small helpers -------------------------------------------------------

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function milestoneDueLabel(dueDate: Date): string {
  const diffDays = Math.round((dueDate.getTime() - Date.now()) / ONE_DAY_MS);
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "due today";
  if (diffDays === 1) return "due tomorrow";
  return `due in ${diffDays}d`;
}

function showingWhenLabel(scheduledAt: Date): string {
  if (scheduledAt.getTime() < Date.now()) return "awaiting feedback";
  return scheduledAt.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
