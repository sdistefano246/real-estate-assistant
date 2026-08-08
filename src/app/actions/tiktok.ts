"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal.server";
import { prisma } from "@/lib/db.server";

// Revokes the connection made via /api/tiktok/authorize + /api/tiktok/callback.
// Also forces the auto-post toggle off — a stale "on" with no connection
// behind it would just silently do nothing, which is worse than making the
// off state explicit.
export async function disconnectTiktok() {
  const { agentId } = await verifySession();
  await prisma.agent.update({
    where: { id: agentId },
    data: {
      tiktokAccessToken: null,
      tiktokRefreshToken: null,
      tiktokTokenExpiresAt: null,
      tiktokOpenId: null,
      tiktokAccountLabel: null,
      autoPostTiktokEnabled: false,
    },
  });
  revalidatePath("/dashboard/settings");
}
