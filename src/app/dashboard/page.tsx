import Link from "next/link";
import { verifySession } from "@/lib/dal.server";
import { prisma } from "@/lib/db.server";
import { getStaleLeads } from "@/lib/stale-leads.server";
import { getUrgentMilestones } from "@/lib/urgent-milestones.server";
import { getContactsDueForTouch } from "@/lib/contacts-due.server";
import { getUpcomingShowings } from "@/lib/upcoming-showings.server";

export default async function DashboardOverviewPage() {
  const { agentId } = await verifySession();

  const [
    listingCount,
    leadCount,
    callCount,
    transactionCount,
    contactCount,
    buyerCount,
    recentListings,
    recentLeads,
    recentTransactions,
    recentCalls,
    staleLeads,
    urgentMilestones,
    dueContacts,
    upcomingShowings,
  ] = await Promise.all([
    prisma.listing.count({ where: { agentId } }),
    prisma.lead.count({ where: { agentId } }),
    prisma.callLog.count({ where: { agentId } }),
    prisma.transaction.count({ where: { agentId } }),
    prisma.contact.count({ where: { agentId } }),
    prisma.buyer.count({ where: { agentId } }),
    prisma.listing.findMany({ where: { agentId }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.lead.findMany({ where: { agentId }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.transaction.findMany({ where: { agentId }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.callLog.findMany({ where: { agentId }, orderBy: { createdAt: "desc" }, take: 5 }),
    getStaleLeads(agentId),
    getUrgentMilestones(agentId),
    getContactsDueForTouch(agentId),
    getUpcomingShowings(agentId),
  ]);

  const nothingNeedsAttention =
    staleLeads.length === 0 &&
    urgentMilestones.length === 0 &&
    dueContacts.length === 0 &&
    upcomingShowings.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="mb-3 text-sm font-semibold text-teal-900">Needs your attention</h2>
        {nothingNeedsAttention ? (
          <p className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-400">
            Nothing needs you right now — every open lead has been contacted recently, no
            deadlines are close, and your sphere is up to date.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AttentionCard
              count={staleLeads.length}
              label={staleLeads.length === 1 ? "lead waiting on a follow-up" : "leads waiting on a follow-up"}
              href="/dashboard/today"
            />
            <AttentionCard
              count={urgentMilestones.length}
              label={urgentMilestones.length === 1 ? "deadline coming up" : "deadlines coming up"}
              href="/dashboard/today"
            />
            <AttentionCard
              count={upcomingShowings.length}
              label={upcomingShowings.length === 1 ? "showing coming up" : "showings coming up"}
              href="/dashboard/buyers"
            />
            <AttentionCard
              count={dueContacts.length}
              label={dueContacts.length === 1 ? "contact due for a check-in" : "contacts due for a check-in"}
              href="/dashboard/sphere"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Leads" value={leadCount} />
        <StatCard label="Buyers" value={buyerCount} />
        <StatCard label="Transactions" value={transactionCount} />
        <StatCard label="Sphere contacts" value={contactCount} />
        <StatCard label="Listings" value={listingCount} />
        <StatCard label="Calls logged" value={callCount} />
      </div>

      <Section title="Recent leads" href="/dashboard/leads" emptyText="No leads yet.">
        {recentLeads.map((lead) => (
          <Row key={lead.id} primary={lead.name} secondary={lead.email ?? lead.phone ?? ""} />
        ))}
      </Section>

      <Section title="Recent transactions" href="/dashboard/transactions" emptyText="No transactions yet.">
        {recentTransactions.map((transaction) => (
          <Row
            key={transaction.id}
            primary={transaction.propertyAddress}
            secondary={transaction.status === "active" ? "Active" : transaction.status === "closed" ? "Closed" : "Fell through"}
          />
        ))}
      </Section>

      <Section title="Recent listings" href="/dashboard/marketing" emptyText="No listings yet.">
        {recentListings.map((listing) => (
          <Row key={listing.id} primary={listing.address} secondary={`$${listing.price.toLocaleString()}`} />
        ))}
      </Section>

      <Section title="Recent calls" href="/dashboard/calls" emptyText="No calls logged yet.">
        {recentCalls.map((call) => (
          <Row
            key={call.id}
            primary={call.callerNumber}
            secondary={call.textSent ? "Text sent" : call.missed ? "Missed" : "Answered"}
          />
        ))}
      </Section>
    </div>
  );
}

function AttentionCard({ count, label, href }: { count: number; label: string; href: string }) {
  if (count === 0) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-4">
        <p className="text-2xl font-semibold text-stone-300">0</p>
        <p className="mt-1 text-xs text-stone-400">{label}</p>
      </div>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-lg border border-amber-300 bg-amber-50 p-4 transition hover:border-amber-400 hover:bg-amber-100"
    >
      <p className="text-2xl font-semibold text-amber-800">{count}</p>
      <p className="mt-1 text-xs font-medium text-amber-700">{label}</p>
    </Link>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-teal-900">{value}</p>
    </div>
  );
}

function Section({
  title,
  href,
  emptyText,
  children,
}: {
  title: string;
  href: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="rounded-lg border border-stone-200 bg-white">
      <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-teal-900">{title}</h2>
        <Link href={href} className="text-xs font-medium text-stone-500 hover:text-teal-900">
          View all
        </Link>
      </div>
      <div className="divide-y divide-stone-100">
        {hasChildren ? children : <p className="px-4 py-6 text-sm text-stone-400">{emptyText}</p>}
      </div>
    </div>
  );
}

function Row({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <p className="text-sm text-teal-900">{primary}</p>
      <p className="text-xs text-stone-500">{secondary}</p>
    </div>
  );
}
