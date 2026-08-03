import { verifySession } from "@/lib/dal.server";
import { prisma } from "@/lib/db.server";
import { isAnthropicConfigured } from "@/lib/anthropic.server";
import { isResendConfigured } from "@/lib/resend.server";
import { isTwilioConfigured } from "@/lib/twilio.server";
import { getStaleLeadIds } from "@/lib/stale-leads.server";
import { isLeadStatus } from "@/lib/lead-status";
import { LeadForm } from "./lead-form";
import { LeadCard } from "./lead-card";
import { LeadFilters } from "./lead-filters";
import { WebsiteFormSetup } from "./website-form-setup";
import { InstantAckSetup } from "./instant-ack-setup";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { agentId } = await verifySession();
  const { status: rawStatus, q: rawQuery } = await searchParams;

  const status = rawStatus && isLeadStatus(rawStatus) ? rawStatus : undefined;
  const query = rawQuery?.trim() || undefined;

  const [leads, totalLeadCount, agent, staleLeadIds] = await Promise.all([
    prisma.lead.findMany({
      where: {
        agentId,
        ...(status ? { status } : {}),
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } },
                { phone: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        emailLogs: { orderBy: { createdAt: "desc" } },
        textLogs: { orderBy: { createdAt: "desc" } },
        interactions: { orderBy: { createdAt: "desc" } },
        transactions: { orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.lead.count({ where: { agentId } }),
    prisma.agent.findUniqueOrThrow({
      where: { id: agentId },
      select: { autoAckEnabled: true, googleRefreshToken: true },
    }),
    getStaleLeadIds(agentId),
  ]);

  const anthropicConfigured = isAnthropicConfigured();
  const resendConfigured = isResendConfigured();
  const twilioConfigured = isTwilioConfigured();
  // Only a truthiness check ever leaves this scope — the raw token itself
  // is never passed down to LeadCard (a client component).
  const googleConnected = Boolean(agent.googleRefreshToken);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-lg font-semibold text-teal-900">Leads & Email</h1>
        <p className="text-sm text-stone-500">Track leads and send AI-drafted follow-up emails.</p>
      </div>

      {staleLeadIds.size > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>{staleLeadIds.size}</strong>{" "}
          {staleLeadIds.size === 1 ? "lead is" : "leads are"} waiting on a follow-up — flagged
          below.
        </div>
      )}

      <WebsiteFormSetup />

      <InstantAckSetup
        autoAckEnabled={agent.autoAckEnabled}
        resendConfigured={resendConfigured}
        twilioConfigured={twilioConfigured}
      />

      <LeadForm />

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-teal-900">Leads</h2>
          {totalLeadCount > 0 && <LeadFilters currentStatus={status ?? ""} currentQuery={query ?? ""} />}
        </div>
        {leads.length === 0 ? (
          <p className="text-sm text-stone-400">
            {totalLeadCount === 0 ? "No leads yet." : "No leads match this filter."}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {leads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                anthropicConfigured={anthropicConfigured}
                resendConfigured={resendConfigured}
                twilioConfigured={twilioConfigured}
                isStale={staleLeadIds.has(lead.id)}
                googleConnected={googleConnected}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
