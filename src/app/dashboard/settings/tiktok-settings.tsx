"use client";

import { useTransition } from "react";
import { disconnectTiktok } from "@/app/actions/tiktok";
import { setAutoPostTiktokEnabled } from "@/app/actions/automation";

export function TiktokSettings({
  configured,
  connected,
  autoPostEnabled,
  accountLabel,
  status,
}: {
  configured: boolean;
  connected: boolean;
  autoPostEnabled: boolean;
  accountLabel: string | null;
  status: "connected" | "error" | undefined;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-6">
      <h3 className="text-sm font-semibold text-teal-900">Auto-post new listings to TikTok</h3>
      <p className="mt-1 text-sm text-stone-500">
        The moment a new listing is generated on the Marketing page, publish its first photo to
        TikTok as a photo post, with the generated caption and hashtags. Only posts if the listing
        actually has a photo and a TikTok post; no review first.
      </p>
      <p className="mt-2 text-xs text-amber-700">
        Posts only become visible to the public once TikTok approves this app for public posting —
        until then, a post that goes through is visible only to the connected TikTok account.
      </p>

      {status === "connected" && (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          TikTok connected.
        </p>
      )}
      {status === "error" && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          Couldn&apos;t connect TikTok — the request may have expired or been denied. Try again.
        </p>
      )}

      {!configured && (
        <p className="mt-4 text-xs text-amber-700">
          Add <code>TIKTOK_CLIENT_KEY</code> / <code>TIKTOK_CLIENT_SECRET</code> to enable — see
          SETUP.md.
        </p>
      )}

      {configured && !connected && (
        <a
          href="/api/tiktok/authorize"
          className="mt-4 inline-block rounded-md bg-teal-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
        >
          Connect TikTok
        </a>
      )}

      {configured && connected && (
        <>
          <p className="mt-4 text-xs text-stone-600">
            {accountLabel ? (
              <>
                Connected as <span className="font-medium text-teal-900">{accountLabel}</span>
              </>
            ) : (
              "Connected — account name unavailable (TikTok didn't return one, or this was connected before this app started recording it)."
            )}
          </p>

          <div className="mt-3 flex items-center gap-3">
            <button
              disabled={isPending}
              onClick={() => startTransition(() => setAutoPostTiktokEnabled(!autoPostEnabled))}
              className={`rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                autoPostEnabled
                  ? "bg-teal-900 text-white hover:bg-teal-800"
                  : "border border-stone-300 text-stone-700 hover:bg-stone-50"
              }`}
            >
              {isPending ? "Saving…" : autoPostEnabled ? "On" : "Off"}
            </button>
            <p className="text-xs text-stone-500">
              {autoPostEnabled ? "Sends automatically — no review first." : "Off — nothing is sent automatically."}
            </p>
          </div>

          <button
            disabled={isPending}
            onClick={() => {
              if (confirm("Disconnect TikTok? Auto-post will turn off until you reconnect.")) {
                startTransition(() => disconnectTiktok());
              }
            }}
            className="mt-3 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Disconnect TikTok
          </button>
        </>
      )}
    </div>
  );
}
