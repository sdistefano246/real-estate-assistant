import "server-only";

/**
 * Best-effort public base URL for building links inside emails sent from
 * background jobs (the daily digest), where there's no incoming request to read
 * the host from. Checks an explicit override first, then the host Vercel injects
 * for the production deployment. Returns null when nothing is known — callers
 * omit links rather than emit a broken relative one.
 */
export function getAppBaseUrl(): string | null {
  const explicit = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercelHost) {
    return `https://${vercelHost.replace(/\/+$/, "")}`;
  }

  return null;
}
