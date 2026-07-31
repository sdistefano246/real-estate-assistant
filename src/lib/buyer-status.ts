export const BUYER_STATUSES = ["active", "under_contract", "closed", "inactive"] as const;

export type BuyerStatus = (typeof BUYER_STATUSES)[number];

export const BUYER_STATUS_LABELS: Record<BuyerStatus, string> = {
  active: "Active search",
  under_contract: "Under contract",
  closed: "Closed",
  inactive: "Inactive",
};

export function isBuyerStatus(value: string): value is BuyerStatus {
  return (BUYER_STATUSES as readonly string[]).includes(value);
}
