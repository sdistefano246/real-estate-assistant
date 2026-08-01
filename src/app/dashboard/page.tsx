import Link from "next/link";
import { verifySession } from "@/lib/dal.server";
import { prisma } from "@/lib/db.server";
import { getStaleLeads } from "@/lib/stale-leads.server";
import { getUrgentMilestones } from "@/lib/urgent-milestones.server";
import { getContactsDueForTouch } from "@/lib/contacts-due.server";
import { getUpcomingShowings } from "@/lib/upcoming-showings.server";
import { EnvelopeIcon, SearchIcon, DocumentIcon, NetworkIcon, HomeIcon, PhoneIcon } from "./icons";
import type { ComponentType } from "react";

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
        <h1 className="text-lg font-semibold text-teal-900">Overview</h1>
        <p className="text-sm text-stone-500">Everything across your business, at a glance.</p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-teal-900">Needs your attention</h2>
        {nothingNeedsAttention ? (
          <p className="rounded-lg border border-stone-200 bg-white shadow-sm px-4 py-3 text-sm text-stone-400">
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
        <StatCard label="Leads" value={leadCount} icon={EnvelopeIcon} color="sky" />
        <StatCard label="Buyers" value={buyerCount} icon={SearchIcon} color="violet" />
        <StatCard label="Transactions" value={transactionCount} icon={DocumentIcon} color="emerald" />
        <StatCard label="Sphere contacts" value={contactCount} icon={NetworkIcon} color="fuchsia" />
        <StatCard label="Listings" value={listingCount} icon={HomeIcon} color="teal" />
        <StatCard label="Calls logged" value={callCount} icon={PhoneIcon} color="indigo" />
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
      <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <p className="text-2xl font-semibold text-stone-300">0</p>
        <p className="mt-1 text-xs text-stone-400">{label}</p>
      </div>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-sm transition hover:border-amber-400 hover:bg-amber-100 hover:shadow"
    >
      <p className="text-2xl font-semibold text-amber-800">{count}</p>
      <p className="mt-1 text-xs font-medium text-amber-700">{label}</p>
    </Link>
  );
}

// Fixed categorical order — each stat gets a distinct, consistent identity
// color, never reused for warning/destructive states (those stay amber/red).
const STAT_COLOR_STYLES = {
  sky: { badge: "bg-sky-100 text-sky-700" },
  violet: { badge: "bg-violet-100 text-violet-700" },
  emerald: { badge: "bg-emerald-100 text-emerald-700" },
  fuchsia: { badge: "bg-fuchsia-100 text-fuchsia-700" },
  teal: { badge: "bg-teal-100 text-teal-800" },
  indigo: { badge: "bg-indigo-100 text-indigo-700" },
} as const;

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  color: keyof typeof STAT_COLOR_STYLES;
}) {
  const styles = STAT_COLOR_STYLES[color];
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${styles.badge}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-2xl font-semibold text-teal-950">{value}</p>
      <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p>
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
    <div className="rounded-lg border border-stone-200 bg-white shadow-sm">
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
