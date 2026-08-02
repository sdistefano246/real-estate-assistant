"use client";

import { useTransition } from "react";
import {
  setDailyDigestEnabled,
  setAutoNurtureEnabled,
  setAutoPostInstagramEnabled,
  setAutoPostFacebookEnabled,
} from "@/app/actions/automation";

export function AutomationSettings({
  dailyDigestEnabled,
  autoNurtureEnabled,
  autoPostInstagramEnabled,
  autoPostFacebookEnabled,
  resendConfigured,
  anthropicConfigured,
  instagramConfigured,
  facebookConfigured,
  cronConfigured,
}: {
  dailyDigestEnabled: boolean;
  autoNurtureEnabled: boolean;
  autoPostInstagramEnabled: boolean;
  autoPostFacebookEnabled: boolean;
  resendConfigured: boolean;
  anthropicConfigured: boolean;
  instagramConfigured: boolean;
  facebookConfigured: boolean;
  cronConfigured: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {!cronConfigured && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Scheduled automation isn&apos;t running yet. Set a <code>CRON_SECRET</code> in your
          environment and deploy — a daily job then runs these for you. Until then, everything
          below still works when triggered manually, but nothing fires on its own.
        </p>
      )}

      <Toggle
        title="Daily digest email"
        description="Every morning, get one email listing the leads waiting on a follow-up, the deadlines coming up, and the sphere contacts due for a check-in — so you don't have to open the dashboard to know what needs you. You only get it on days something actually needs attention."
        enabled={dailyDigestEnabled}
        onToggle={(next) => setDailyDigestEnabled(next)}
        warning={
          dailyDigestEnabled && !resendConfigured
            ? "Add RESEND_API_KEY + RESEND_FROM_EMAIL to actually send the digest — until then it can't reach your inbox."
            : null
        }
      />

      <Toggle
        title="Auto-send sphere check-ins"
        description="When a past client or referral source goes quiet past your 90-day cadence, draft and send a warm check-in automatically — no review first. These are genuine relationship notes, never a pitch. Contacts with no email on file are skipped, and no more than five go out per day."
        enabled={autoNurtureEnabled}
        onToggle={(next) => setAutoNurtureEnabled(next)}
        warning={
          autoNurtureEnabled && (!resendConfigured || !anthropicConfigured)
            ? "Auto-send needs ANTHROPIC_API_KEY (to draft) and RESEND_API_KEY + RESEND_FROM_EMAIL (to send). Until both are set, nothing goes out — draft-and-review from the Sphere page still works."
            : null
        }
        danger
      />

      <Toggle
        title="Auto-post new listings to Instagram"
        description="The moment a new listing is generated on the Marketing page, publish it straight to Instagram — the generated Instagram caption and hashtags, with the first uploaded photo. Only posts if the listing actually has a photo and an Instagram post; no review first."
        enabled={autoPostInstagramEnabled}
        onToggle={(next) => setAutoPostInstagramEnabled(next)}
        warning={
          autoPostInstagramEnabled && !instagramConfigured
            ? "Add INSTAGRAM_ACCESS_TOKEN + INSTAGRAM_BUSINESS_ACCOUNT_ID to actually post — until then, listings still generate normally, they just won't auto-post. See SETUP.md."
            : null
        }
        danger
      />

      <Toggle
        title="Auto-post new listings to Facebook"
        description="The moment a new listing is generated on the Marketing page, publish it straight to your Facebook Page — the generated Facebook caption, with the first uploaded photo. Only posts if the listing actually has a photo and a Facebook post; no review first."
        enabled={autoPostFacebookEnabled}
        onToggle={(next) => setAutoPostFacebookEnabled(next)}
        warning={
          autoPostFacebookEnabled && !facebookConfigured
            ? "Add FACEBOOK_PAGE_ACCESS_TOKEN + FACEBOOK_PAGE_ID to actually post — until then, listings still generate normally, they just won't auto-post. See SETUP.md."
            : null
        }
        danger
      />
    </div>
  );
}

function Toggle({
  title,
  description,
  enabled,
  onToggle,
  warning,
  danger = false,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (next: boolean) => Promise<void>;
  warning: string | null;
  danger?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-6">
      <h3 className="text-sm font-semibold text-teal-900">{title}</h3>
      <p className="mt-1 text-sm text-stone-500">{description}</p>

      <div className="mt-4 flex items-center gap-3">
        <button
          disabled={isPending}
          onClick={() => startTransition(() => onToggle(!enabled))}
          className={`rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
            enabled
              ? "bg-teal-900 text-white hover:bg-teal-800"
              : "border border-stone-300 text-stone-700 hover:bg-stone-50"
          }`}
        >
          {isPending ? "Saving…" : enabled ? "On" : "Off"}
        </button>
        <p className="text-xs text-stone-500">
          {enabled
            ? danger
              ? "Sends automatically — no review first."
              : "Sent automatically on schedule."
            : "Off — nothing is sent automatically."}
        </p>
      </div>

      {warning && <p className="mt-2 text-xs text-amber-700">{warning}</p>}
    </div>
  );
}
