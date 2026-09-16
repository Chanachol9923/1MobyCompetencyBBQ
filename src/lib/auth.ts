import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "./db";
import { authConfig } from "./auth.config";

/** How long a cached role/permission set may live in the JWT before we re-read it. */
const CLAIMS_TTL_MS = 5 * 60 * 1000;

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
      isDemo: boolean;
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


/** A demo persona gets the role their position implies. */
async function pickRoleForEmployee(employeeId: string): Promise<string> {
  const reports = await db.employee.count({ where: { managerId: employeeId } });
  return reports > 0 ? "manager" : "employee";
}

async function upsertDemoUser(email: string, name: string, roleKey: string) {
  const role = await db.role.findUnique({ where: { key: roleKey }, select: { id: true } });
  return db.user.upsert({
    where: { email },
    // note: no status here — a suspended account stays suspended, and the
    // caller has already refused it
    update: { roleId: role?.id ?? undefined },
    create: { email, name, status: "ACTIVE", roleId: role?.id ?? null },
    select: { id: true, email: true, name: true, image: true },
  });
}

const demoLoginEnabled =
  process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  providers: [
    ...authConfig.providers,
    // Walk-through accounts for demos. Guarded by an env flag so a real
    // deployment simply does not have this door.
    Credentials({
      id: "demo",
      name: "Demo account",
      credentials: { account: { label: "Account", type: "text" } },
      async authorize(credentials) {
        if (!demoLoginEnabled) return null;
        const key = String(credentials?.account ?? "").trim();
        if (!key) return null;

        // a demo key is either a staff employee code or the email of a seeded
        // account that has no staff record, such as the HROD administrator
        const employee = await db.employee.findFirst({
          where: { OR: [{ employeeCode: key }, { email: key }] },
          select: { id: true, name: true, email: true, userId: true, jobRole: { select: { name: true } } },
        });

        if (employee) {
          const suspended = await db.user.findUnique({
            where: { email: employee.email },
            select: { status: true },
          });
          if (suspended?.status === "SUSPENDED") return null;

          const roleKey = await pickRoleForEmployee(employee.id);
          const user = await upsertDemoUser(employee.email, employee.name, roleKey);
          if (!employee.userId) {
            await db.employee.update({
              where: { id: employee.id },
              data: { userId: user.id },
            });
          }
          return user;
        }

        // no staff record: only an already-seeded ACTIVE user may sign in this way
        const existing = await db.user.findUnique({
          where: { email: key },
          select: { id: true, email: true, name: true, image: true, status: true },
        });
        if (!existing || existing.status !== "ACTIVE") return null;
        return existing;
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // A suspended account must not get a session at all. Checking here means
      // the provider callback refuses it, rather than handing out a token that
      // the next request has to bounce.
      if (user.email) {
        const existing = await db.user.findUnique({
          where: { email: user.email.toLowerCase() },
          select: { status: true },
        });
        if (existing?.status === "SUSPENDED") return "/login?error=suspended";
      }

      if (account?.provider !== "google" || !user.email) return true;

      const email = user.email.toLowerCase();
      const bootstrap = (process.env.BOOTSTRAP_ADMIN_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      // Link a Google login to the staff record with the same address, and give
      // it the role its position implies. Anyone without a matching employee
      // record stays PENDING until an admin approves them.
      const employee = await db.employee.findUnique({
        where: { email },
        select: { id: true, userId: true, _count: { select: { reports: true } } },
      });

      const roleKey = bootstrap.includes(email)
        ? "admin"
        : employee
          ? employee._count.reports > 0
            ? "manager"
            : "employee"
          : null;

      if (!roleKey) return true; // PENDING, nothing to link yet

      const role = await db.role.findUnique({
        where: { key: roleKey },
        select: { id: true },
      });

      const dbUser = await db.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (!dbUser) return true; // adapter creates it, next sign-in links

      await db.user.update({
        where: { id: dbUser.id },
        data: { status: "ACTIVE", roleId: role?.id ?? undefined },
      });
      if (employee && !employee.userId) {
        await db.employee.update({
          where: { id: employee.id },
          data: { userId: dbUser.id },
        });
      }
      return true;
    },

    async jwt({ token, user, trigger }) {
      if (user?.id) token.uid = user.id;
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
      session.user.isDemo = Boolean(token.isDemo);
      return session;
    },
  },
});
