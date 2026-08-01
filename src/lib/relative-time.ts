// Date-only values (contract/closing dates, milestone due dates) are stored
// as UTC midnight representing a calendar day, not a specific moment in
// time — rendering them with the default locale formatter uses the
// browser's local timezone and silently shifts the day backward for
// anyone west of UTC. Format from the UTC components instead.
export function formatDateOnly(date: Date): string {
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()}`;
}

export function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / (60 * 1000));

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
