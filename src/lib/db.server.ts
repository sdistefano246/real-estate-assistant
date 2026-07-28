import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function resolveConnectionString() {
  // Vercel's Postgres integration (Neon-backed) sometimes names the var
  // differently depending on how it was connected — check the common ones.
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "No database connection string found — set DATABASE_URL (or POSTGRES_URL / POSTGRES_PRISMA_URL) in the environment."
    );
  }
  return url;
}

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: resolveConnectionString() });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
