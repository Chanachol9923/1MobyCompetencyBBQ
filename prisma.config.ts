import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 reads connection URLs from here rather than from the schema.
 *
 * Supabase gives two URLs:
 *   DATABASE_URL  — pooled (pgBouncer, port 6543). What the app uses at runtime,
 *                   because serverless functions must not hold real connections.
 *   DIRECT_URL    — direct (port 5432). Migrations need this; pgBouncer in
 *                   transaction mode cannot run DDL or advisory locks.
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
