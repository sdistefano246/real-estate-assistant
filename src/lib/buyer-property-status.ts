export const BUYER_PROPERTY_STATUSES = [
  "considering",
  "showing_scheduled",
  "toured",
  "rejected",
  "offer_made",
] as const;

export type BuyerPropertyStatus = (typeof BUYER_PROPERTY_STATUSES)[number];

export const BUYER_PROPERTY_STATUS_LABELS: Record<BuyerPropertyStatus, string> = {
  considering: "Considering",
  showing_scheduled: "Showing scheduled",
  toured: "Toured",
  rejected: "Passed",
  offer_made: "Offer made",
};

export function isBuyerPropertyStatus(value: string): value is BuyerPropertyStatus {
  return (BUYER_PROPERTY_STATUSES as readonly string[]).includes(value);
}
