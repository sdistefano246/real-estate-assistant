import { headers } from "next/headers";
import { isLeadWebhookConfigured } from "@/lib/lead-webhook.server";

async function getInboundUrl() {
  const headerList = await headers();
  const host = headerList.get("host") ?? "your-domain.com";
  const proto = host.includes("localhost") ? "http" : headerList.get("x-forwarded-proto") ?? "https";
  const key = process.env.LEAD_WEBHOOK_SECRET ?? "YOUR_SECRET_HERE";
  return `${proto}://${host}/api/leads/inbound?key=${key}`;
}

export async function WebsiteFormSetup() {
  const configured = isLeadWebhookConfigured();
  const inboundUrl = await getInboundUrl();

  return (
    <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-6">
      <h2 className="text-sm font-semibold text-teal-900">Website inbound form</h2>
      <p className="mt-1 text-sm text-stone-500">
        Paste this form on your own site (or link to it from a bio link) to capture leads
        automatically, the moment someone submits — no manual entry required.
      </p>

      {!configured && (
        <p className="mt-3 text-sm text-amber-700">
          Add <code className="font-mono">LEAD_WEBHOOK_SECRET</code> to .env (any long random
          string) to enable this.
        </p>
      )}

      <pre className="mt-3 overflow-x-auto rounded-md bg-stone-100 p-3 text-xs text-stone-700">
        {`<form action="${inboundUrl}" method="POST">
  <input name="name" placeholder="Your name" required />
  <input name="email" type="email" placeholder="Your email" />
  <input name="phone" placeholder="Your phone" />
  <textarea name="message" placeholder="How can I help?"></textarea>
  <input type="hidden" name="redirect_to" value="https://your-site.com/thank-you" />
  <input type="text" name="company" style="display:none" tabindex="-1" autocomplete="off" />
  <button type="submit">Send</button>
</form>`}
      </pre>

      <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-sm text-stone-600">
        <li>
          The hidden <code className="font-mono">company</code> field is a spam trap — leave it in
          exactly as shown, real visitors never see or fill it.
        </li>
        <li>
          <code className="font-mono">redirect_to</code> is optional — set it to a page on your own
          site to send visitors there after submitting; otherwise they see a plain &quot;thanks&quot;
          page.
        </li>
        <li>Every submission shows up below immediately, tagged with source &quot;website-form&quot;.</li>
      </ul>
    </div>
  );
}
