import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString =
  process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error("Set DATABASE_URL before seeding.");
}
const adapter = new PrismaPg({ connectionString });
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
