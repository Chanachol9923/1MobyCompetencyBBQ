import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 reads connection URLs from here rather than from the schema.
 *
 * Supabase gives two URLs, both through the Supavisor pooler:
 *   DATABASE_URL  — transaction mode, port 6543. What the app uses at runtime,
 *                   because serverless functions must not hold real connections.
 *   DIRECT_URL    — session mode, port 5432. Migrations need this; transaction
 *                   mode cannot hold the advisory lock `migrate deploy` takes.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
