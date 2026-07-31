import "server-only";
import { prisma } from "@/lib/db.server";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/lead-status";
import { BUYER_STATUSES, BUYER_STATUS_LABELS, type BuyerStatus } from "@/lib/buyer-status";
import { ASSUMED_COMMISSION_PERCENT, computeGci, usedAssumedRate } from "@/lib/commission";

const MONTHS_BACK = 6;
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type FunnelStage = { status: LeadStatus; label: string; count: number };
export type SourceRow = { source: string; total: number; converted: number; rate: number };
export type StatusCount = { key: string; label: string; count: number };
export type MonthBucket = { label: string; count: number };

export async function getAnalytics(agentId: string) {
  const [leads, transactions, buyers, listings, showingsCompleted, emailsSent, textsSent] =
    await Promise.all([
      prisma.lead.findMany({ where: { agentId }, select: { status: true, source: true, createdAt: true } }),
      prisma.transaction.findMany({
        where: { agentId },
        select: { status: true, side: true, salePrice: true, commissionRate: true },
      }),
      prisma.buyer.findMany({ where: { agentId }, select: { status: true, maxPrice: true } }),
      prisma.listing.findMany({ where: { agentId }, select: { price: true } }),
      prisma.showing.count({ where: { completed: true, buyer: { agentId } } }),
      prisma.emailLog.count({ where: { status: "sent", lead: { agentId } } }),
      prisma.textLog.count({ where: { status: "sent", lead: { agentId } } }),
    ]);

  // --- Lead funnel + conversion ---
  const leadCounts = countBy(leads, (l) => l.status);
  const funnel: FunnelStage[] = LEAD_STATUSES.map((status) => ({
    status,
    label: LEAD_STATUS_LABELS[status as LeadStatus],
    count: leadCounts.get(status) ?? 0,
  }));
  const totalLeads = leads.length;
  const convertedLeads = leadCounts.get("converted") ?? 0;
  const leadConversionRate = totalLeads > 0 ? convertedLeads / totalLeads : 0;

  // --- Source performance ---
  const sourceMap = new Map<string, { total: number; converted: number }>();
  for (const lead of leads) {
    const key = lead.source?.trim() || "Direct / unknown";
    const row = sourceMap.get(key) ?? { total: 0, converted: 0 };
    row.total += 1;
    if (lead.status === "converted") row.converted += 1;
    sourceMap.set(key, row);
  }
  const sources: SourceRow[] = [...sourceMap.entries()]
    .map(([source, { total, converted }]) => ({
      source,
      total,
      converted,
      rate: total > 0 ? converted / total : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // --- Transaction pipeline ---
  const txnCounts = countBy(transactions, (t) => t.status);
  const activeTxns = txnCounts.get("active") ?? 0;
  const closedTxns = txnCounts.get("closed") ?? 0;
  const fellThroughTxns = txnCounts.get("fell_through") ?? 0;
  const concluded = closedTxns + fellThroughTxns;
  const closeRate = concluded > 0 ? closedTxns / concluded : 0;
  const sideCounts = countBy(transactions, (t) => t.side);

  // --- Real GCI from transaction financials ---
  // Closed = commission earned on deals that closed; pipeline = commission at
  // stake on deals still active. Both only count transactions that actually have
  // a sale price entered; assumedRateUsed flags that at least one fell back to
  // the default commission rate (so the UI can caveat the number).
  let closedGci = 0;
  let pipelineGci = 0;
  let pricedClosed = 0;
  let pricedActive = 0;
  let assumedRateUsed = false;
  for (const t of transactions) {
    const gci = computeGci(t.salePrice, t.commissionRate);
    if (gci == null) continue;
    if (usedAssumedRate(t.salePrice, t.commissionRate)) assumedRateUsed = true;
    if (t.status === "closed") {
      closedGci += gci;
      pricedClosed += 1;
    } else if (t.status === "active") {
      pipelineGci += gci;
      pricedActive += 1;
    }
  }

  // --- Buyer pipeline ---
  const buyerCounts = countBy(buyers, (b) => b.status);
  const buyerPipeline: StatusCount[] = BUYER_STATUSES.map((status) => ({
    key: status,
    label: BUYER_STATUS_LABELS[status as BuyerStatus],
    count: buyerCounts.get(status) ?? 0,
  }));

  // --- Estimated pipeline value ---
  // Seller side: everything the agent has listed. Buyer side: the budget of each
  // buyer still actively searching (their max price). It's an estimate of value
  // under representation, not booked revenue.
  const listedValue = listings.reduce((sum, l) => sum + l.price, 0);
  const buyerBudgetValue = buyers
    .filter((b) => (b.status === "active" || b.status === "under_contract") && b.maxPrice != null)
    .reduce((sum, b) => sum + (b.maxPrice ?? 0), 0);
  const representedValue = listedValue + buyerBudgetValue;

  // --- New leads per month (last 6 months, oldest first) ---
  const activity: MonthBucket[] = buildMonthBuckets(leads.map((l) => l.createdAt));

  return {
    totals: {
      totalLeads,
      openLeads: (leadCounts.get("new") ?? 0) + (leadCounts.get("contacted") ?? 0) + (leadCounts.get("qualified") ?? 0),
      convertedLeads,
      activeTxns,
      closedTxns,
      emailsSent,
      textsSent,
      showingsCompleted,
    },
    funnel,
    leadConversionRate,
    sources,
    transactions: {
      active: activeTxns,
      closed: closedTxns,
      fellThrough: fellThroughTxns,
      closeRate,
      buyerSide: sideCounts.get("buyer") ?? 0,
      sellerSide: sideCounts.get("seller") ?? 0,
    },
    buyerPipeline,
    gci: {
      closedGci,
      pipelineGci,
      pricedClosed,
      pricedActive,
      assumedRateUsed,
      assumedRatePercent: ASSUMED_COMMISSION_PERCENT,
    },
    representedValue: {
      listedValue,
      buyerBudgetValue,
      total: representedValue,
    },
    activity,
  };
}

// --- helpers -------------------------------------------------------------

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

function buildMonthBuckets(dates: Date[]): MonthBucket[] {
  const now = new Date();
  const buckets: { label: string; year: number; month: number; count: number }[] = [];

  for (let i = MONTHS_BACK - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ label: MONTH_LABELS[d.getMonth()], year: d.getFullYear(), month: d.getMonth(), count: 0 });
  }

  for (const date of dates) {
    const bucket = buckets.find((b) => b.year === date.getFullYear() && b.month === date.getMonth());
    if (bucket) bucket.count += 1;
  }

  return buckets.map(({ label, count }) => ({ label, count }));
}
