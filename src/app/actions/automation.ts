"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal.server";
import { prisma } from "@/lib/db.server";

export async function setDailyDigestEnabled(enabled: boolean) {
  const { agentId } = await verifySession();
  await prisma.agent.update({ where: { id: agentId }, data: { dailyDigestEnabled: enabled } });
  revalidatePath("/dashboard/settings");
}

export async function setAutoNurtureEnabled(enabled: boolean) {
  const { agentId } = await verifySession();
  await prisma.agent.update({ where: { id: agentId }, data: { autoNurtureEnabled: enabled } });
  revalidatePath("/dashboard/settings");
}
