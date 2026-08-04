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
  // The session cookie is a signed JWT, verified only for signature/expiry —
  // it's never checked against the database on its own. A stale cookie
  // pointing at a deleted (or since-recreated) Agent row would otherwise
  // pass this check and only fail later, deep inside whatever query actually
  // needed the agent, as a raw 500 instead of a clean redirect to login.
  const exists = await prisma.agent.findUnique({ where: { id: payload.agentId }, select: { id: true } });
  if (!exists) {
    redirect("/login");
  }
  return { agentId: payload.agentId };
});

export const getCurrentAgent = cache(async () => {
  const session = await verifySession();
  const agent = await prisma.agent.findUnique({
    where: { id: session.agentId },
    select: {
      id: true,
      email: true,
      name: true,
      businessName: true,
      phone: true,
      assistantName: true,
      dailyDigestEnabled: true,
      autoNurtureEnabled: true,
      autoPostInstagramEnabled: true,
      autoPostFacebookEnabled: true,
      autoPostTiktokEnabled: true,
      tiktokOpenId: true,
      tiktokTokenExpiresAt: true,
      googleEmail: true,
      googleTokenExpiresAt: true,
      googleContactsSyncedAt: true,
      // Selected only to compute the boolean below, then dropped — this app's
      // Lead/Contact cards are client components, and the raw refresh token
      // is a real bearer credential (unlike tiktokOpenId, which is just an
      // identifier). Never return it from this general-purpose cached call.
      googleRefreshToken: true,
      calendarToken: true,
    },
  });
  if (!agent) return agent;

  const { googleRefreshToken, ...rest } = agent;
  return { ...rest, googleConnected: Boolean(googleRefreshToken) };
});
