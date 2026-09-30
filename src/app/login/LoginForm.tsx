"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { KeyRound, LogIn, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { AuthFrame, AuthInput, AuthNotice, PasswordInput } from "@/components/auth/AuthFrame";

export type DemoAccount = {
  loginId: string;
  name: string;
  roleLabel: string;
  detail: string;
};

type Bi = { en: string; th: string };

const ERRORS: Record<string, Bi> = {
  invalid: {
    en: "The login ID or password is not correct.",
    th: "ไอดีเข้าสู่ระบบหรือรหัสผ่านไม่ถูกต้อง",
  },
  locked: {
    en: "Too many wrong passwords. The account is locked for 15 minutes — try again later, or ask HROD to unlock it.",
    th: "ใส่รหัสผ่านผิดหลายครั้งเกินไป บัญชีถูกล็อก 15 นาที กรุณาลองใหม่ภายหลัง หรือติดต่อฝ่าย HROD เพื่อปลดล็อก",
  },
  suspended: {
    en: "This account has been suspended. Contact HROD.",
    th: "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อฝ่าย HROD",
  },
  not_activated: {
    en: "This account has not been activated yet. Open the activation link HROD sent you to set your password.",
    th: "บัญชีนี้ยังไม่ได้เปิดใช้งาน กรุณาเปิดลิงก์เปิดใช้งานที่ฝ่าย HROD ส่งให้เพื่อตั้งรหัสผ่าน",
  },
  not_provisioned: {
    en: "Your company sign-in worked, but no account has been set up for you in this system. Ask HROD to create one.",
    th: "ยืนยันตัวตนกับระบบบริษัทสำเร็จ แต่ยังไม่มีบัญชีของคุณในระบบนี้ กรุณาติดต่อฝ่าย HROD เพื่อสร้างบัญชี",
  },
  default: {
    en: "Could not sign you in. Please try again.",
    th: "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  },
};

/** Auth.js reports refusals as ?error=CredentialsSignin&code=<ours> */
function errorFor(error?: string, code?: string): Bi | null {
  if (code && ERRORS[code]) return ERRORS[code]!;
  if (!error) return null;
  return ERRORS[error] ?? ERRORS.default!;
}

export function LoginForm({
  loginDomain,
  demoAccounts,
  ssoName,
  error,
  code,
  next,
  notice,
}: {
  loginDomain: string;
  demoAccounts: DemoAccount[];
  ssoName: string | null;
  error?: string;
  code?: string;
  next?: string;
  notice?: "activated" | "password_changed" | "signed_out";
}) {
  const { tt } = useT();
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Bi | null>(() => errorFor(error, code));

  const callbackUrl = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  // people type just their name — finish the address for them
  const completeId = (value: string) => {
    const v = value.trim().toLowerCase();
    return v && !v.includes("@") ? `${v}@${loginDomain}` : v;
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const id = completeId(loginId);
    if (!id || !password) {
      setMessage({
        en: "Enter your login ID and password.",
        th: "กรุณากรอกไอดีเข้าสู่ระบบและรหัสผ่าน",
      });
      return;
    }
    setLoginId(id);
    setBusy("company");
    setMessage(null);
    const res = await signIn("company", {
      loginId: id,
      password,
      redirect: false,
    });
    if (res?.ok && !res.error) {
      router.replace(callbackUrl);
      router.refresh();
      return;
    }
    setBusy(null);
    setPassword("");
    setMessage(errorFor(res?.error ?? "default", res?.code));
  }

  const demo = (id: string) => {
    setBusy(id);
    void signIn("demo", { account: id, callbackUrl });
  };

  return (
    <AuthFrame>
      <h1 className="text-center text-3xl font-medium text-ink">
        {tt("Sign in", "เข้าสู่ระบบ")}
      </h1>
      <p className="mt-2 text-center text-sm text-muted">
        {tt(
          "One company account for every module of the system.",
          "บัญชีบริษัทเดียว ใช้ได้กับทุกโมดูลของระบบ",
        )}
      </p>

      {notice === "activated" ? (
        <AuthNotice tone="success">
          {tt(
            "Your account is ready. Sign in with your new password.",
            "บัญชีของคุณพร้อมใช้งานแล้ว เข้าสู่ระบบด้วยรหัสผ่านใหม่ได้เลย",
          )}
        </AuthNotice>
      ) : notice === "password_changed" ? (
        <AuthNotice tone="success">
          {tt(
            "Password changed. Sign in again with the new one.",
            "เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบอีกครั้งด้วยรหัสผ่านใหม่",
          )}
        </AuthNotice>
      ) : null}

      {message ? <AuthNotice>{tt(message.en, message.th)}</AuthNotice> : null}

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <AuthInput
          label={tt("Login ID", "ไอดีเข้าสู่ระบบ")}
          name="username"
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={`name.sur@${loginDomain}`}
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          onBlur={() => setLoginId((v) => completeId(v))}
          disabled={busy !== null}
          autoFocus
        />
        <PasswordInput
          label={tt("Password", "รหัสผ่าน")}
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy !== null}
        />
        <button
          type="submit"
          disabled={busy !== null}
          className={cn(
            "flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-white shadow-sm",
            "transition-all hover:bg-brand-dark active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          <LogIn size={16} />
          {busy === "company" ? tt("Signing in…", "กำลังเข้าสู่ระบบ…") : tt("Sign in", "เข้าสู่ระบบ")}
        </button>
      </form>

      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted">
        <KeyRound size={14} className="mt-0.5 shrink-0" />
        <span>
          {tt(
            "Forgot your password or never received an activation link? HROD can send you a new link.",
            "ลืมรหัสผ่านหรือยังไม่ได้รับลิงก์เปิดใช้งาน? ติดต่อฝ่าย HROD เพื่อขอลิงก์ใหม่",
          )}
        </span>
      </p>

      {ssoName ? (
        <>
          <Divider label={tt("or", "หรือ")} />
          <button
            type="button"
            onClick={() => {
              setBusy("sso");
              void signIn("sso", { callbackUrl });
            }}
            disabled={busy !== null}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-line bg-white text-sm font-medium text-ink transition-all hover:bg-surface active:scale-[.99] disabled:opacity-50"
          >
            <ShieldCheck size={16} className="text-brand" />
            {tt(`Continue with ${ssoName}`, `เข้าสู่ระบบด้วย ${ssoName}`)}
          </button>
        </>
      ) : null}

      {demoAccounts.length > 0 ? (
        <>
          <Divider label={tt("demo accounts", "บัญชีสาธิต")} />
          <div className="space-y-2">
            {demoAccounts.map((a) => (
              <button
                key={a.loginId}
                type="button"
                onClick={() => demo(a.loginId)}
                disabled={busy !== null}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border border-line px-4 py-2.5 text-left",
                  "transition-all hover:border-brand/40 hover:bg-brand-tint/40",
                  "active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <LogIn size={15} className="shrink-0 text-brand" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {a.name}
                    <span className="ml-2 font-normal text-muted">{a.roleLabel}</span>
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {a.loginId} · {a.detail}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] text-muted">
            {tt(
              "Demo sign-in skips the password. Switch it off with NEXT_PUBLIC_ENABLE_DEMO_LOGIN before real use.",
              "บัญชีสาธิตเข้าได้โดยไม่ต้องใช้รหัสผ่าน ปิดได้ด้วย NEXT_PUBLIC_ENABLE_DEMO_LOGIN ก่อนใช้งานจริง",
            )}
          </p>
        </>
      ) : null}
    </AuthFrame>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="my-6 flex items-center gap-3">
      <span className="h-px flex-1 bg-line" />
      <span className="text-[11px] uppercase tracking-wide text-muted">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
