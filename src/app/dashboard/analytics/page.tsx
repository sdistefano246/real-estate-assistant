import { verifySession } from "@/lib/dal.server";
import { getAnalytics } from "@/lib/analytics.server";

function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

function compactUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}

export default async function AnalyticsPage() {
  const { agentId } = await verifySession();
  const a = await getAnalytics(agentId);

  const funnelMax = Math.max(1, ...a.funnel.map((s) => s.count));
  const activityMax = Math.max(1, ...a.activity.map((m) => m.count));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-lg font-semibold text-teal-900">Reports</h1>
        <p className="text-sm text-stone-500">
          Your book of business at a glance — where leads come from, how they convert, and what&apos;s
          in the pipeline.
        </p>
      </div>

      {/* Headline tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Total leads" value={a.totals.totalLeads.toString()} sub={`${a.totals.openLeads} still open`} />
        <Tile label="Lead conversion" value={pct(a.leadConversionRate)} sub={`${a.totals.convertedLeads} converted`} />
        <Tile label="Active deals" value={a.totals.activeTxns.toString()} sub={`${a.totals.closedTxns} closed`} />
        <Tile label={`Est. GCI @ ${pct(a.pipeline.commissionRate)}`} value={compactUsd(a.pipeline.estimatedGci)} sub="rough estimate" />
      </div>

      {/* Pipeline value */}
      <Section title="Estimated pipeline value">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ValueCard label="Listed inventory (seller side)" value={compactUsd(a.pipeline.listedValue)} />
          <ValueCard label="Buyer budgets (active buyers)" value={compactUsd(a.pipeline.buyerBudgetValue)} />
          <ValueCard label="Total under representation" value={compactUsd(a.pipeline.pipelineValue)} highlight />
        </div>
        <p className="mt-3 text-xs text-stone-400">
          An estimate of value you&apos;re representing — listed homes plus the budgets of buyers still
          searching. The GCI figure applies an assumed {pct(a.pipeline.commissionRate)} commission and is a
          rough sense of gross potential, not booked revenue.
        </p>
      </Section>

      {/* Lead funnel */}
      <Section title="Lead funnel">
        <div className="flex flex-col gap-2">
          {a.funnel.map((stage) => (
            <div key={stage.status} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs text-stone-600">{stage.label}</span>
              <div className="h-6 flex-1 overflow-hidden rounded bg-stone-100">
                <div
                  className="flex h-full items-center rounded bg-teal-700 px-2"
                  style={{ width: `${Math.max((stage.count / funnelMax) * 100, stage.count > 0 ? 6 : 0)}%` }}
                >
                  {stage.count > 0 && <span className="text-[10px] font-medium text-white">{stage.count}</span>}
                </div>
              </div>
              {stage.count === 0 && <span className="text-xs text-stone-400">0</span>}
            </div>
          ))}
        </div>
      </Section>

      {/* Lead sources */}
      <Section title="Where leads come from">
        {a.sources.length === 0 ? (
          <p className="text-sm text-stone-400">No leads yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-stone-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50 text-left text-xs text-stone-500">
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 text-right font-medium">Leads</th>
                  <th className="px-4 py-2 text-right font-medium">Converted</th>
                  <th className="px-4 py-2 text-right font-medium">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {a.sources.map((row) => (
                  <tr key={row.source}>
                    <td className="px-4 py-2 text-teal-900">{row.source}</td>
                    <td className="px-4 py-2 text-right text-stone-600">{row.total}</td>
                    <td className="px-4 py-2 text-right text-stone-600">{row.converted}</td>
                    <td className="px-4 py-2 text-right font-medium text-teal-900">{pct(row.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Transaction pipeline */}
      <Section title="Transactions">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <ValueCard label="Active" value={a.transactions.active.toString()} />
          <ValueCard label="Closed" value={a.transactions.closed.toString()} />
          <ValueCard label="Fell through" value={a.transactions.fellThrough.toString()} />
          <ValueCard label="Close rate" value={pct(a.transactions.closeRate)} />
        </div>
        <p className="mt-3 text-xs text-stone-500">
          {a.transactions.buyerSide} buyer-side · {a.transactions.sellerSide} seller-side. Close rate is
          of concluded deals (closed vs. fell through).
        </p>
      </Section>

      {/* Buyer pipeline */}
      <Section title="Buyers">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {a.buyerPipeline.map((s) => (
            <ValueCard key={s.key} label={s.label} value={s.count.toString()} />
          ))}
        </div>
      </Section>

      {/* Activity */}
      <Section title="New leads per month">
        <div className="flex items-end gap-3">
          {a.activity.map((m) => (
            <div key={m.label} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs text-stone-500">{m.count}</span>
              <div className="flex h-24 w-full items-end">
                <div
                  className="w-full rounded-t bg-teal-600"
                  style={{ height: `${m.count > 0 ? Math.max((m.count / activityMax) * 100, 8) : 2}%` }}
                />
              </div>
              <span className="text-xs text-stone-400">{m.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-4 border-t border-stone-100 pt-4">
          <Counter label="Emails sent" value={a.totals.emailsSent} />
          <Counter label="Texts sent" value={a.totals.textsSent} />
          <Counter label="Showings completed" value={a.totals.showingsCompleted} />
        </div>
      </Section>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-teal-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-stone-400">{sub}</p>}
    </div>
  );
}

function ValueCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? "border-teal-200 bg-teal-50" : "border-stone-200 bg-white"}`}>
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${highlight ? "text-teal-800" : "text-teal-900"}`}>{value}</p>
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-lg font-semibold text-teal-900">{value}</p>
      <p className="text-xs text-stone-500">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-teal-900">{title}</h2>
      {children}
    </div>
  );
}
