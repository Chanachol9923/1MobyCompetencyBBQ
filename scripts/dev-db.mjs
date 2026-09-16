/**
 * A throwaway Postgres for local development.
 *
 * PGlite is real Postgres compiled to WebAssembly; `pglite-socket` puts it
 * behind a TCP port speaking the Postgres wire protocol, so `pg`, Prisma and
 * `psql` all talk to it exactly as they would to Supabase.
 *
 *   node scripts/dev-db.mjs
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/postgres
 *
 * This is a developer convenience only, and it stores data in .pglite/ on disk.
 * Production points at Supabase and nothing else changes.
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { mkdirSync } from "node:fs";

const DATA_DIR = process.env.PGLITE_DIR ?? "./.pglite";
const PORT = Number(process.env.PGLITE_PORT ?? 5433);

mkdirSync(DATA_DIR, { recursive: true });

const pg = await PGlite.create({ dataDir: DATA_DIR });
const server = new PGLiteSocketServer({
  db: pg,
  port: PORT,
  host: "127.0.0.1",
  // the default is a single connection, which a connection pool exhausts
  // immediately; queries are queued internally so this stays safe
  maxConnections: Number(process.env.PGLITE_MAX_CONNECTIONS ?? 20),
});

await server.start();
console.log(`PGlite listening on 127.0.0.1:${PORT}  (data in ${DATA_DIR})`);
console.log("DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:%d/postgres", PORT);

const shutdown = async () => {
  await server.stop();
  await pg.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
