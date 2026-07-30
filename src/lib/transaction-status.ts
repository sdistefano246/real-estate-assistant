export const TRANSACTION_STATUSES = ["active", "closed", "fell_through"] as const;

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  active: "Active",
  closed: "Closed",
  fell_through: "Fell through",
};

export function isTransactionStatus(value: string): value is TransactionStatus {
  return (TRANSACTION_STATUSES as readonly string[]).includes(value);
}
