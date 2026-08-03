import "server-only";
import { ensureFreshGoogleAccessToken } from "@/lib/google.server";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";

export type GmailThreadSummary = {
  threadId: string;
  subject: string;
  snippet: string;
  lastMessageAt: Date;
  fromMe: boolean;
};

type GmailMessageListResponse = {
  messages?: { id: string; threadId: string }[];
  error?: { message?: string };
};

type GmailMessageHeader = { name?: string; value?: string };
type GmailMessageMetadata = {
  id?: string;
  threadId?: string;
  snippet?: string;
  internalDate?: string;
  payload?: { headers?: GmailMessageHeader[] };
  error?: { message?: string };
};

function getHeader(headers: GmailMessageHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

// Read-only Gmail thread history for one lead/contact email address, loaded
// on click (see the "Load email history" button in lead-card.tsx /
// contact-card.tsx) rather than during page render — calling Gmail once per
// row on every Leads/Sphere page load would be a real rate-limit risk with
// no caching layer in place; on-demand keeps the normal cost at zero.
export async function fetchGmailThreadsForEmail(
  agentId: string,
  email: string,
  limit = 5
): Promise<GmailThreadSummary[]> {
  const accessToken = await ensureFreshGoogleAccessToken(agentId);

  const searchParams = new URLSearchParams({
    q: `from:${email} OR to:${email}`,
    maxResults: String(limit * 3),
  });
  const listRes = await fetch(`${GMAIL_API_BASE}/users/me/messages?${searchParams.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const listJson = (await listRes.json()) as GmailMessageListResponse;
  if (!listRes.ok) {
    throw new Error(`Gmail search failed: ${listJson.error?.message ?? listRes.statusText}`);
  }

  const messages = listJson.messages ?? [];
  if (messages.length === 0) return [];

  // Gmail's search results are newest-first; keep only the newest message
  // per threadId so a long back-and-forth thread contributes one row, not
  // several.
  const seenThreads = new Set<string>();
  const threadsToFetch: { id: string; threadId: string }[] = [];
  for (const message of messages) {
    if (seenThreads.has(message.threadId)) continue;
    seenThreads.add(message.threadId);
    threadsToFetch.push(message);
    if (threadsToFetch.length >= limit) break;
  }

  const results = await Promise.all(
    threadsToFetch.map(async ({ id, threadId }) => {
      const metaParams = new URLSearchParams({ format: "metadata" });
      metaParams.append("metadataHeaders", "Subject");
      metaParams.append("metadataHeaders", "From");
      const res = await fetch(`${GMAIL_API_BASE}/users/me/messages/${id}?${metaParams.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = (await res.json()) as GmailMessageMetadata;
      if (!res.ok) {
        throw new Error(`Gmail message lookup failed: ${json.error?.message ?? res.statusText}`);
      }

      const from = getHeader(json.payload?.headers, "From").toLowerCase();
      return {
        threadId,
        subject: getHeader(json.payload?.headers, "Subject") || "(no subject)",
        snippet: json.snippet ?? "",
        lastMessageAt: new Date(Number(json.internalDate ?? Date.now())),
        // Two-party thread assumption: if the From header isn't this contact's
        // address, the agent must have sent it (the search was scoped to
        // messages to/from this one address).
        fromMe: !from.includes(email.toLowerCase()),
      };
    })
  );

  return results.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
}
