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
