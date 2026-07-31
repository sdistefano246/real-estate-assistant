import { getCurrentAgent } from "@/lib/dal.server";
import { isResendConfigured } from "@/lib/resend.server";
import { isAnthropicConfigured } from "@/lib/anthropic.server";
import { ChangePasswordForm } from "./change-password-form";
import { AutomationSettings } from "./automation-settings";

export default async function SettingsPage() {
  const agent = await getCurrentAgent();

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
          resendConfigured={isResendConfigured()}
          anthropicConfigured={isAnthropicConfigured()}
          cronConfigured={Boolean(process.env.CRON_SECRET)}
        />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-teal-900">Change password</h2>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
