# Setup

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000 — it redirects to `/login`.

**Demo login** (created by `prisma/seed.ts`): `agent@example.com` / `changeme123`. Change it from
`/dashboard/settings` before handing this to a real agent.

To re-seed (e.g. after wiping the database):

```bash
npx tsx prisma/seed.ts
```

## What works without any setup

The dashboard, auth, and data storage all work out of the box against the local SQLite database
(`dev.db`, gitignored). Every feature below is gated behind its own env var — until you add a key,
its page shows a plain "add this key" banner instead of crashing.

## External accounts needed per feature

### Marketing (listing descriptions + social posts) — Anthropic

1. Create a key at https://console.anthropic.com
2. Add to `.env`: `ANTHROPIC_API_KEY="sk-..."`

### Leads & Email — Anthropic (drafting) + Resend (sending)

1. Same `ANTHROPIC_API_KEY` as above covers email drafting.
2. Create an account at https://resend.com, verify a sending domain (or use their test domain
   while developing), get an API key.
3. Add to `.env`:
   ```
   RESEND_API_KEY="re_..."
   RESEND_FROM_EMAIL="you@yourdomain.com"
   ```

### Leads & Email — website inbound form (no external account needed)

Captures leads automatically from a form embedded on the agent's own website — no manual entry.

1. Generate a random secret: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`
2. Add to `.env`: `LEAD_WEBHOOK_SECRET="paste-that-here"`
3. The `/dashboard/leads` page shows the exact `<form>` snippet to copy, with the real
   webhook URL and key already filled in.

### Marketing — listing photos (Vercel Blob)

Lets the agent attach real listing photos, shown alongside the AI-generated description and
social posts. Uploads go straight from the browser to Blob storage (not through this app's
server), so large photos don't hit Vercel's request size limits.

1. From the Vercel dashboard: Storage → Create → Blob, or via CLI: `vercel blob create-store
   <name> --access public --yes` from this project's directory (run once, connects automatically).
2. That pulls a `BLOB_READ_WRITE_TOKEN` into your environment — no manual `.env` edit needed if
   you used the CLI; otherwise copy it from the dashboard.
3. Without this, the Marketing page shows an "add a Blob store" banner instead of the upload
   field — description/social-post generation still works fine without it.

### Marketing — auto-post new listings to Instagram (Meta Graph API)

Opt-in, off by default, toggled from `/dashboard/settings` → **Automation**. When on, the moment a
new listing is generated with a photo, it auto-publishes straight to Instagram (no review step) —
this is more setup than Twilio/Resend since Instagram has no simple pasteable API key. **Live-tested
end to end 2026-08-02** using the path below (the newer Instagram API with Instagram Login — no
Facebook Page required at all, unlike older Instagram Graph API guides):

1. Convert the target Instagram account to a **Business** or **Creator** account (Instagram app →
   Settings → Account type) if it isn't already — personal accounts can't use the publishing API.
2. Create a **Meta Developer App** at https://developers.facebook.com/apps (this needs a **Business
   Portfolio** to own it — Meta imposes an account-age cooldown on creating one with a brand-new
   Facebook account; if you hit "your account is too new," it clears within about an hour).
3. Add the **"Manage messaging & content on Instagram"** use case (under the "Content management"
   filter, not the default "Featured" list), then go to **Use cases → Customize → API setup with
   Instagram login**.
4. Click **"Add all required permissions"**, then separately find and add
   `instagram_business_content_publish` from the full "Permissions and features" list — it's not
   included in the one-click shortcut but is the specific permission actual publishing needs.
5. Add the Instagram account as an **Instagram Tester** under the app's **Roles** tab — the account
   itself then has to accept that invite from its own Instagram Settings → Apps and Websites →
   Tester Invites before the connection completes.
6. Back on "API setup with Instagram login," click **"Add account"** and authorize as that Instagram
   account (confirms it as a Business account along the way if needed). This also surfaces the
   Instagram **Business Account ID** directly in the connected-account list.
7. Click **"Generate token"** next to the connected account. **Before doing anything else with it**,
   paste it into the Access Token Debugger (developers.facebook.com/tools/debug/accesstoken/) and
   check what it shows — as of 2026-08, this button has been observed issuing an **already
   long-lived token directly** (~60 days, `Type: User`, correct scopes attached), not the
   short-lived token the older exchange flow below assumes. If the debugger already shows a long
   expiry and `Valid: True`, **skip the exchange step entirely** and use that token as-is — running
   an already-long-lived token through the exchange call below fails with a confusing
   `"Session key invalid... incorrect format"` error (this cost real hours to debug once; don't
   assume the exchange step is still needed without checking first).

   If the debugger instead shows a short expiry (~1 hour), the token genuinely is short-lived and
   needs the exchange — open this URL directly in a browser with your own values substituted (do
   this yourself rather than pasting either token into a chat session, even a throwaway-account
   one):
   ```
   https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=YOUR_APP_SECRET&access_token=YOUR_SHORT_LIVED_TOKEN
   ```
   A successful response looks like `{"access_token":"...","expires_in":5184000}`.
8. Add to `.env` (and Vercel's project env for production):
   ```
   INSTAGRAM_ACCESS_TOKEN="..."
   INSTAGRAM_BUSINESS_ACCOUNT_ID="..."
   ```

Requires a photo on the listing (Instagram's API needs an image) and a generated Instagram post —
without either, the listing still generates normally, it just doesn't attempt to post. Any failure
(expired token, no tester access, a real API error) gets recorded on the listing and shown on the
Marketing page rather than failing the whole generation. Publishing itself is a create-container →
poll-until-ready → publish flow (`src/lib/instagram.server.ts`) — a real live test found that photos
aren't always instantly ready to publish the moment the container is created, despite what older
docs suggest, so this app polls the container's processing status before publishing rather than
assuming it's done.

### Marketing — auto-post new listings to Facebook (Meta Graph API)

Same toggle pattern as Instagram, separate credentials. This one uses a **Facebook Page**, not the
Instagram-Login token above — Facebook Page posting and Instagram posting are genuinely different
APIs under the same Meta umbrella.

1. You need a Facebook Page (create one via Meta Business Suite if the agent doesn't already have
   one for their business).
2. In the same Meta Developer App used for Instagram (or a new one), use the **Graph API
   Explorer** (Tools → Graph API Explorer): select your app, add the `pages_manage_posts` +
   `pages_read_engagement` + `business_management` + `pages_show_list` permissions, generate a
   **User Token** (not "Page" in the dropdown — see the real gotcha below for why).
3. **Extend the User Token to long-lived first**: click the (i) icon next to the Access Token box →
   "Open in Access Token Tool" → "Extend Access Token." Confirm the result shows an expiry ~60 days
   out, not "in about an hour" — the tool sometimes silently gives you a fresh short-lived token
   instead if you don't check.
4. **Fetch the Page token from that long-lived User Token** — the Explorer's own "User or Page"
   dropdown method does *not* reliably produce a token that actually acts as the page (see gotcha
   below). Instead, with the extended User Token still loaded, run a **GET** request (not POST) to:
   ```
   me/accounts?fields=id,name,access_token
   ```
   and copy the nested `access_token` for your Page from the response.
5. **This Page token is still short-lived (~1 hour) even though it came from a long-lived User
   Token** — it needs its own separate exchange. Get the app's core secret from **App settings →
   Basic → App secret** (different from the Instagram-specific secret if this app also has
   Instagram set up), then visit this URL directly in your browser (substituting your real values):
   ```
   https://graph.facebook.com/v26.0/oauth/access_token?grant_type=fb_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&fb_exchange_token=YOUR_PAGE_TOKEN_FROM_STEP_4
   ```
   A successful response looks like `{"access_token":"...","token_type":"bearer","expires_in":5110099}`
   — `expires_in` in seconds, divide by 86400 for days (~59 days is normal, confirms it worked).
6. Note the Page's ID (already visible in step 4's response, alongside the token).
7. Add to `.env` (and Vercel's project env for production):
   ```
   FACEBOOK_PAGE_ACCESS_TOKEN="..."
   FACEBOOK_PAGE_ID="..."
   ```

**Real gotchas worth banking, found the hard way 2026-08-02/03**:
- The Explorer's "User or Page" dropdown + "Generate Access Token" button does *not* reliably
  produce a token that Meta treats as genuinely acting-as-the-page — a real live test failed with
  `(#200) Unpublished posts must be posted to a page as the page itself` despite the token looking
  correct (right permissions, "Page" selected). The `me/accounts` fetch in step 4 is the actual
  correct method.
- A Page token derived from a genuinely long-lived (60-day) User Token is **still only short-lived
  by default** — confirmed twice, with two different derivation methods (`me/accounts` and
  `/{page-id}?fields=access_token`), both gave back a token expiring in ~1 hour. Extending the User
  Token does not carry over automatically; the Page token needs its own explicit `fb_exchange_token`
  call (step 5) to actually become long-lived. Skipping this step is why this token kept expiring
  every few hours throughout initial setup.

A single photo publishes with one call (`POST /{page-id}/photos` with the image URL + caption) — no
container/poll step like Instagram's flow needs. Multiple photos (2+) use a real multi-photo post
instead: each photo uploaded unpublished (`published=false`), then one `/feed` post referencing all
of them via `attached_media`. Same graceful-failure behavior throughout: requires a photo and a
generated Facebook post, records success/failure on the listing, never fails generation itself.

### Marketing — auto-post new listings to TikTok (Content Posting API)

Same opt-in toggle location as Instagram/Facebook, but genuinely different underneath: TikTok has
**no static, manually-obtained token option**. It requires real per-agent OAuth (connected from
inside the app, not pasted from a console), and posts a **photo post** (the listing's photo +
caption), not the on-camera video script shown elsewhere on the Marketing page — there's no video
in this app to post, and TikTok's API requires actual media, not just text.

**Important limitation to know going in**: until TikTok approves this app for public posting (an
audit process, see step 2), every post this feature makes is restricted to **`SELF_ONLY`** — it
publishes successfully, but is visible only to the connected TikTok account itself, not the public.
The Settings page and the listing history both say this plainly; it isn't hidden in fine print.

1. Create a **TikTok Developer app** at https://developers.tiktok.com/apps (needs a TikTok
   account).
2. Add the **Content Posting API** product to the app and request the `video.publish` scope. TikTok
   gates whether that scope can post *publicly* behind their own app review (typically 2-4 weeks) —
   until it's approved, the app can still connect and post, just `SELF_ONLY` (see above).
3. Register the **redirect URI** in the app's settings — it must exact-match what this app sends,
   which is `<your domain>/api/tiktok/callback`. Register the production one
   (`https://your-domain.com/api/tiktok/callback`); if testing locally, register a `localhost`
   version too and set `APP_URL="http://localhost:3000"` in `.env` so the app builds the matching
   redirect URI.
4. Add to `.env` (and Vercel's project env for production):
   ```
   TIKTOK_CLIENT_KEY="..."
   TIKTOK_CLIENT_SECRET="..."
   ```
5. From `/dashboard/settings` → **Automation**, click **"Connect TikTok"** — this is a real in-app
   OAuth flow (unlike Instagram/Facebook's paste-a-token-you-got-elsewhere setup), so it walks
   through TikTok's own consent screen and comes back automatically. Once connected, turn the
   auto-post toggle on.

Nothing to babysit on the token itself: access tokens expire every 24 hours and refresh
automatically right before each post; refresh tokens last a year and TikTok may rotate them on
every use, which this app also handles automatically (both get saved back after every refresh, see
`src/lib/tiktok.server.ts`). The one thing worth knowing: if this feature goes completely unused
for over a year, the refresh token itself would go stale and reconnecting via step 5 again would be
needed.

Requires a photo on the listing (TikTok's photo-post API needs at least one image) and a generated
TikTok post — without either, the listing still generates normally, it just doesn't attempt to
post. Any failure (not connected, token refresh failed, a real API error) gets recorded on the
listing and shown on the Marketing page rather than failing the whole generation.

### Sphere — Google Contacts birthdays + Gmail thread history (Google OAuth)

Two read-only features powered by one Google connection: an upcoming-birthday reminder for Sphere
contacts (sourced from the agent's real Google Contacts, matched by email), and on-demand real
Gmail thread history on any Lead or Contact card with an email address. Nothing is ever sent —
purely reads. No enabled/disabled toggle in Settings the way auto-post/auto-nurture have one;
connecting already means it's on.

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com), then enable
   two APIs for it: **People API** and **Gmail API** (APIs & Services → Library → search each by
   name → Enable).
2. Configure the **OAuth consent screen** (APIs & Services → OAuth consent screen). Keep it in
   **Testing** status — publishing to Production triggers Google's security assessment for
   restricted scopes (Gmail read access is one), which this single-agent app doesn't need. Testing
   mode allows up to 100 test users with no assessment required. Add the real agent's Google
   account under **Test users**.
3. Create credentials (APIs & Services → Credentials → Create Credentials → OAuth client ID), type
   **Web application**. Add an authorized redirect URI, exact match:
   `<your domain>/api/google/callback` (e.g. `https://real-estate-assistant-ochre.vercel.app/api/google/callback`).
4. Add to `.env` (and Vercel's project env for production):
   ```
   GOOGLE_CLIENT_ID="..."
   GOOGLE_CLIENT_SECRET="..."
   ```
5. From `/dashboard/settings` → **Google**, click **"Connect Google"** — a real in-app OAuth flow
   through Google's own consent screen. Since the app is in Testing mode, Google shows an
   "unverified app" warning on the consent screen for anyone other than a listed test user — click
   "Advanced" → "Go to [app name] (unsafe)" to proceed; this is expected for a Testing-mode app,
   not a sign of misconfiguration.
6. Click **"Sync birthdays now"** to pull birthdays immediately rather than waiting for the next
   scheduled cron run. Only Sphere contacts whose email matches a Google Contact that has a
   birthday set will pick one up — no birthday, no matching email, or no email on either side all
   mean that contact is silently skipped, not an error.

**Not yet confirmed**: whether `birthdays` is actually populated on a `people.connections.list`
response under `contacts.readonly` alone, or genuinely needs the extra `user.birthday.read` scope
also requested here. Both are requested up front regardless, so this only matters for
understanding *why* it works, not for setup — but if a real Google Contact with a birthday set
returns an empty `birthdays` array after connecting, that's the first thing to check.

Gmail thread history loads on click ("Load email history (Gmail)" on a Lead/Contact card),
deliberately not automatically on page load — calling Gmail once per row every time the Leads or
Sphere page renders would be a real rate-limit risk with no caching layer built for it.

### Calls (missed-call auto-text) — Twilio

This one has more setup because it involves a real phone number and SMS compliance:

1. Create a Twilio account, buy a phone number.
2. **Register for A2P 10DLC** (US business text-messaging registration) — required to send SMS
   reliably in the US, takes a few days to get approved. Skipping this makes texts unreliable or
   blocked by carriers.
3. Add to `.env`:
   ```
   TWILIO_ACCOUNT_SID="AC..."
   TWILIO_AUTH_TOKEN="..."
   TWILIO_PHONE_NUMBER="+15551234567"
   AGENT_FORWARDING_PHONE="+15557654321"   # the agent's real cell, rings first
   ```
4. **Only after this app is deployed to a public URL** (see below — this does not work against
   `localhost`), open the phone number's config in the Twilio console and set "A call comes in" to
   a webhook: `https://your-domain.com/api/twilio/voice` (HTTP POST).

The `/dashboard/calls` page repeats these steps in context.

### Automation — daily digest + auto-nurture (scheduled job)

Everything else in this app is pull-based: the "needs attention" items, the nurture cadence, and
the deadline warnings only surface when the agent opens the dashboard. The automation job pushes
instead — it runs on a schedule and reaches the agent (and their sphere) without anyone logging in.

Two behaviours, each toggled from `/dashboard/settings` → **Automation**:

- **Daily digest** (on by default): one email each morning listing stale leads, upcoming
  deadlines, buyer showings coming up, and sphere contacts due for a check-in. Only sends on days
  something actually needs attention. Needs the **Resend** keys above to reach the inbox.
- **Auto-send sphere check-ins** (off by default): when a contact passes their 90-day cadence,
  Claude drafts and Resend sends a warm check-in with no review step (capped at five per day,
  contacts without an email are skipped). Needs both **Anthropic** and **Resend** keys. This is
  real unsupervised outbound, so it stays off until you turn it on — the draft-and-review flow on
  the Sphere page works regardless.

To run it on a schedule:

1. Generate a secret: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`
2. Add to `.env` (and your Vercel project env): `CRON_SECRET="paste-that-here"`
3. `vercel.json` already declares a daily cron hitting `/api/cron` at 13:00 UTC. Vercel sends that
   request with `Authorization: Bearer $CRON_SECRET`, which the endpoint checks — without the
   secret set, the endpoint refuses to run rather than sit open to the internet.
4. Optionally set `APP_URL="https://your-domain.com"` so the digest email can link back into the
   dashboard (on Vercel it falls back to the deployment URL automatically).

To trigger a run by hand (e.g. to test): `curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/cron`

#### Listing sync (auto-onboard new listings from a public agent site)

Same cron, one more opt-in step: `syncNewListings()` (`src/lib/listing-sync.server.ts`) checks a
public Century 21 agent site for new listings credited to the agent and runs each one through the
real Marketing pipeline — same Claude-generated description/social copy and auto-post behaviour as
adding a listing by hand on `/dashboard/marketing`, just unattended. A listing already onboarded
(tracked by its source URL) is never re-created or re-posted on a later run, and at most 3 new
listings are onboarded per run so a busy day can't blow the cron's time budget.

Add to `.env` (and your Vercel project env): `LISTING_SYNC_FEED_URL="https://<agent-site>/listings/<active-listings-page>"`

Unset means this step is a no-op, same as every other integration in this app — nothing to disable
if you don't use it. Requires `CRON_SECRET` (above) already configured, since it only ever runs
inside the scheduled `/api/cron` job.

### Calendar feed (subscribe from Google / Apple / Outlook)

No external account needed. From `/dashboard/settings` → **Calendar**, generate a link and paste it
into Google Calendar (*Other calendars → From URL*), Apple Calendar (*File → New Calendar
Subscription*), or Outlook. It serves a live iCal feed of closing dates, open transaction
deadlines, and buyer showings that the calendar app refreshes on its own schedule. The link is
authenticated only by the unguessable token in the URL — "Regenerate" rotates it (revoking the old
one) and "Turn off" disables the feed. Set `APP_URL` so the settings page can show the full
subscription URL rather than a relative path.

## Before deploying: swap SQLite for a real database

SQLite is a single file (`dev.db`) — that works locally but **will not persist** on serverless
hosting (Vercel, etc. — the filesystem resets between requests). Before deploying:

1. Get a free hosted Postgres — Vercel Postgres or [Neon](https://neon.tech) both have free tiers.
2. In `prisma/schema.prisma`, change:
   ```prisma
   datasource db {
     provider = "sqlite"
   }
   ```
   to:
   ```prisma
   datasource db {
     provider = "postgresql"
   }
   ```
3. Swap the driver adapter in `src/lib/db.server.ts` and `prisma/seed.ts` from
   `@prisma/adapter-better-sqlite3` to `@prisma/adapter-pg` (`npm install @prisma/adapter-pg`,
   `npm uninstall @prisma/adapter-better-sqlite3`), and update `DATABASE_URL` in `.env` to the
   Postgres connection string.
4. Run `npx prisma migrate dev` again to create the schema on the new database, then re-seed.
5. Generate a fresh `SESSION_SECRET` for production — don't reuse the local dev one:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

## Deploying

Vercel is the simplest target for this stack (Next.js + Prisma). After the Postgres swap above:
push to a git repo, import it in Vercel, and add all the env vars from `.env` in the Vercel
project settings (never commit `.env` itself — it's already gitignored).
