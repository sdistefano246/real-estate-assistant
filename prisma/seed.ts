import "dotenv/config";
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
  const email = process.env.SEED_AGENT_EMAIL ?? "agent@example.com";
  const password = process.env.SEED_AGENT_PASSWORD ?? "changeme123";
  const name = process.env.SEED_AGENT_NAME ?? "Demo Agent";
  const businessName = process.env.SEED_AGENT_BUSINESS ?? "Demo Realty";
  const passwordHash = await bcrypt.hash(password, 10);

  const agent = await prisma.agent.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, name, businessName },
  });

  console.log(`Seeded agent: ${agent.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
