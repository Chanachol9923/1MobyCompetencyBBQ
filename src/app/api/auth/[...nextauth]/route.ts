import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;

// Prisma needs the Node runtime; the Edge-safe half lives in auth.config.ts.
export const runtime = "nodejs";
