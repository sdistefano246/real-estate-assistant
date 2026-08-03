import { getCurrentAgent } from "@/lib/dal.server";
import { isResendConfigured } from "@/lib/resend.server";
import { isAnthropicConfigured } from "@/lib/anthropic.server";
import { isInstagramConfigured } from "@/lib/instagram.server";
import { isFacebookConfigured } from "@/lib/facebook.server";
import { isTiktokConfigured, isTiktokConnected } from "@/lib/tiktok.server";
import { isGoogleConfigured } from "@/lib/google.server";
import { getAppBaseUrl } from "@/lib/app-url.server";
import { ChangePasswordForm } from "./change-password-form";
import { AutomationSettings } from "./automation-settings";
import { CalendarFeedSettings } from "./calendar-feed-settings";
import { TiktokSettings } from "./tiktok-settings";
import { GoogleSettings } from "./google-settings";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tiktok?: string; google?: string }>;
}) {
  const agent = await getCurrentAgent();
  const { tiktok, google } = await searchParams;
  const tiktokStatus = tiktok === "connected" || tiktok === "error" ? tiktok : undefined;
  const googleStatus = google === "connected" || google === "error" ? google : undefined;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-lg font-semibold text-teal-900">Settings</h1>
        <p className="text-sm text-stone-500">Signed in as {agent?.email}.</p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-teal-900">Automation</h2>
        <AutomationSettings
          dailyDigestEnabled={agent?.dailyDigestEnabled ?? false}
          autoNurtureEnabled={agent?.autoNurtureEnabled ?? false}
          autoPostInstagramEnabled={agent?.autoPostInstagramEnabled ?? false}
          autoPostFacebookEnabled={agent?.autoPostFacebookEnabled ?? false}
          resendConfigured={isResendConfigured()}
          anthropicConfigured={isAnthropicConfigured()}
          instagramConfigured={isInstagramConfigured()}
          facebookConfigured={isFacebookConfigured()}
          cronConfigured={Boolean(process.env.CRON_SECRET)}
        />
        <div className="mt-4">
          <TiktokSettings
            configured={isTiktokConfigured()}
            connected={agent ? isTiktokConnected(agent) : false}
            autoPostEnabled={agent?.autoPostTiktokEnabled ?? false}
            status={tiktokStatus}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-teal-900">Google</h2>
        <GoogleSettings
          configured={isGoogleConfigured()}
          connected={agent?.googleConnected ?? false}
          googleEmail={agent?.googleEmail ?? null}
          syncedAt={agent?.googleContactsSyncedAt ?? null}
          status={googleStatus}
        />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-teal-900">Calendar</h2>
        <CalendarFeedSettings calendarToken={agent?.calendarToken ?? null} baseUrl={getAppBaseUrl()} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-teal-900">Change password</h2>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
