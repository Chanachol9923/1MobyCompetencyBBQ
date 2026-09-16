import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * The half of the auth config that must run on the Edge (middleware).
 *
 * It deliberately contains no database adapter and no Prisma import: middleware
 * only decides "is there a session at all", and every real permission check
 * happens server-side next to the data it protects.
 */
export const authConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    // credentials-based demo sign-in requires JWT sessions, and JWT also keeps
    // the hot path off the database
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,
  },
  trustHost: true,
} satisfies NextAuthConfig;
