"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db.server";
import { verifySession } from "@/lib/dal.server";
import { createSession, deleteSession } from "@/lib/session.server";
import { getResendClient, isResendConfigured } from "@/lib/resend.server";
import { getAppBaseUrl } from "@/lib/app-url.server";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour, single-use

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

// Always the same message regardless of whether the email matched a real
// account — a different message for "no account with that email" would let
// anyone probe which emails are registered.
const GENERIC_RESET_REQUEST_MESSAGE =
  "If an account exists for that email, a reset link has been sent. It expires in 1 hour.";

export type RequestPasswordResetState = { message?: string; error?: string } | undefined;

export async function requestPasswordReset(
  _prevState: RequestPasswordResetState,
  formData: FormData
): Promise<RequestPasswordResetState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    return { error: "Enter your email." };
  }

  const agent = await prisma.agent.findUnique({ where: { email } });
  if (!agent) {
    // Same message as success — see GENERIC_RESET_REQUEST_MESSAGE above.
    return { message: GENERIC_RESET_REQUEST_MESSAGE };
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  await prisma.agent.update({
    where: { id: agent.id },
    data: { resetToken, resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
  });

  if (isResendConfigured()) {
    const base = getAppBaseUrl();
    const resetUrl = `${base ?? ""}/reset-password?token=${resetToken}`;
    const resend = getResendClient();
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: agent.email,
      subject: "Reset your password",
      text: `Click the link below to set a new password. This link expires in 1 hour and only works once.\n\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
    });
  } else {
    // Public-facing page — never reveal a missing env var to an anonymous
    // visitor. Log server-side so this is actually noticed, not silently lost.
    console.error("Password reset requested but RESEND_API_KEY/RESEND_FROM_EMAIL not configured.");
  }

  return { message: GENERIC_RESET_REQUEST_MESSAGE };
}

export type ResetPasswordState = { error?: string; success?: boolean } | undefined;

export async function resetPassword(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const token = String(formData.get("token") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token) {
    return { error: "Missing or invalid reset link." };
  }
  if (!newPassword || !confirmPassword) {
    return { error: "Fill in both password fields." };
  }
  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "New password and confirmation don't match." };
  }

  const agent = await prisma.agent.findUnique({ where: { resetToken: token } });
  if (!agent || !agent.resetTokenExpiresAt || agent.resetTokenExpiresAt.getTime() < Date.now()) {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.agent.update({
    where: { id: agent.id },
    // Single-use: clear the token so this same link can't be replayed.
    data: { passwordHash, resetToken: null, resetTokenExpiresAt: null },
  });

  return { success: true };
}
