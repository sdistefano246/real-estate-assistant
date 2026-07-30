---
name: run-real-estate-assistant
description: Build, run, and drive the Real Estate Assistant Next.js app. Use when asked to start the app, run it locally, screenshot a dashboard page, or visually verify a change in a real browser.
---

Next.js 16 app (App Router) with session-cookie auth and Prisma against a shared Neon
Postgres database (no separate local DB — dev and prod share one instance, so treat any
data you create as real and clean it up). Drive it via
`.claude/skills/run-real-estate-assistant/driver.mjs`, a small Playwright script — there
is no `chromium-cli` in this environment, so this driver is the harness. All paths below
are relative to this project's root (`20 - Real Estate Assistant/`), not to this skill
directory.

## Prerequisites

This project runs on Windows via Git Bash (MSYS). No OS packages needed beyond Node.js
(already required by the app itself) — everything else is `npm` packages.

```bash
npm run dev  # requires Node + npm already set up for this project (see SETUP.md)
```

## Setup

The driver needs Playwright, which is **not** a project dependency (kept out on purpose
— it's a verification tool, not something the app ships with). Install it temporarily,
each time you use this skill:

```bash
npm install --no-save playwright   # not saved to package.json
npx playwright install chromium    # only needed once per machine, cached after
```

You also need a way to get an authenticated session without driving the login form
(it's a Next.js Server Action, awkward to POST to directly). `mint-session.ts` in this
skill directory does that by calling `encrypt()` from `src/lib/session.server.ts`
against the app's sole seeded Agent row. It imports `@/lib/db.server`, which has a real
`import "server-only"` — Next's bundler normally aliases that away, but plain `tsx`
will try to resolve it for real and fail. Stub it:

```bash
mkdir -p node_modules/server-only
printf '{ "name": "server-only", "main": "index.js" }' > node_modules/server-only/package.json
printf '// stub\n' > node_modules/server-only/index.js
```

**Order matters**: create this stub *after* `npm install --no-save playwright` above,
not before — `npm install` prunes `node_modules` folders it doesn't recognize from
`package-lock.json`, including this stub, even though `--no-save` was used for the
actual package you asked for. Installing Playwright first, then stubbing, avoids
re-creating the stub twice.

## Build

No separate build step for local verification — `next dev` compiles routes on demand.

## Run (agent path)

1. Start the dev server in the background and wait for it to actually be ready:

   ```bash
   npm run dev &
   # or your agent's background-task mechanism; either way, wait for:
   # "✓ Ready in ###ms" in its output before continuing
   ```

2. Mint a session cookie for the seeded agent:

   ```bash
   COOKIE=$(npx tsx .claude/skills/run-real-estate-assistant/mint-session.ts)
   ```

3. Drive the browser to a dashboard path and screenshot it:

   ```bash
   MSYS_NO_PATHCONV=1 node .claude/skills/run-real-estate-assistant/driver.mjs \
     /dashboard/today "$COOKIE" ./screenshot.png
   ```

   `driver.mjs <path> <sessionCookieValue> [screenshotOutPath]` — `<path>` is any
   `/dashboard/...` route (or `/login`, which needs no cookie). Prints the final URL,
   page title, screenshot location, and any browser console errors. Screenshot defaults
   to `./screenshot.png` in the current directory if you omit the third argument —
   these aren't meant to be committed, clean them up after looking at them.

4. **Look at the screenshot** (read the PNG file) before declaring anything verified —
   a blank frame or a redirect-to-`/login` (meaning the cookie didn't take) both still
   "succeed" as far as the driver's exit code is concerned.

5. Clean up when done:

   ```bash
   rm -rf node_modules/server-only node_modules/playwright node_modules/playwright-core
   rm -f screenshot.png   # or wherever you pointed the third argument
   # stop the dev server (kill the port's listener, not just Ctrl-C the npm wrapper)
   ```

## Run (human path)

`npm run dev`, open `http://localhost:3000` in a real browser, log in with the demo
credentials in `SETUP.md`. Only meaningfully different from the agent path in that a
human already has a browser and doesn't need the cookie-minting step.

## Test

```bash
npx tsc --noEmit   # type-check
npx next build     # full production build, also catches ESLint issues
```

No automated test suite beyond these two — this project's actual verification pattern
is live checks against the real database and (as of this skill) a real browser, not a
unit-test suite.

---

## Gotchas

- **Git Bash mangles leading-slash arguments.** MSYS auto-converts anything that looks
  like a POSIX path — `/dashboard/today` becomes `c:/Program Files/Git/dashboard/today`
  — before it reaches `node`. `driver.mjs` will fail with `net::ERR_FILE_NOT_FOUND`
  pointing at a nonsense `c:/...` URL. Fix: prefix the command with
  `MSYS_NO_PATHCONV=1`, as shown above. This bit even the second run of this exact
  driver in this exact session — easy to forget.
- **`npm install` prunes untracked `node_modules` folders**, including the
  `server-only` stub, even when you pass `--no-save` for the package you're actually
  trying to add. If `mint-session.ts` suddenly fails with `Cannot find module
  'server-only'` after it worked a moment ago, you probably ran `npm install` again in
  between — recreate the stub.
- **The dev/prod database is shared** (Neon Postgres, no separate local instance). Any
  page you screenshot may show real data (real leads, real listings) — don't delete
  anything you didn't create yourself, and if you seed test data to exercise a specific
  UI state, prefix it clearly (e.g. `ZZTEST`) and delete it after.
- **A "1 Issue" badge in the bottom-left corner of a screenshot** is Turbopack's dev
  overlay reporting a transient recompile notification on a route's first hit in a
  fresh dev server — not necessarily a real problem. Reload and check the dev-tools
  popover (click the badge) before treating it as a bug.
- **Browser console errors will include noisy, harmless warnings** mirrored from the
  Next.js dev server's own stdout (e.g. a `pg` SSL-mode deprecation warning) — these
  show up via `driver.mjs`'s `console --errors`-style output but aren't real page
  errors. Read what they actually say before treating a non-empty "Console errors"
  list as a failure.

## Troubleshooting

- **`Cannot find module 'server-only'`** when running `mint-session.ts`: the stub is
  missing or was pruned by a subsequent `npm install`. Recreate it (see Setup).
- **`net::ERR_FILE_NOT_FOUND` at a `c:/...` URL** from `driver.mjs`: Git Bash mangled
  the path argument. Re-run with `MSYS_NO_PATHCONV=1` prefixed.
- **Screenshot shows the login page instead of the dashboard**: the session cookie
  didn't take. Confirm `mint-session.ts` actually printed a long token (not an empty
  line or an error) before passing it to `driver.mjs`, and that the dev server was
  fully "Ready" before minting (it needs `SESSION_SECRET` loaded from `.env`).
