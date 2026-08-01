// Pure matching between a buyer's search criteria and a candidate home. Used
// two ways: to badge each tracked BuyerProperty as fitting the criteria or not,
// and to surface which of the agent's OWN active listings a buyer would like
// (Listing has no propertyType, so that check is simply skipped there).
//
// Philosophy: only known, violated criteria count against a match. A missing
// value on either side (unknown price, no bed preference) is never a mismatch —
// it just isn't evidence either way. A home with no failing criteria matches.

export type BuyerCriteria = {
  minPrice: number | null;
  maxPrice: number | null;
  minBeds: number | null;
  minBaths: number | null;
  propertyType: string | null;
};

export type PropertyForMatch = {
  price: number | null;
  beds: number | null;
  baths: number | null;
  propertyType?: string | null;
};

export type MatchResult = {
  matches: boolean;
  mismatches: string[];
};

const usd = (n: number) => `$${n.toLocaleString()}`;

export function evaluateMatch(criteria: BuyerCriteria, property: PropertyForMatch): MatchResult {
  const mismatches: string[] = [];

  if (property.price != null) {
    if (criteria.maxPrice != null && property.price > criteria.maxPrice) {
      mismatches.push(`Over budget (${usd(criteria.maxPrice)} max)`);
    } else if (criteria.minPrice != null && property.price < criteria.minPrice) {
      mismatches.push(`Below range (${usd(criteria.minPrice)} min)`);
    }
  }

  if (criteria.minBeds != null && property.beds != null && property.beds < criteria.minBeds) {
    mismatches.push(`Needs ${criteria.minBeds}+ beds`);
  }

  if (criteria.minBaths != null && property.baths != null && property.baths < criteria.minBaths) {
    mismatches.push(`Needs ${criteria.minBaths}+ baths`);
  }

  if (
    criteria.propertyType &&
    criteria.propertyType !== "any" &&
    property.propertyType &&
    property.propertyType !== criteria.propertyType
  ) {
    mismatches.push("Wrong property type");
  }

  return { matches: mismatches.length === 0, mismatches };
}

// True only when the buyer has expressed at least one criterion — an empty
// criteria set would "match" everything, which is noise, not a signal.
export function hasAnyCriteria(criteria: BuyerCriteria): boolean {
  return (
    criteria.minPrice != null ||
    criteria.maxPrice != null ||
    criteria.minBeds != null ||
    criteria.minBaths != null ||
    (criteria.propertyType != null && criteria.propertyType !== "any")
  );
}
