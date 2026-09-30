"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { AlertCircle, Check, Eye, EyeOff, Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { Logo } from "@/components/layout/Logo";
import { passwordProblems, type PasswordProblem } from "@/lib/password-rules";

/**
 * The two-panel frame shared by sign-in and account activation, so the first
 * screen a new joiner sees and the one they use every morning look the same.
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  const { tt, lang, setLang } = useT();
  return (
    <main className="grid min-h-dvh place-items-center bg-surface/60 p-4">
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
                "px-2.5 py-1.5 text-xs font-semibold transition-colors max-lg:min-h-9",
                lang === l ? "bg-brand text-white" : "text-muted hover:bg-surface",
              )}
            >
              {l === "en" ? "EN" : "ไทย"}
            </button>
          ))}
        </div>

        {/* brand panel */}
        <div className="relative hidden min-h-[560px] overflow-hidden bg-[#0b1b3f] md:block">
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

        <div className="flex flex-col justify-center px-6 pb-10 pt-16 sm:px-14 md:py-12">
          {/* phones get the logo above the form instead of the brand panel */}
          <div className="mb-6 flex justify-center md:hidden">
            <span className="rounded-xl bg-[#0b1b3f] px-4 py-2">
              <Logo className="text-3xl" />
            </span>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}

export function AuthNotice({
  tone = "error",
  children,
}: {
  tone?: "error" | "info" | "success";
  children: ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "mt-5 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-relaxed",
        tone === "error" && "border-accent/30 bg-accent/5 text-accent",
        tone === "info" && "border-brand/25 bg-brand-tint/60 text-ink",
        tone === "success" && "border-success/40 bg-success/10 text-ink",
      )}
    >
      {tone === "success" ? (
        <Check size={14} className="mt-0.5 shrink-0 text-success" />
      ) : (
        <AlertCircle size={14} className={cn("mt-0.5 shrink-0", tone === "info" && "text-brand")} />
      )}
      <span>{children}</span>
    </p>
  );
}

const inputBase =
  "h-12 w-full rounded-lg border border-line bg-white px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-line-2 focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-surface disabled:text-muted";

export function AuthInput({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input className={cn(inputBase, className)} {...props} />
    </label>
  );
}

/** Password input with a show/hide toggle — mistyping on a phone is the usual failure. */
export function PasswordInput({
  label,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string }) {
  const { tt } = useT();
  const [shown, setShown] = useState(false);
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <span className="relative block">
        <input type={shown ? "text" : "password"} className={cn(inputBase, "pr-12")} {...props} />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? tt("Hide password", "ซ่อนรหัสผ่าน") : tt("Show password", "แสดงรหัสผ่าน")}
          className="absolute right-1 top-1 grid size-10 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink"
        >
          {shown ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
    </label>
  );
}

const RULES: { code: PasswordProblem; en: string; th: string }[] = [
  { code: "too_short", en: "At least 10 characters", th: "อย่างน้อย 10 ตัวอักษร" },
  { code: "needs_letter", en: "Contains a letter", th: "มีตัวอักษรภาษาอังกฤษ" },
  { code: "needs_digit", en: "Contains a number", th: "มีตัวเลข" },
];

/** Live checklist, driven by the same rule function the server enforces. */
export function PasswordChecklist({ password }: { password: string }) {
  const { tt } = useT();
  const problems = new Set(passwordProblems(password));
  return (
    <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-3">
      {RULES.map((r) => {
        const met = password.length > 0 && !problems.has(r.code);
        return (
          <li
            key={r.code}
            className={cn("flex items-center gap-1.5", met ? "text-success" : "text-muted")}
          >
            <span
              className={cn(
                "grid size-4 place-items-center rounded-full border",
                met ? "border-success bg-success text-white" : "border-line-2",
              )}
            >
              {met ? <Check size={10} strokeWidth={3} /> : null}
            </span>
            {tt(r.en, r.th)}
          </li>
        );
      })}
    </ul>
  );
}

export function describeProblems(
  problems: PasswordProblem[],
  tt: (en: string, th: string) => string,
): string {
  const text: Record<PasswordProblem, [string, string]> = {
    too_short: ["at least 10 characters", "อย่างน้อย 10 ตัวอักษร"],
    too_long: ["at most 128 characters", "ไม่เกิน 128 ตัวอักษร"],
    needs_letter: ["a letter", "ตัวอักษรภาษาอังกฤษ"],
    needs_digit: ["a number", "ตัวเลข"],
  };
  const en = problems.map((p) => text[p][0]).join(", ");
  const th = problems.map((p) => text[p][1]).join(" ");
  return tt(`The password needs ${en}.`, `รหัสผ่านต้องมี ${th}`);
}
