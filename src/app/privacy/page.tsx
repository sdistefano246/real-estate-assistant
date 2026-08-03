export const metadata = {
  title: "Privacy Policy — Real Estate Assistant",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-stone-50 px-4 py-12">
      <div className="mx-auto max-w-2xl rounded-lg border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-teal-900">Privacy Policy</h1>
        <p className="mt-1 text-sm text-stone-500">Last updated August 3, 2026</p>

        <div className="mt-6 flex flex-col gap-4 text-sm text-stone-700">
          <p>
            Real Estate Assistant is a dashboard used by a real estate agent to manage
            listings, leads, buyer showings, transactions, and client communication. It
            is not a public consumer app — it is operated by the agent for their own
            business.
          </p>

          <section>
            <h2 className="font-medium text-stone-900">What we store</h2>
            <p className="mt-1">
              Listing details and photos, lead and buyer contact information (name,
              email, phone) submitted through the agent&apos;s lead forms or entered by
              the agent, call logs, transaction and milestone records, and records of
              emails and text messages sent through the app.
            </p>
          </section>

          <section>
            <h2 className="font-medium text-stone-900">How it&apos;s used</h2>
            <p className="mt-1">
              To generate marketing content and follow-up communications with the help
              of Anthropic&apos;s Claude, to send email (via Resend) and SMS/voice
              call-backs (via Twilio), and — where the agent has opted in — to publish
              listing content to the agent&apos;s own connected Instagram, Facebook, or
              TikTok account. Data is never sold, and is not used for advertising.
            </p>
          </section>

          <section>
            <h2 className="font-medium text-stone-900">Social platform connections</h2>
            <p className="mt-1">
              When the agent connects a TikTok, Instagram, or Facebook account,
              access tokens are stored securely and used only to publish the agent&apos;s
              own listing content to that account, at the agent&apos;s explicit request.
              Disconnecting a platform in Settings stops all posting to it.
            </p>
          </section>

          <section>
            <h2 className="font-medium text-stone-900">Data retention and deletion</h2>
            <p className="mt-1">
              Data is retained for as long as the agent&apos;s account is active. The
              agent can delete individual listings, leads, and contacts directly in the
              dashboard at any time.
            </p>
          </section>

          <section>
            <h2 className="font-medium text-stone-900">Contact</h2>
            <p className="mt-1">
              Questions about this policy can be directed to the agent operating this
              dashboard.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
