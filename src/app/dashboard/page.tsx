import Link from "next/link";
import { verifySession } from "@/lib/dal.server";
import { prisma } from "@/lib/db.server";

export default async function DashboardOverviewPage() {
  const { agentId } = await verifySession();

  const [listingCount, leadCount, callCount, recentListings, recentLeads, recentCalls] =
    await Promise.all([
      prisma.listing.count({ where: { agentId } }),
      prisma.lead.count({ where: { agentId } }),
      prisma.callLog.count({ where: { agentId } }),
      prisma.listing.findMany({
        where: { agentId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.lead.findMany({
        where: { agentId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.callLog.findMany({
        where: { agentId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Listings" value={listingCount} />
        <StatCard label="Leads" value={leadCount} />
        <StatCard label="Calls logged" value={callCount} />
      </div>

      <Section title="Recent listings" href="/dashboard/marketing" emptyText="No listings yet.">
        {recentListings.map((listing) => (
          <Row key={listing.id} primary={listing.address} secondary={`$${listing.price.toLocaleString()}`} />
        ))}
      </Section>

      <Section title="Recent leads" href="/dashboard/leads" emptyText="No leads yet.">
        {recentLeads.map((lead) => (
          <Row key={lead.id} primary={lead.name} secondary={lead.email ?? lead.phone ?? ""} />
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
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
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <Link href={href} className="text-xs font-medium text-slate-500 hover:text-slate-900">
          View all
        </Link>
      </div>
      <div className="divide-y divide-slate-100">
        {hasChildren ? children : <p className="px-4 py-6 text-sm text-slate-400">{emptyText}</p>}
      </div>
    </div>
  );
}

function Row({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <p className="text-sm text-slate-900">{primary}</p>
      <p className="text-xs text-slate-500">{secondary}</p>
    </div>
  );
}
