// Mints a valid session cookie for the app's sole seeded Agent, without going
// through the login form (which is a Next.js Server Action and awkward to
// drive with a plain HTTP client). Prints the raw cookie value to stdout.
//
// Run from the project root: npx tsx .claude/skills/run-real-estate-assistant/mint-session.ts
//
// Requires the node_modules/server-only stub described in this skill's
// SKILL.md -- @/lib/db.server imports the real "server-only" package, which
// Next.js's bundler normally aliases away but plain tsx will try to resolve
// for real.
import "dotenv/config";
import { prisma } from "@/lib/db.server";
import { encrypt } from "@/lib/session.server";

async function main() {
  const agent = await prisma.agent.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const session = await encrypt({ agentId: agent.id, expiresAt: expiresAt.toISOString() });
  console.log(session);
  await prisma.$disconnect();
}

main();
