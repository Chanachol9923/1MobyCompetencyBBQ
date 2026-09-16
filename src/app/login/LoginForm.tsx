"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { AlertCircle, Languages, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { Logo } from "@/components/layout/Logo";

export type DemoAccount = {
  key: string;
  name: string;
  roleLabel: string;
  detail: string;
};

const ERRORS: Record<string, { en: string; th: string }> = {
  suspended: {
    en: "This account has been suspended. Contact HROD.",
    th: "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อฝ่ายบุคคล",
  },
  OAuthAccountNotLinked: {
    en: "That email is already signed up with a different method.",
    th: "อีเมลนี้เคยลงทะเบียนด้วยวิธีอื่นไว้แล้ว",
  },
  AccessDenied: {
    en: "Sign-in was refused. Ask an administrator to add your account.",
    th: "การเข้าสู่ระบบถูกปฏิเสธ กรุณาแจ้งผู้ดูแลระบบให้เพิ่มบัญชีของคุณ",
  },
  default: {
    en: "Could not sign you in. Please try again.",
    th: "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  },
};

export function LoginForm({
  demoAccounts,
  googleEnabled,
  error,
  next,
}: {
  demoAccounts: DemoAccount[];
  googleEnabled: boolean;
  error?: string;
  next?: string;
}) {
  const { tt, lang, setLang } = useT();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const message = error ? (ERRORS[error] ?? ERRORS.default!) : null;
  const callbackUrl = next && next.startsWith("/") ? next : "/dashboard";

  const google = () => {
    setBusy("google");
    void signIn("google", { callbackUrl });
  };

  const demo = (key: string) => {
    setBusy(key);
    startTransition(() => {
      void signIn("demo", { account: key, callbackUrl });
    });
  };

  return (
    <main className="grid min-h-screen place-items-center bg-surface/60 p-4">
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-[0_10px_60px_rgba(16,24,40,.14)] md:grid-cols-2">
        <div
          role="group"
          aria-label={tt("Language", "ภาษา")}
          className="absolute right-4 top-4 z-10 flex items-center overflow-hidden rounded-lg border border-line bg-white/90 backdrop-blur"
        >
          <Languages size={14} className="ml-2 text-muted" />
          {(["en", "th"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={cn(
                "px-2.5 py-1.5 text-xs font-semibold transition-colors",
                lang === l ? "bg-brand text-white" : "text-muted hover:bg-surface",
              )}
            >
              {l === "en" ? "EN" : "ไทย"}
            </button>
          ))}
        </div>

        {/* brand panel */}
        <div className="relative hidden min-h-[520px] overflow-hidden bg-[#0b1b3f] md:block">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 100% at 85% 20%, #f05123 0%, #faa21b 18%, rgba(240,81,35,0) 55%), radial-gradient(120% 120% at 10% 0%, #006bff 0%, #0b1b3f 60%), linear-gradient(160deg,#0b1b3f 0%,#123a7a 45%,#0b1b3f 100%)",
            }}
          />
          <div
            className="absolute -left-24 bottom-[-30%] size-[520px] rounded-full opacity-70"
            style={{
              background:
                "radial-gradient(circle at 40% 40%, rgba(0,107,255,.85), rgba(11,27,63,0) 65%)",
            }}
          />
          <div className="relative flex h-full flex-col justify-center px-12 py-10">
            <Logo className="text-5xl" />
            <div className="mt-4 h-px w-24 bg-white/40" />
            <p className="mt-4 text-2xl font-bold leading-snug text-white">
              {lang === "th" ? (
                <>
                  ระบบประเมินสมรรถนะ
                  <br />
                  แบบครบวงจร
                </>
              ) : (
                <>
                  Comprehensive
                  <br />
                  Assessment System
                </>
              )}
            </p>
          </div>
        </div>

        {/* sign-in panel */}
        <div className="flex flex-col justify-center px-8 py-12 sm:px-14">
          <h1 className="text-center text-3xl font-medium text-ink">
            {tt("Sign in", "เข้าสู่ระบบ")}
          </h1>
          <p className="mt-2 text-center text-sm text-muted">
            {tt(
              "Use your work Google account.",
              "เข้าสู่ระบบด้วยบัญชี Google ของที่ทำงาน",
            )}
          </p>

          {message ? (
            <p className="mt-5 flex items-start gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-accent">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {tt(message.en, message.th)}
            </p>
          ) : null}

          <button
            type="button"
            onClick={google}
            disabled={!googleEnabled || busy !== null}
            className={cn(
              "mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-line bg-white",
              "text-sm font-medium text-ink transition-all",
              "hover:bg-surface active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <GoogleMark />
            {busy === "google"
              ? tt("Opening Google…", "กำลังเปิด Google…")
              : tt("Continue with Google", "ดำเนินการต่อด้วย Google")}
          </button>

          {!googleEnabled ? (
            <p className="mt-2 text-center text-[11px] text-muted">
              {tt(
                "Google sign-in is not configured on this deployment yet.",
                "ยังไม่ได้ตั้งค่าการเข้าสู่ระบบด้วย Google สำหรับระบบนี้",
              )}
            </p>
          ) : null}

          {demoAccounts.length > 0 ? (
            <>
              <div className="my-7 flex items-center gap-3">
                <span className="h-px flex-1 bg-line" />
                <span className="text-[11px] uppercase tracking-wide text-muted">
                  {tt("or walk through a demo account", "หรือทดลองด้วยบัญชีสาธิต")}
                </span>
                <span className="h-px flex-1 bg-line" />
              </div>

              <div className="space-y-2">
                {demoAccounts.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => demo(a.key)}
                    disabled={busy !== null || pending}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border border-line px-4 py-3 text-left",
                      "transition-all hover:border-brand/40 hover:bg-brand-tint/40",
                      "active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-50",
                    )}
                  >
                    <LogIn size={16} className="shrink-0 text-brand" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {a.name}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {a.roleLabel} · {a.detail}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              <p className="mt-6 text-center text-xs text-muted">
                {tt(
                  "Demo accounts are read from the database and can be switched off with one environment variable.",
                  "บัญชีสาธิตอ่านจากฐานข้อมูลจริง และปิดได้ด้วยการตั้งค่าตัวแปรสภาพแวดล้อมเพียงตัวเดียว",
                )}
              </p>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59A14.5 14.5 0 0 1 9.77 24c0-1.6.27-3.15.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.88.93 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.9-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
