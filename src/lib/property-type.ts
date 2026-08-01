// Concrete property types a specific home can be. Buyer criteria additionally
// allow "any" (see PROPERTY_TYPE_CRITERIA_OPTIONS) to mean "no preference".
export const PROPERTY_TYPES = ["single_family", "condo", "townhouse", "multi_family"] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  single_family: "Single-family",
  condo: "Condo",
  townhouse: "Townhouse",
  multi_family: "Multi-family",
};

export function isPropertyType(value: string): value is PropertyType {
  return (PROPERTY_TYPES as readonly string[]).includes(value);
}

export function propertyTypeLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value === "any") return "Any type";
  return isPropertyType(value) ? PROPERTY_TYPE_LABELS[value] : value;
}
