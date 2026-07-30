"use client";

import { useState, useTransition } from "react";
import { draftChase, sendChase } from "@/app/actions/transactions";
import { TRANSACTION_CONTACT_ROLE_LABELS, type TransactionContactRole } from "@/lib/transaction-contact-role";

type ChaseLogItem = {
  id: string;
  subject: string;
  body: string;
  status: string;
};

type ContactItem = {
  id: string;
  role: string;
  name: string;
  email: string;
  chaseLogs: ChaseLogItem[];
};

export function ContactBlock({
  contact,
  anthropicConfigured,
  resendConfigured,
}: {
  contact: ContactItem;
  anthropicConfigured: boolean;
  resendConfigured: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [whatIsNeeded, setWhatIsNeeded] = useState("");

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function submitDraftChase() {
    const text = whatIsNeeded.trim();
    if (!text) return;
    setError(null);
    startTransition(async () => {
      try {
        await draftChase(contact.id, text);
        setWhatIsNeeded("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  const roleLabel =
    TRANSACTION_CONTACT_ROLE_LABELS[contact.role as TransactionContactRole] ?? contact.role;

  return (
    <div className="rounded-md border border-stone-200 p-3">
      <p className="text-xs font-semibold text-teal-900">
        {contact.name} <span className="font-normal text-stone-400">— {roleLabel}</span>
      </p>
      <p className="text-xs text-stone-500">{contact.email}</p>

      {!anthropicConfigured && (
        <p className="mt-2 text-xs text-amber-700">Add ANTHROPIC_API_KEY to draft chase emails.</p>
      )}
      {anthropicConfigured && (
        <div className="mt-2 flex items-center gap-2">
          <input
            value={whatIsNeeded}
            onChange={(e) => setWhatIsNeeded(e.target.value)}
            disabled={isPending}
            placeholder="What's outstanding? e.g. &quot;loan approval letter&quot;"
            className="flex-1 rounded-md border border-stone-300 px-2 py-1 text-xs disabled:opacity-50"
          />
          <button
            disabled={isPending || !whatIsNeeded.trim()}
            onClick={submitDraftChase}
            className="rounded-md border border-stone-300 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            {isPending ? "Drafting…" : "Draft chase"}
          </button>
        </div>
      )}

      {contact.chaseLogs.map((log) => (
        <div key={log.id} className="mt-2 rounded-md bg-stone-50 p-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-teal-900">{log.subject}</p>
            <span className={`shrink-0 text-xs ${log.status === "sent" ? "text-emerald-600" : "text-stone-400"}`}>
              {log.status === "sent" ? "Sent" : "Draft"}
            </span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-xs text-stone-600">{log.body}</p>
          {log.status === "draft" && (
            <div className="mt-2">
              {!resendConfigured && (
                <p className="text-xs text-amber-700">Add RESEND_API_KEY + RESEND_FROM_EMAIL to send.</p>
              )}
              {resendConfigured && (
                <button
                  disabled={isPending}
                  onClick={() => run(() => sendChase(log.id))}
                  className="rounded-md bg-teal-900 px-3 py-1 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                >
                  {isPending ? "Sending…" : "Send"}
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
