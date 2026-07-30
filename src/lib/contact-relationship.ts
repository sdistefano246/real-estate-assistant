export const CONTACT_RELATIONSHIPS = ["past_client", "friend", "family", "referral_source", "other"] as const;

export type ContactRelationship = (typeof CONTACT_RELATIONSHIPS)[number];

export const CONTACT_RELATIONSHIP_LABELS: Record<ContactRelationship, string> = {
  past_client: "Past client",
  friend: "Friend",
  family: "Family",
  referral_source: "Referral source",
  other: "Other",
};

export function isContactRelationship(value: string): value is ContactRelationship {
  return (CONTACT_RELATIONSHIPS as readonly string[]).includes(value);
}
