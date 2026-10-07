"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { FlaskConical, KeyRound, LogIn, ShieldCheck } from "lucide-react";
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

/** What the password field holds after a test account is picked — never a real password. */
const TEST_PASSWORD_MASK = "test-account";

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
  unavailable = false,
}: {
  loginDomain: string;
  demoAccounts: DemoAccount[];
  ssoName: string | null;
  error?: string;
  code?: string;
  next?: string;
  notice?: "activated" | "password_changed" | "signed_out";
  /** the database could not be reached while rendering this page */
  unavailable?: boolean;
}) {
  const { tt } = useT();
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  // the test account picked from the suggestions, while its fields are untouched
  const [testPick, setTestPick] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Bi | null>(() => errorFor(error, code));
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const passwordRef = useRef<HTMLDivElement>(null);

  // test mode: the seeded accounts, filtered by what has been typed so far
  const q = loginId.trim().toLowerCase();
  const suggestions = demoAccounts.filter(
    (a) => !q || a.loginId.includes(q) || a.name.toLowerCase().includes(q),
  );
  const showSuggestions = suggestOpen && suggestions.length > 0 && busy === null;

  function pick(a: DemoAccount) {
    setLoginId(a.loginId);
    // a stand-in so the field shows as filled; the real password is never sent
    setPassword(TEST_PASSWORD_MASK);
    setTestPick(a.loginId);
    setSuggestOpen(false);
    setMessage(null);
    // straight to the button: one more click (or Enter) signs in
    window.setTimeout(() => {
      const target = document.querySelector<HTMLButtonElement>("#login-submit");
      target?.focus();
    }, 0);
  }

  function onIdKey(e: KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions) {
      if (e.key === "ArrowDown" && suggestions.length) setSuggestOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const a = suggestions[Math.min(highlight, suggestions.length - 1)];
      if (a) pick(a);
    } else if (e.key === "Escape") {
      setSuggestOpen(false);
    }
  }

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
    const viaTest = testPick !== null && testPick === id && password === TEST_PASSWORD_MASK;
    const res = viaTest
      ? await signIn("test", { account: id, redirect: false })
      : await signIn("company", { loginId: id, password, redirect: false });
    if (res?.ok && !res.error) {
      router.replace(callbackUrl);
      router.refresh();
      return;
    }
    setBusy(null);
    setPassword("");
    setTestPick(null);
    setMessage(errorFor(res?.error ?? "default", res?.code));
  }

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

      {unavailable ? (
        <AuthNotice>
          {tt(
            "The system cannot reach its database right now, so signing in will not work. Please try again in a few minutes, or let HROD know.",
            "ขณะนี้ระบบเชื่อมต่อฐานข้อมูลไม่ได้ จึงยังเข้าสู่ระบบไม่ได้ กรุณาลองใหม่ในอีกสักครู่ หรือแจ้งฝ่าย HROD",
          )}
        </AuthNotice>
      ) : null}

      {message ? <AuthNotice>{tt(message.en, message.th)}</AuthNotice> : null}

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <div className="relative">
          <AuthInput
            label={tt("Login ID", "ไอดีเข้าสู่ระบบ")}
            name="username"
            type="text"
            inputMode="email"
            autoComplete={demoAccounts.length ? "off" : "username"}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={`name.sur@${loginDomain}`}
            value={loginId}
            onChange={(e) => {
              setLoginId(e.target.value);
              setTestPick(null);
              setSuggestOpen(true);
              setHighlight(0);
            }}
            onClick={() => setSuggestOpen(true)}
            onBlur={() => {
              setSuggestOpen(false);
              setLoginId((v) => completeId(v));
            }}
            onKeyDown={onIdKey}
            disabled={busy !== null}
            autoFocus
            role={demoAccounts.length ? "combobox" : undefined}
            aria-expanded={demoAccounts.length ? showSuggestions : undefined}
            aria-controls={demoAccounts.length ? "demo-accounts" : undefined}
            aria-autocomplete={demoAccounts.length ? "list" : undefined}
          />
          {showSuggestions ? (
            <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-line bg-white shadow-[0_12px_32px_rgba(16,24,40,.16)]">
              <p className="flex items-center gap-1.5 border-b border-line bg-surface/70 px-3 py-1.5 text-[11px] font-medium text-muted">
                <FlaskConical size={12} className="text-brand" />
                {tt("Test accounts — pick one, then Sign in", "บัญชีทดสอบ — เลือกแล้วกดเข้าสู่ระบบ")}
              </p>
              <ul id="demo-accounts" role="listbox">
                {suggestions.map((a, i) => (
                  <li
                    key={a.loginId}
                    role="option"
                    aria-selected={i === highlight}
                    // mousedown, not click: it fires before the input's blur closes the list
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(a);
                    }}
                    onMouseEnter={() => setHighlight(i)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors max-lg:min-h-12",
                      i === highlight ? "bg-brand-tint/70" : "hover:bg-surface",
                    )}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">
                      {a.name.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {a.name}
                        <span className="ml-2 rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-muted">
                          {a.roleLabel}
                        </span>
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {a.loginId} · {a.detail}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div ref={passwordRef}>
          <PasswordInput
            label={tt("Password", "รหัสผ่าน")}
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setTestPick(null);
            }}
            disabled={busy !== null}
          />
        </div>
        <button
          id="login-submit"
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
        <p className="mt-6 flex items-start gap-2 rounded-lg border border-dashed border-brand/30 bg-brand-tint/30 px-3 py-2 text-xs leading-relaxed text-muted">
          <FlaskConical size={14} className="mt-0.5 shrink-0 text-brand" />
          <span>
            {tt(
              `Test mode: click the Login ID field and pick one of ${demoAccounts.length} test accounts. It signs in even after that account's password was changed. Type a password yourself to test the real sign-in.`,
              `โหมดทดสอบ: คลิกช่องไอดีแล้วเลือกบัญชีทดสอบ ${demoAccounts.length} บัญชี เข้าได้แม้รหัสผ่านของบัญชีนั้นถูกเปลี่ยนไปแล้ว หากต้องการทดสอบการเข้าสู่ระบบจริง ให้พิมพ์รหัสผ่านเอง`,
            )}
          </span>
        </p>
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
