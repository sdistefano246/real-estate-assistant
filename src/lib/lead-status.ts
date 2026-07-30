// "converted" means the lead became a real Transaction (see actions/transactions.ts) —
// kept distinct from "closed" (dead/lost) so the two are never ambiguous, per the
// decision in the Phase 3 task list.
export const LEAD_STATUSES = ["new", "contacted", "qualified", "converted", "closed"] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  converted: "Converted",
  closed: "Closed",
};

export function isLeadStatus(value: string): value is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(value);
}
