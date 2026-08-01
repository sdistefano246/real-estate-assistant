// Shared commission math, importable from both client and server (no
// "server-only" here). commissionRate is stored as a percent (2.5 = 2.5%).

export const ASSUMED_COMMISSION_RATE = 0.025; // fraction
export const ASSUMED_COMMISSION_PERCENT = ASSUMED_COMMISSION_RATE * 100;

/**
 * Gross commission for one deal side: salePrice × rate. Falls back to the
 * assumed default rate when none was entered, so a price with no rate still
 * yields a number (flag it with usedAssumedRate to caveat the total). Returns
 * null only when there's no sale price at all.
 */
export function computeGci(salePrice: number | null, commissionRatePercent: number | null): number | null {
  if (salePrice == null) return null;
  const percent = commissionRatePercent != null ? commissionRatePercent : ASSUMED_COMMISSION_PERCENT;
  return Math.round(salePrice * (percent / 100));
}

export function usedAssumedRate(salePrice: number | null, commissionRatePercent: number | null): boolean {
  return salePrice != null && commissionRatePercent == null;
}
