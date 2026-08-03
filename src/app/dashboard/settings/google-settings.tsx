"use client";

import { useTransition } from "react";
import { disconnectGoogle, syncGoogleBirthdaysNow } from "@/app/actions/google";
import { formatRelativeTime } from "@/lib/relative-time";

export function GoogleSettings({
  configured,
  connected,
  googleEmail,
  syncedAt,
  status,
}: {
  configured: boolean;
  connected: boolean;
  googleEmail: string | null;
  syncedAt: Date | null;
  status: "connected" | "error" | undefined;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-6">
      <h3 className="text-sm font-semibold text-teal-900">Google — birthdays &amp; email history</h3>
      <p className="mt-1 text-sm text-stone-500">
        Connects your Google account so Sphere contacts can show a birthday reminder pulled from
        your real Google Contacts, and any Lead or Contact card with an email address can load its
        real Gmail thread history on demand. Read-only — nothing is ever sent from your Gmail.
      </p>

      {status === "connected" && (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          Google connected.
        </p>
      )}
      {status === "error" && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          Couldn&apos;t connect Google — the request may have expired or been denied. Try again.
        </p>
      )}

      {!configured && (
        <p className="mt-4 text-xs text-amber-700">
          Add <code>GOOGLE_CLIENT_ID</code> / <code>GOOGLE_CLIENT_SECRET</code> to enable — see
          SETUP.md.
        </p>
      )}

      {configured && !connected && (
        <a
          href="/api/google/authorize"
          className="mt-4 inline-block rounded-md bg-teal-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
        >
          Connect Google
        </a>
      )}

      {configured && connected && (
        <>
          <p className="mt-4 text-xs text-stone-600">
            Connected as <span className="font-medium text-teal-900">{googleEmail}</span>
          </p>
          <p className="mt-1 text-xs text-stone-400">
            {syncedAt ? `Birthdays last synced ${formatRelativeTime(syncedAt)}` : "Birthdays not synced yet"}
          </p>

          <div className="mt-3 flex items-center gap-3">
            <button
              disabled={isPending}
              onClick={() => startTransition(() => syncGoogleBirthdaysNow())}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              {isPending ? "Syncing…" : "Sync birthdays now"}
            </button>

            <button
              disabled={isPending}
              onClick={() => {
                if (confirm("Disconnect Google? Birthday sync and Gmail thread history will stop working until you reconnect.")) {
                  startTransition(() => disconnectGoogle());
                }
              }}
              className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Disconnect Google
            </button>
          </div>
        </>
      )}
    </div>
  );
}
