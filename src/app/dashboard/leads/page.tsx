import { verifySession } from "@/lib/dal.server";
import { prisma } from "@/lib/db.server";
import { isAnthropicConfigured } from "@/lib/anthropic.server";
import { isResendConfigured } from "@/lib/resend.server";
import { LeadForm } from "./lead-form";
import { LeadCard } from "./lead-card";

export default async function LeadsPage() {
  const { agentId } = await verifySession();
  const leads = await prisma.lead.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" },
    include: { emailLogs: { orderBy: { createdAt: "desc" } } },
  });

  const anthropicConfigured = isAnthropicConfigured();
  const resendConfigured = isResendConfigured();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-lg font-semibold text-teal-900">Leads & Email</h1>
        <p className="text-sm text-stone-500">Track leads and send AI-drafted follow-up emails.</p>
      </div>

      <LeadForm />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-teal-900">Leads</h2>
        {leads.length === 0 ? (
          <p className="text-sm text-stone-400">No leads yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {leads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                anthropicConfigured={anthropicConfigured}
                resendConfigured={resendConfigured}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
