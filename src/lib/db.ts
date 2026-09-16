import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * One Prisma client per process.
 *
 * Next.js in development re-evaluates modules on every hot reload, which would
 * otherwise open a new pool each time until Postgres refuses connections. In
 * production on a serverless host each instance keeps exactly one pool, and the
 * pool talks to Supabase's pgBouncer, so a burst of function invocations does
 * not translate into a burst of real Postgres connections.
 */

const connectionString = process.env.DATABASE_URL;

function createClient() {
  if (!connectionString) {
    // Fail loudly and early rather than at the first query deep inside a page.
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill in the Supabase connection strings.",
    );
  }
  const adapter = new PrismaPg({
    connectionString,
    // serverless: keep the pool small, let pgBouncer do the multiplexing
    max: Number(process.env.DB_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/** True when the app has been given a database to talk to. */
export const hasDatabase = Boolean(connectionString);
