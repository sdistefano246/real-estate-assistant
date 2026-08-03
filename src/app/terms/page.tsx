export const metadata = {
  title: "Terms of Service — Real Estate Assistant",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-stone-50 px-4 py-12">
      <div className="mx-auto max-w-2xl rounded-lg border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-teal-900">Terms of Service</h1>
        <p className="mt-1 text-sm text-stone-500">Last updated August 3, 2026</p>

        <div className="mt-6 flex flex-col gap-4 text-sm text-stone-700">
          <p>
            Real Estate Assistant is a dashboard operated by a real estate agent to
            manage their own listings, leads, buyer showings, transactions, and client
            communication. It is a single-agent tool, not a public service open to
            general signup.
          </p>

          <section>
            <h2 className="font-medium text-stone-900">Use of the app</h2>
            <p className="mt-1">
              Access is limited to the agent operating this dashboard. The agent is
              responsible for the accuracy of listing content, compliance with Fair
              Housing law and any applicable real estate advertising rules, and for the
              content of any communication sent to leads or clients through the app.
            </p>
          </section>

          <section>
            <h2 className="font-medium text-stone-900">AI-generated content</h2>
            <p className="mt-1">
              Listing descriptions, social posts, and follow-up messages are drafted
              with the help of Anthropic&apos;s Claude. The agent reviews and approves
              this content before it is sent or published, except where the agent has
              explicitly opted in to automatic sending or posting for a specific feature.
            </p>
          </section>

          <section>
            <h2 className="font-medium text-stone-900">Connected platforms</h2>
            <p className="mt-1">
              Where the agent connects a TikTok, Instagram, or Facebook account,
              content is published only to that agent&apos;s own connected account, at
              the agent&apos;s request, and only for as long as the connection remains
              active. The agent can disconnect a platform in Settings at any time.
            </p>
          </section>

          <section>
            <h2 className="font-medium text-stone-900">No warranty</h2>
            <p className="mt-1">
              This app is provided as-is. It is not a substitute for the agent&apos;s own
              professional judgment, and does not guarantee delivery of any email, text,
              call, or social media post.
            </p>
          </section>

          <section>
            <h2 className="font-medium text-stone-900">Contact</h2>
            <p className="mt-1">
              Questions about these terms can be directed to the agent operating this
              dashboard.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
