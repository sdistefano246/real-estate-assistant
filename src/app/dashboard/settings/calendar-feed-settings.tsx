"use client";

import { useState, useTransition } from "react";
import { regenerateCalendarToken, disableCalendarFeed } from "@/app/actions/calendar";

export function CalendarFeedSettings({
  calendarToken,
  baseUrl,
}: {
  calendarToken: string | null;
  baseUrl: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const feedPath = calendarToken ? `/api/calendar/${calendarToken}` : null;
  const feedUrl = feedPath ? (baseUrl ? `${baseUrl}${feedPath}` : feedPath) : null;

  function copy() {
    if (!feedUrl) return;
    navigator.clipboard?.writeText(feedUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-6">
      <h3 className="text-sm font-semibold text-teal-900">Calendar feed</h3>
      <p className="mt-1 text-sm text-stone-500">
        Subscribe to a private calendar of your closing dates, transaction deadlines, and buyer
        showings — it stays in sync in Google Calendar, Apple Calendar, or Outlook. No account
        connection needed.
      </p>

      {!calendarToken ? (
        <button
          disabled={isPending}
          onClick={() => startTransition(() => regenerateCalendarToken())}
          className="mt-4 rounded-md bg-teal-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {isPending ? "Generating…" : "Generate calendar link"}
        </button>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-2">
            <input
              readOnly
              value={feedUrl ?? ""}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 rounded-md border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-700"
            />
            <button
              onClick={copy}
              className="rounded-md border border-stone-300 px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          {!baseUrl && (
            <p className="mt-2 text-xs text-amber-700">
              This is a relative path — prefix it with your deployed domain (or set APP_URL) to get
              the full subscription URL.
            </p>
          )}

          <p className="mt-3 text-xs text-stone-500">
            In Google Calendar: <span className="text-stone-700">Other calendars → From URL</span>,
            paste the link. In Apple Calendar: <span className="text-stone-700">File → New Calendar
            Subscription</span>. It refreshes automatically on the calendar app&apos;s schedule.
          </p>

          <div className="mt-4 flex items-center gap-2">
            <button
              disabled={isPending}
              onClick={() => {
                if (confirm("Generate a new link? The current one will stop working.")) {
                  startTransition(() => regenerateCalendarToken());
                }
              }}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              Regenerate link
            </button>
            <button
              disabled={isPending}
              onClick={() => {
                if (confirm("Turn off the calendar feed? The link will stop working.")) {
                  startTransition(() => disableCalendarFeed());
                }
              }}
              className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Turn off
            </button>
          </div>
        </>
      )}
    </div>
  );
}
