import Link from "next/link";
import { verifySession } from "@/lib/dal.server";
import { isAnthropicConfigured } from "@/lib/anthropic.server";
import { isResendConfigured } from "@/lib/resend.server";
import { isTwilioConfigured } from "@/lib/twilio.server";
import { getStaleLeads } from "@/lib/stale-leads.server";
import { getUrgentMilestones } from "@/lib/urgent-milestones.server";
import { getUpcomingShowings } from "@/lib/upcoming-showings.server";
import { LeadCard } from "../leads/lead-card";
import { MilestoneRow } from "../transactions/milestone-row";

export default async function TodayPage() {
  const { agentId } = await verifySession();

  const [staleLeads, urgentMilestones, upcomingShowings] = await Promise.all([
    getStaleLeads(agentId),
    getUrgentMilestones(agentId),
    getUpcomingShowings(agentId),
  ]);

  const anthropicConfigured = isAnthropicConfigured();
  const resendConfigured = isResendConfigured();
  const twilioConfigured = isTwilioConfigured();

  const nothingToDo =
    staleLeads.length === 0 && urgentMilestones.length === 0 && upcomingShowings.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-lg font-semibold text-teal-900">Today</h1>
        <p className="text-sm text-stone-500">
          Who needs a follow-up right now, and which deadlines are close — and why. Draft a message
          from each lead below, review it, then send.
        </p>
      </div>

      {nothingToDo && (
        <p className="text-sm text-stone-400">
          Nothing waiting on you right now — every open lead has been contacted recently, no
          deadlines are close, and no showings are coming up.
        </p>
      )}

      {upcomingShowings.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-teal-900">Showings coming up</h2>
          <div className="flex flex-col gap-1.5">
            {upcomingShowings.map((showing) => {
              const isPast = showing.isPast;
              return (
                <Link
                  key={showing.id}
                  href="/dashboard/buyers"
                  className="flex items-center justify-between rounded-md border border-stone-200 bg-white px-4 py-2.5 text-sm hover:border-stone-300"
                >
                  <span className="text-teal-900">
                    {showing.address}
                    <span className="text-stone-400"> · {showing.buyer.name}</span>
                  </span>
                  <span className={isPast ? "text-xs font-medium text-amber-700" : "text-xs text-stone-500"}>
                    {isPast
                      ? "Awaiting feedback"
                      : showing.scheduledAt.toLocaleString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {urgentMilestones.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-teal-900">Deadlines coming up</h2>
          <div className="flex flex-col gap-1.5">
            {urgentMilestones.map((milestone) => (
              <MilestoneRow
                key={milestone.id}
                milestone={milestone}
                propertyAddress={milestone.transaction.propertyAddress}
              />
            ))}
          </div>
        </div>
      )}

      {staleLeads.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-teal-900">Leads waiting on you</h2>
          <div className="flex flex-col gap-4">
            {staleLeads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                anthropicConfigured={anthropicConfigured}
                resendConfigured={resendConfigured}
                twilioConfigured={twilioConfigured}
                isStale
                reason={lead.reason}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
