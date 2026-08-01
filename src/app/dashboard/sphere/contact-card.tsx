"use client";

import { useState, useTransition } from "react";
import { draftCheckIn, logContactTouch, sendCheckIn } from "@/app/actions/contacts";
import { CONTACT_RELATIONSHIP_LABELS, type ContactRelationship } from "@/lib/contact-relationship";
import { formatRelativeTime } from "@/lib/relative-time";

type CheckInLogItem = { id: string; subject: string; body: string; status: string; createdAt: Date };
type TouchItem = { id: string; note: string; createdAt: Date };

type TimelineItem =
  | { type: "touch"; id: string; createdAt: Date; note: string }
  | { type: "checkIn"; id: string; createdAt: Date; subject: string; body: string; status: string };

type ContactItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  relationship: string;
  notes: string | null;
  createdAt: Date;
  lastContactedAt: Date | null;
  checkInLogs: CheckInLogItem[];
  contactTouches: TouchItem[];
};

export function ContactCard({
  contact,
  anthropicConfigured,
  resendConfigured,
  isDue,
  reason,
}: {
  contact: ContactItem;
  anthropicConfigured: boolean;
  resendConfigured: boolean;
  isDue: boolean;
  reason?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

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

  function submitTouch() {
    const note = noteText.trim();
    if (!note) return;
    setError(null);
    startTransition(async () => {
      try {
        await logContactTouch(contact.id, note);
        setNoteText("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  const hasDraft = contact.checkInLogs.some((log) => log.status === "draft");

  const timeline: TimelineItem[] = [
    ...contact.contactTouches.map((t): TimelineItem => ({ type: "touch", id: t.id, createdAt: t.createdAt, note: t.note })),
    ...contact.checkInLogs.map((c): TimelineItem => ({ type: "checkIn", id: c.id, createdAt: c.createdAt, subject: c.subject, body: c.body, status: c.status })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-teal-900">{contact.name}</h3>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
              {CONTACT_RELATIONSHIP_LABELS[contact.relationship as ContactRelationship] ?? contact.relationship}
            </span>
            {isDue && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                Due for a touch
              </span>
            )}
          </div>
          <p className="text-xs text-stone-500">{[contact.email, contact.phone].filter(Boolean).join(" · ")}</p>
          <p className="mt-0.5 text-xs text-stone-400">
            {contact.lastContactedAt
              ? `Last touched ${formatRelativeTime(contact.lastContactedAt)}`
              : `Added ${formatRelativeTime(contact.createdAt)}, never touched`}
          </p>
          {reason && <p className="mt-1 text-xs font-medium text-amber-700">{reason}</p>}
          {contact.notes && <p className="mt-1 text-xs text-stone-500">{contact.notes}</p>}
        </div>
      </div>

      <div className="mt-4 border-t border-stone-100 pt-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitTouch();
          }}
          className="flex items-center gap-2"
        >
          <input
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            disabled={isPending}
            placeholder="Log a touch — e.g. &quot;ran into them at the store, chatted&quot;"
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

        {!anthropicConfigured && (
          <p className="mt-3 text-xs text-amber-700">Add ANTHROPIC_API_KEY to draft check-ins.</p>
        )}
        {anthropicConfigured && !hasDraft && (
          <button
            disabled={isPending}
            onClick={() => run(() => draftCheckIn(contact.id))}
            className="mt-3 rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            {isPending ? "Drafting…" : "Draft check-in"}
          </button>
        )}

        {timeline.map((item) => {
          if (item.type === "touch") {
            return (
              <p key={`touch-${item.id}`} className="mt-3 text-xs text-stone-600">
                <span className="text-stone-400">{formatRelativeTime(item.createdAt)} — </span>
                {item.note}
              </p>
            );
          }
          return (
            <div key={`checkIn-${item.id}`} className="mt-3 rounded-md bg-stone-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-teal-900">{item.subject}</p>
                <span className={`shrink-0 text-xs ${item.status === "sent" ? "text-emerald-600" : "text-stone-400"}`}>
                  {item.status === "sent" ? "Sent" : "Draft"}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-xs text-stone-600">{item.body}</p>
              {item.status === "draft" && (
                <div className="mt-2">
                  {!resendConfigured && (
                    <p className="text-xs text-amber-700">Add RESEND_API_KEY + RESEND_FROM_EMAIL to send.</p>
                  )}
                  {resendConfigured && (
                    <button
                      disabled={isPending || !contact.email}
                      onClick={() => run(() => sendCheckIn(item.id))}
                      className="rounded-md bg-teal-900 px-3 py-1 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                      title={!contact.email ? "This contact has no email address" : undefined}
                    >
                      {isPending ? "Sending…" : "Send"}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
