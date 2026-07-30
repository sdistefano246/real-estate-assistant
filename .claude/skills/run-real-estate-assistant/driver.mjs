#!/usr/bin/env node
// Drives a headless Chromium against the running dev server with a valid
// session cookie already set, navigates to the given path, and screenshots
// the result. See SKILL.md for the full setup this depends on.
//
// Usage: node .claude/skills/run-real-estate-assistant/driver.mjs <path> <sessionCookieValue> [screenshotOutPath]
// Example:
//   COOKIE=$(npx tsx .claude/skills/run-real-estate-assistant/mint-session.ts)
//   node .claude/skills/run-real-estate-assistant/driver.mjs /dashboard/marketing "$COOKIE" ./screenshot.png

import { chromium } from "playwright";

const [, , pathArg, cookieValue, outPath] = process.argv;

if (!pathArg || !cookieValue) {
  console.error("Usage: node driver.mjs <path> <sessionCookieValue> [screenshotOutPath]");
  process.exit(1);
}

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const screenshotPath = outPath || "./screenshot.png";

async function main() {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  await context.addCookies([
    {
      name: "session",
      value: cookieValue,
      domain: new URL(BASE_URL).hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  const url = new URL(pathArg, BASE_URL).toString();
  await page.goto(url, { waitUntil: "networkidle" });

  await page.screenshot({ path: screenshotPath, fullPage: true });

  console.log("URL:", page.url());
  console.log("Title:", await page.title());
  console.log("Screenshot:", screenshotPath);
  console.log(
    "Console errors:",
    consoleErrors.length > 0 ? JSON.stringify(consoleErrors, null, 2) : "none"
  );

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
