import type { NextAuthConfig } from "next-auth";

/**
 * The half of the auth config that must run on the Edge (middleware).
 *
 * It deliberately contains no providers and no Prisma import: middleware only
 * decides "is there a session at all", by reading the signed JWT cookie. Every
 * real permission check happens server-side next to the data it protects, and
 * the providers that check passwords live in `auth.ts`.
 */
export const authConfig = {
  providers: [],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    // JWT keeps the hot path off the database; the claims inside it are
    // refreshed from the database every few minutes (see auth.ts)
    strategy: "jwt",
    // a working day plus margin — sign in once in the morning, stay in
    maxAge: 60 * 60 * 12,
  },
  trustHost: true,
} satisfies NextAuthConfig;
