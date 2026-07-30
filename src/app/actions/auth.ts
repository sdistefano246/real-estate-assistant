"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db.server";
import { verifySession } from "@/lib/dal.server";
import { createSession, deleteSession } from "@/lib/session.server";

export type LoginState = { error?: string } | undefined;

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const agent = await prisma.agent.findUnique({ where: { email } });
  if (!agent) {
    return { error: "Invalid email or password." };
  }

  const valid = await bcrypt.compare(password, agent.passwordHash);
  if (!valid) {
    return { error: "Invalid email or password." };
  }

  await createSession(agent.id);
  redirect("/dashboard");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

export type ChangePasswordState = { error?: string; success?: boolean } | undefined;

export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const { agentId } = await verifySession();

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "Fill in all three fields." };
  }
  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "New password and confirmation don't match." };
  }

  const agent = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } });

  const valid = await bcrypt.compare(currentPassword, agent.passwordHash);
  if (!valid) {
    return { error: "Current password is incorrect." };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.agent.update({ where: { id: agentId }, data: { passwordHash } });

  return { success: true };
}
