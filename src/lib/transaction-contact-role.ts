export const TRANSACTION_CONTACT_ROLES = ["lender", "title", "other_agent", "other"] as const;

export type TransactionContactRole = (typeof TRANSACTION_CONTACT_ROLES)[number];

export const TRANSACTION_CONTACT_ROLE_LABELS: Record<TransactionContactRole, string> = {
  lender: "Lender",
  title: "Title company",
  other_agent: "Other agent",
  other: "Other",
};

export function isTransactionContactRole(value: string): value is TransactionContactRole {
  return (TRANSACTION_CONTACT_ROLES as readonly string[]).includes(value);
}
