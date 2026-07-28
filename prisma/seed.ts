import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "agent@example.com";
  const password = "changeme123";
  const passwordHash = await bcrypt.hash(password, 10);

  const agent = await prisma.agent.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      name: "Demo Agent",
      businessName: "Demo Realty",
    },
  });

  console.log(`Seeded agent: ${agent.email} (password: ${password} — change this after first login)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
