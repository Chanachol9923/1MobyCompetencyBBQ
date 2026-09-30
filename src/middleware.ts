import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

/**
 * Edge middleware only answers "is anyone signed in", because Prisma cannot run
 * here. Real permission checks live next to the data, in server components and
 * server actions, which is where they cannot be bypassed.
 */
const { auth } = NextAuth(authConfig);

const PUBLIC = ["/login", "/activate/", "/api/auth", "/_next", "/favicon.ico"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  if (!req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:png|jpg|svg|webp)$).*)"],
};
