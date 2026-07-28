/**
 * Claude sometimes wraps JSON output in markdown code fences (```json ... ```)
 * even when told not to. Strip them before parsing so generation doesn't
 * intermittently break.
 */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonText = fenced ? fenced[1] : text.trim();
  return JSON.parse(jsonText) as T;
}
