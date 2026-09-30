import NextAuth, { CredentialsSignin, type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { Provider } from "next-auth/providers";
import { db } from "./db";
import { authConfig } from "./auth.config";
import { isValidLoginId, normaliseLoginId } from "./login-id";
import { hashPassword, verifyPassword } from "./password";
import { loadTestAccounts } from "@/server/test-accounts";

/**
 * Single sign-on for the whole system.
 *
 * One company account — name.sur@1moby.com — opens every module: assessment,
 * IDP, learning, rewards and administration. Accounts are never self-created.
 * An administrator provisions each one, links it to the staff record and gives
 * it a role; the person activates it with a one-time link and sets their own
 * password. Nothing here can create a User.
 *
 * When 1Moby's own identity provider is ready, setting AUTH_SSO_* federates the
 * same accounts through OIDC: the provider vouches for the email, and the
 * account must still have been provisioned here first.
 */

/** How long a cached role/permission set may live in the JWT before we re-read it. */
const CLAIMS_TTL_MS = 5 * 60 * 1000;

/** Five wrong passwords in a row locks the account for fifteen minutes. */
const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60 * 1000;

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      status: "PENDING" | "ACTIVE" | "SUSPENDED";
      roleKey: string | null;
      permissions: string[];
      employeeId: string | null;
      employeeName: string | null;
      jobRole: string | null;
      /** when this session was opened (ms) — older than a password change means stale */
      authAt: number;
    } & DefaultSession["user"];
  }
}

type Claims = {
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  roleKey: string | null;
  permissions: string[];
  employeeId: string | null;
  employeeName: string | null;
  jobRole: string | null;
};

const EMPTY_CLAIMS: Claims = {
  status: "PENDING",
  roleKey: null,
  permissions: [],
  employeeId: null,
  employeeName: null,
  jobRole: null,
};

async function loadClaims(userId: string): Promise<Claims> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      role: {
        select: {
          key: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
      employee: {
        select: { id: true, name: true, jobRole: { select: { name: true } } },
      },
    },
  });
  if (!user) return EMPTY_CLAIMS;
  return {
    status: user.status,
    roleKey: user.role?.key ?? null,
    permissions: user.role?.permissions.map((p) => p.permission.key) ?? [],
    employeeId: user.employee?.id ?? null,
    employeeName: user.employee?.name ?? null,
    jobRole: user.employee?.jobRole.name ?? null,
  };
}

/* ----------------------------------------------------------- sign-in errors */

/**
 * The codes the login screen can explain. Wrong id and wrong password share one
 * code on purpose, so the form cannot be used to find out who has an account.
 */
export type SignInCode = "invalid" | "locked" | "suspended" | "not_activated";

class SignInRefused extends CredentialsSignin {
  constructor(code: SignInCode) {
    super();
    this.code = code;
  }
}

/**
 * Checked against when the login id does not exist, so an unknown id costs the
 * same scrypt time as a known one and response timing gives nothing away.
 */
let decoyHash: Promise<string> | null = null;
function decoy() {
  decoyHash ??= hashPassword("decoy-password-never-matches-0");
  return decoyHash;
}

async function signInWithPassword(loginIdRaw: unknown, passwordRaw: unknown) {
  const loginId = normaliseLoginId(String(loginIdRaw ?? ""));
  const password = String(passwordRaw ?? "");
  if (!loginId || !password || password.length > 128) throw new SignInRefused("invalid");

  const user = isValidLoginId(loginId)
    ? await db.user.findUnique({
        where: { email: loginId },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          status: true,
          passwordHash: true,
          failedLoginCount: true,
          lockedUntil: true,
        },
      })
    : null;

  if (!user) {
    await verifyPassword(password, await decoy());
    throw new SignInRefused("invalid");
  }

  // a lock is checked before the password, so guessing during it is useless
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new SignInRefused("locked");
  }

  if (!user.passwordHash) {
    // provisioned but never activated — say so, it is the likeliest confusion
    await verifyPassword(password, await decoy());
    throw new SignInRefused(user.status === "SUSPENDED" ? "invalid" : "not_activated");
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const failures = user.failedLoginCount + 1;
    const lock = failures >= MAX_FAILED_LOGINS;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: lock ? 0 : failures,
        lockedUntil: lock ? new Date(Date.now() + LOCK_MS) : null,
      },
    });
    throw new SignInRefused(lock ? "locked" : "invalid");
  }

  // only someone who knows the password learns that the account is suspended
  if (user.status === "SUSPENDED") throw new SignInRefused("suspended");
  if (user.status !== "ACTIVE") throw new SignInRefused("not_activated");

  await db.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  return { id: user.id, email: user.email, name: user.name, image: user.image };
}

/* --------------------------------------------------------------- providers */

// test mode: the login screen suggests the seeded accounts and fills in their
// password. Every sign-in still goes through the password check below.
const demoLoginEnabled = process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true";

const providers: Provider[] = [
  Credentials({
    id: "company",
    name: "1Moby account",
    credentials: {
      loginId: { label: "Login ID", type: "email" },
      password: { label: "Password", type: "password" },
    },
    authorize: (credentials) =>
      signInWithPassword(credentials?.loginId, credentials?.password),
  }),
];

// Test mode: the three suggested test accounts sign in without their
// password, so testing keeps working after someone changes or resets one.
// Only those accounts, only while the flag is on; typing a password still
// goes through the real check above.
if (demoLoginEnabled) {
  providers.push(
    Credentials({
      id: "test",
      name: "Test account",
      credentials: { account: { label: "Account", type: "text" } },
      async authorize(credentials) {
        const loginId = normaliseLoginId(String(credentials?.account ?? ""));
        const allowed = await loadTestAccounts();
        if (!allowed.some((a) => a.loginId === loginId)) return null;
        const user = await db.user.findUnique({
          where: { email: loginId },
          select: { id: true, email: true, name: true, image: true, status: true },
        });
        if (!user || user.status !== "ACTIVE") return null;
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
        });
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  );
}

// Federation to the company identity provider, when one is configured.
const ssoEnabled = Boolean(
  process.env.AUTH_SSO_ISSUER &&
    process.env.AUTH_SSO_CLIENT_ID &&
    process.env.AUTH_SSO_CLIENT_SECRET,
);
if (ssoEnabled) {
  providers.push({
    id: "sso",
    name: process.env.AUTH_SSO_NAME ?? "1Moby SSO",
    type: "oidc",
    issuer: process.env.AUTH_SSO_ISSUER,
    clientId: process.env.AUTH_SSO_CLIENT_ID,
    clientSecret: process.env.AUTH_SSO_CLIENT_SECRET,
  });
}

/** Resolve an identity-provider login to the provisioned account, or refuse it. */
async function accountForSso(email: string | null | undefined) {
  const loginId = normaliseLoginId(email ?? "");
  if (!isValidLoginId(loginId)) return null;
  const user = await db.user.findUnique({
    where: { email: loginId },
    select: { id: true, status: true },
  });
  if (!user || user.status === "SUSPENDED") return null;
  return user;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  logger: {
    error(error) {
      // a wrong password is an expected outcome, not a server fault
      if ((error as { type?: string }).type === "CredentialsSignin") return;
      console.error(error);
    },
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "sso") return true;
      // the identity provider proves who this is; this system decides whether
      // they may come in — only an account an administrator provisioned
      const existing = await accountForSso(user.email);
      if (!existing) return "/login?error=not_provisioned";
      await db.user.update({
        where: { id: existing.id },
        data: {
          // the IdP vouching for the address is the activation
          status: "ACTIVE",
          failedLoginCount: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
        },
      });
      return true;
    },

    async jwt({ token, user, account, trigger }) {
      if (user) {
        // on the sign-in request: pin the token to our own account id (for OIDC
        // the provider's subject id is not ours)
        if (account?.provider === "sso") {
          const existing = await accountForSso(user.email);
          if (existing) token.uid = existing.id;
        } else if (user.id) {
          token.uid = user.id;
        }
        token.authAt = Date.now();
      }
      const uid = token.uid as string | undefined;
      if (!uid) return token;

      const stale =
        typeof token.claimsAt !== "number" ||
        Date.now() - token.claimsAt > CLAIMS_TTL_MS;

      // Re-read on sign-in, on an explicit session.update(), or once the cached
      // copy ages out — so an admin changing someone's role takes effect without
      // that person signing out.
      if (user || trigger === "update" || stale) {
        const claims = await loadClaims(uid);
        Object.assign(token, claims, { claimsAt: Date.now() });
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = (token.uid as string) ?? "";
      session.user.status = (token.status as Claims["status"]) ?? "PENDING";
      session.user.roleKey = (token.roleKey as string | null) ?? null;
      session.user.permissions = (token.permissions as string[]) ?? [];
      session.user.employeeId = (token.employeeId as string | null) ?? null;
      session.user.employeeName = (token.employeeName as string | null) ?? null;
      session.user.jobRole = (token.jobRole as string | null) ?? null;
      session.user.authAt = typeof token.authAt === "number" ? token.authAt : 0;
      return session;
    },
  },
});

/** Which sign-in doors this deployment has open — read by the login page. */
export const signInOptions = {
  demo: demoLoginEnabled,
  sso: ssoEnabled ? (process.env.AUTH_SSO_NAME ?? "1Moby SSO") : null,
};
