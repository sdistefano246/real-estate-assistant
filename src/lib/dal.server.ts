import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionPayload } from "@/lib/session.server";
import { prisma } from "@/lib/db.server";

export const verifySession = cache(async () => {
  const payload = await getSessionPayload();
  if (!payload?.agentId) {
    redirect("/login");
  }
  return { agentId: payload.agentId };
});

export const getCurrentAgent = cache(async () => {
  const session = await verifySession();
  return prisma.agent.findUnique({
    where: { id: session.agentId },
    select: {
      id: true,
      email: true,
      name: true,
      businessName: true,
      phone: true,
      dailyDigestEnabled: true,
      autoNurtureEnabled: true,
    },
  });
});
