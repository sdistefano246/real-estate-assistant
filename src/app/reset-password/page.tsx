"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { resetPassword } from "@/app/actions/auth";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, formAction, pending] = useActionState(resetPassword, undefined);

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
        <div className="w-full max-w-sm rounded-lg border border-stone-200 bg-white p-8 shadow-sm text-center">
          <h1 className="text-xl font-semibold text-teal-900">Invalid reset link</h1>
          <p className="mt-2 text-sm text-stone-500">
            This link is missing its token. Request a new one from the sign-in page.
          </p>
          <a href="/forgot-password" className="mt-4 inline-block text-sm text-teal-800 hover:underline">
            Request a new reset link
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-teal-900">Set a new password</h1>

        {state?.success ? (
          <>
            <p className="mt-2 text-sm text-emerald-700">
              Password updated. You can sign in with it now.
            </p>
            <a
              href="/login"
              className="mt-4 inline-block w-full rounded-md bg-teal-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-teal-800"
            >
              Go to sign in
            </a>
          </>
        ) : (
          <form action={formAction} className="mt-6 flex flex-col gap-4">
            <input type="hidden" name="token" value={token} />
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-stone-700">
                New password
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
              <p className="mt-1 text-xs text-stone-400">At least 8 characters.</p>
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-stone-700">
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
            </div>

            {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

            <button
              type="submit"
              disabled={pending}
              className="mt-2 w-full rounded-md bg-teal-900 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {pending ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
