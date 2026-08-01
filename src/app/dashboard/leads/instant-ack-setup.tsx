"use client";

import { useTransition } from "react";
import { setAutoAckEnabled } from "@/app/actions/leads";

export function InstantAckSetup({
  autoAckEnabled,
  resendConfigured,
  twilioConfigured,
}: {
  autoAckEnabled: boolean;
  resendConfigured: boolean;
  twilioConfigured: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-6">
      <h2 className="text-sm font-semibold text-teal-900">Instant acknowledgment</h2>
      <p className="mt-1 text-sm text-stone-500">
        The moment a new lead comes in from the website form, a short &quot;thanks for reaching
        out&quot; reply is drafted automatically — an email if they gave one, a text if they only
        left a phone number. Nothing promises a price, availability, or a showing time.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <button
          disabled={isPending}
          onClick={() => startTransition(() => setAutoAckEnabled(!autoAckEnabled))}
          className={`rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
            autoAckEnabled
              ? "bg-teal-900 text-white hover:bg-teal-800"
              : "border border-stone-300 text-stone-700 hover:bg-stone-50"
          }`}
        >
          {isPending ? "Saving…" : autoAckEnabled ? "Auto-send: On" : "Auto-send: Off"}
        </button>
        <p className="text-xs text-stone-500">
          {autoAckEnabled
            ? "Sends the moment a lead comes in — no review first."
            : "Drafts only — review and send it yourself from each lead below."}
        </p>
      </div>

      {autoAckEnabled && !resendConfigured && (
        <p className="mt-2 text-xs text-amber-700">
          Add RESEND_API_KEY + RESEND_FROM_EMAIL to actually send email acknowledgments — until
          then they&apos;ll still just draft.
        </p>
      )}
      {autoAckEnabled && !twilioConfigured && (
        <p className="mt-2 text-xs text-amber-700">
          Add Twilio credentials (see the Calls page) to actually send text acknowledgments —
          until then they&apos;ll still just draft.
        </p>
      )}
    </div>
  );
}
