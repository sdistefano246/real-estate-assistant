"use client";

import { useTransition, useState, useActionState } from "react";
import { deleteLead, draftEmail, logInteraction, sendEmail, sendText, updateLeadStatus } from "@/app/actions/leads";
import { convertToTransaction } from "@/app/actions/transactions";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/lead-status";
import { formatRelativeTime } from "@/lib/relative-time";

type EmailLogItem = {
  id: string;
  kind: string;
  subject: string;
  body: string;
  status: string;
  sentAt: Date | null;
  createdAt: Date;
};

type TextLogItem = {
  id: string;
  kind: string;
  body: string;
  status: string;
  sentAt: Date | null;
  createdAt: Date;
};

type TimelineItem =
  | { type: "interaction"; id: string; createdAt: Date; note: string }
  | { type: "email"; id: string; createdAt: Date; kind: string; subject: string; body: string; status: string }
  | { type: "text"; id: string; createdAt: Date; kind: string; body: string; status: string };

type InteractionItem = {
  id: string;
  note: string;
  createdAt: Date;
};

type TransactionItem = {
  id: string;
  propertyAddress: string;
  side: string;
  status: string;
};

type LeadItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  notes: string | null;
  status: string;
  createdAt: Date;
  lastContactedAt: Date | null;
  emailLogs: EmailLogItem[];
  textLogs: TextLogItem[];
  interactions: InteractionItem[];
  transactions: TransactionItem[];
};

export function LeadCard({
  lead,
  anthropicConfigured,
  resendConfigured,
  twilioConfigured,
  isStale,
  reason,
}: {
  lead: LeadItem;
  anthropicConfigured: boolean;
  resendConfigured: boolean;
  twilioConfigured: boolean;
  isStale: boolean;
  reason?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [showConvertForm, setShowConvertForm] = useState(false);
  const convertAction = convertToTransaction.bind(null, lead.id);
  const [convertState, convertFormAction, convertPending] = useActionState(convertAction, undefined);

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

  function submitInteraction() {
    const note = noteText.trim();
    if (!note) return;
    setError(null);
    startTransition(async () => {
      try {
        await logInteraction(lead.id, note);
        setNoteText("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  const latestFollowupDraft = lead.emailLogs.find(
    (log) => log.status === "draft" && log.kind === "followup"
  );

  const timeline: TimelineItem[] = [
    ...lead.interactions.map((i): TimelineItem => ({ type: "interaction", id: i.id, createdAt: i.createdAt, note: i.note })),
    ...lead.emailLogs.map((e): TimelineItem => ({ type: "email", id: e.id, createdAt: e.createdAt, kind: e.kind, subject: e.subject, body: e.body, status: e.status })),
    ...lead.textLogs.map((t): TimelineItem => ({ type: "text", id: t.id, createdAt: t.createdAt, kind: t.kind, body: t.body, status: t.status })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-teal-900">{lead.name}</h3>
            {isStale && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                Waiting on you
              </span>
            )}
          </div>
          <p className="text-xs text-stone-500">
            {[lead.email, lead.phone, lead.source].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-0.5 text-xs text-stone-400">
            Inquired {formatRelativeTime(lead.createdAt)}
            {lead.lastContactedAt && <> · Last contacted {formatRelativeTime(lead.lastContactedAt)}</>}
            {!lead.lastContactedAt && " · Not yet contacted"}
          </p>
          {reason && <p className="mt-1 text-xs font-medium text-amber-700">{reason}</p>}
          {lead.notes && <p className="mt-1 text-xs text-stone-500">{lead.notes}</p>}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={lead.status}
            disabled={isPending}
            onChange={(e) => run(() => updateLeadStatus(lead.id, e.target.value))}
            className="rounded-md border border-stone-300 px-2 py-1 text-xs text-stone-700 disabled:opacity-50"
          >
            {LEAD_STATUSES.map((status: LeadStatus) => (
              <option key={status} value={status}>
                {LEAD_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <button
            disabled={isPending}
            onClick={() => run(() => deleteLead(lead.id))}
            className="text-xs text-stone-400 hover:text-red-600 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-4 border-t border-stone-100 pt-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitInteraction();
          }}
          className="flex items-center gap-2"
        >
          <input
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            disabled={isPending}
            placeholder="Log a touch — e.g. &quot;left a voicemail&quot;, &quot;talked, wants Saturday showing&quot;"
            className="flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-xs disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isPending || !noteText.trim()}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            Log
          </button>
        </form>

        {lead.status === "converted" && lead.transactions[0] && (
          <p className="mt-3 text-xs font-medium text-teal-800">
            → Transaction: {lead.transactions[0].propertyAddress} ({lead.transactions[0].side})
          </p>
        )}

        {lead.status === "qualified" && !showConvertForm && (
          <button
            onClick={() => setShowConvertForm(true)}
            className="mt-3 rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
          >
            Convert to transaction
          </button>
        )}

        {lead.status === "qualified" && showConvertForm && (
          <form action={convertFormAction} className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-stone-200 p-3">
            <input
              name="propertyAddress"
              required
              placeholder="Property address"
              className="min-w-[12rem] flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-xs"
            />
            <select name="side" defaultValue="buyer" className="rounded-md border border-stone-300 px-2 py-1.5 text-xs">
              <option value="buyer">Buyer side</option>
              <option value="seller">Seller side</option>
            </select>
            <label className="flex items-center gap-1 text-xs text-stone-500">
              Contract date
              <input name="contractDate" type="date" required className="rounded-md border border-stone-300 px-2 py-1.5 text-xs" />
            </label>
            <label className="flex items-center gap-1 text-xs text-stone-500">
              Closing date
              <input name="closingDate" type="date" required className="rounded-md border border-stone-300 px-2 py-1.5 text-xs" />
            </label>
            <button
              type="submit"
              disabled={convertPending}
              className="rounded-md bg-teal-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {convertPending ? "Converting…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setShowConvertForm(false)}
              className="text-xs text-stone-400 hover:text-stone-700"
            >
              Cancel
            </button>
            {convertState?.error && <p className="w-full text-xs text-red-600">{convertState.error}</p>}
          </form>
        )}

        {!anthropicConfigured && (
          <p className="mt-3 text-xs text-amber-700">Add ANTHROPIC_API_KEY to draft follow-up emails.</p>
        )}
        {anthropicConfigured && !latestFollowupDraft && (
          <button
            disabled={isPending}
            onClick={() => run(() => draftEmail(lead.id))}
            className="mt-3 rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            {isPending ? "Drafting…" : "Draft follow-up email"}
          </button>
        )}

        {/* One chronological history — email, text, and logged touches interleaved by
            time, not grouped by source. This is the actual "memory" view (2C). */}
        {timeline.map((item) => {
          if (item.type === "interaction") {
            return (
              <p key={`interaction-${item.id}`} className="mt-3 text-xs text-stone-600">
                <span className="text-stone-400">{formatRelativeTime(item.createdAt)} — </span>
                {item.note}
              </p>
            );
          }

          const badgeLabel =
            item.kind === "instant_ack"
              ? item.type === "email"
                ? "Instant ack"
                : "Instant ack (text)"
              : "Follow-up email";

          return (
            <div key={`${item.type}-${item.id}`} className="mt-3 rounded-md bg-stone-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {item.type === "email" && (
                    <p className="text-xs font-semibold text-teal-900">{item.subject}</p>
                  )}
                  <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-medium text-teal-800">
                    {badgeLabel}
                  </span>
                </div>
                <span
                  className={`shrink-0 text-xs ${item.status === "sent" ? "text-emerald-600" : "text-stone-400"}`}
                >
                  {item.status === "sent" ? "Sent" : "Draft"}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-xs text-stone-600">{item.body}</p>
              {item.status === "draft" &&
                (item.type === "email" ? (
                  <div className="mt-2 flex items-center gap-2">
                    {!resendConfigured && (
                      <p className="text-xs text-amber-700">Add RESEND_API_KEY + RESEND_FROM_EMAIL to send.</p>
                    )}
                    {resendConfigured && (
                      <button
                        disabled={isPending || !lead.email}
                        onClick={() => run(() => sendEmail(item.id))}
                        className="rounded-md bg-teal-900 px-3 py-1 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                        title={!lead.email ? "This lead has no email address" : undefined}
                      >
                        {isPending ? "Sending…" : "Send"}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-2">
                    {!twilioConfigured && (
                      <p className="text-xs text-amber-700">Add Twilio credentials (see the Calls page) to send.</p>
                    )}
                    {twilioConfigured && (
                      <button
                        disabled={isPending || !lead.phone}
                        onClick={() => run(() => sendText(item.id))}
                        className="rounded-md bg-teal-900 px-3 py-1 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                        title={!lead.phone ? "This lead has no phone number" : undefined}
                      >
                        {isPending ? "Sending…" : "Send"}
                      </button>
                    )}
                  </div>
                ))}
            </div>
          );
        })}

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
