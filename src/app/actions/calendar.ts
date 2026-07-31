"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal.server";
import { prisma } from "@/lib/db.server";

// Generates a fresh feed token (or rotates the existing one, which revokes any
// link the agent shared before). 24 random bytes = an unguessable credential.
export async function regenerateCalendarToken() {
  const { agentId } = await verifySession();
  const token = crypto.randomBytes(24).toString("hex");
  await prisma.agent.update({ where: { id: agentId }, data: { calendarToken: token } });
  revalidatePath("/dashboard/settings");
}

export async function disableCalendarFeed() {
  const { agentId } = await verifySession();
  await prisma.agent.update({ where: { id: agentId }, data: { calendarToken: null } });
  revalidatePath("/dashboard/settings");
}
