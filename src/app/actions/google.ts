"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal.server";
import { prisma } from "@/lib/db.server";
import { fetchGmailThreadsForEmail, type GmailThreadSummary } from "@/lib/google-gmail.server";
import { syncBirthdaysFromGoogle } from "@/lib/birthday-sync.server";

// Click-to-load Gmail thread history for one lead/contact card — deliberately
// not called during page render (see lead-card.tsx / contact-card.tsx).
// Returns [] rather than throwing when Google isn't connected, so a stale UI
// state (e.g. disconnected in another tab) degrades quietly instead of
// surfacing a raw error for something the agent didn't cause.
export async function getGmailThreadHistory(email: string): Promise<GmailThreadSummary[]> {
  const { agentId } = await verifySession();
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { googleRefreshToken: true },
  });
  if (!agent?.googleRefreshToken) return [];

  return fetchGmailThreadsForEmail(agentId, email);
}

// Revokes the connection made via /api/google/authorize + /api/google/callback.
export async function disconnectGoogle() {
  const { agentId } = await verifySession();
  await prisma.agent.update({
    where: { id: agentId },
    data: {
      googleEmail: null,
      googleAccessToken: null,
      googleRefreshToken: null,
      googleTokenExpiresAt: null,
      googleContactsSyncedAt: null,
    },
  });
  revalidatePath("/dashboard/settings");
}

// Manual "Sync now" so a freshly-connected agent doesn't have to wait for
// tomorrow's cron run to see birthdays show up.
export async function syncGoogleBirthdaysNow() {
  const { agentId } = await verifySession();
  await syncBirthdaysFromGoogle(agentId);
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/sphere");
  revalidatePath("/dashboard/today");
}
