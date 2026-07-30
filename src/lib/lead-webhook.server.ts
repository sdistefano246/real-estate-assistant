import "server-only";
import { timingSafeEqual } from "crypto";

export function isLeadWebhookConfigured() {
  return Boolean(process.env.LEAD_WEBHOOK_SECRET);
}

export function getLeadWebhookSecret() {
  const secret = process.env.LEAD_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("LEAD_WEBHOOK_SECRET is not set");
  }
  return secret;
}

export function secretsMatch(provided: string, expected: string) {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}
