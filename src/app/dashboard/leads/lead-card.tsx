"use client";

import { useTransition, useState } from "react";
import { deleteLead, draftEmail, sendEmail } from "@/app/actions/leads";

type EmailLogItem = {
  id: string;
  subject: string;
  body: string;
  status: string;
  sentAt: Date | null;
};

type LeadItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  notes: string | null;
  emailLogs: EmailLogItem[];
};

export function LeadCard({
  lead,
  anthropicConfigured,
  resendConfigured,
}: {
  lead: LeadItem;
  anthropicConfigured: boolean;
  resendConfigured: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  const latestDraft = lead.emailLogs.find((log) => log.status === "draft");

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-teal-900">{lead.name}</h3>
          <p className="text-xs text-stone-500">
            {[lead.email, lead.phone, lead.source].filter(Boolean).join(" · ")}
          </p>
          {lead.notes && <p className="mt-1 text-xs text-stone-500">{lead.notes}</p>}
        </div>
        <button
          disabled={isPending}
          onClick={() => run(() => deleteLead(lead.id))}
          className="text-xs text-stone-400 hover:text-red-600 disabled:opacity-50"
        >
          Delete
        </button>
      </div>

      <div className="mt-4 border-t border-stone-100 pt-4">
        {!anthropicConfigured && (
          <p className="text-xs text-amber-700">Add ANTHROPIC_API_KEY to draft follow-up emails.</p>
        )}
        {anthropicConfigured && !latestDraft && (
          <button
            disabled={isPending}
            onClick={() => run(() => draftEmail(lead.id))}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            {isPending ? "Drafting…" : "Draft follow-up email"}
          </button>
        )}

        {lead.emailLogs.map((log) => (
          <div key={log.id} className="mt-3 rounded-md bg-stone-50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-teal-900">{log.subject}</p>
              <span
                className={`text-xs ${log.status === "sent" ? "text-emerald-600" : "text-stone-400"}`}
              >
                {log.status === "sent" ? "Sent" : "Draft"}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-xs text-stone-600">{log.body}</p>
            {log.status === "draft" && (
              <div className="mt-2 flex items-center gap-2">
                {!resendConfigured && (
                  <p className="text-xs text-amber-700">Add RESEND_API_KEY + RESEND_FROM_EMAIL to send.</p>
                )}
                {resendConfigured && (
                  <button
                    disabled={isPending || !lead.email}
                    onClick={() => run(() => sendEmail(log.id))}
                    className="rounded-md bg-teal-900 px-3 py-1 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                    title={!lead.email ? "This lead has no email address" : undefined}
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
    </div>
  );
}
