"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Languages } from "lucide-react";
import { DEMO_ACCOUNTS, findPerson, type Role } from "@/data/people";
import { useT } from "@/lib/i18n";
import { useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";
import { HOME_FOR_ROLE } from "@/components/layout/nav";
import { Logo } from "@/components/layout/Logo";

export default function LoginPage() {
  const router = useRouter();
  const { state, ready, login } = useDemo();
  const { t, tt, lang, setLang } = useT();
  const [email, setEmail] = useState("aa.aa@gmail.com");
  const [password, setPassword] = useState("demo-password");
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (ready && state.role) router.replace(HOME_FOR_ROLE[state.role]);
  }, [ready, state.role, router]);

  const signIn = (role: Role) => {
    login(role);
    router.push(HOME_FOR_ROLE[role]);
  };

  return (
    <main className="grid min-h-screen place-items-center bg-surface/60 p-4">
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-[0_10px_60px_rgba(16,24,40,.14)] md:grid-cols-2">
        {/* language — the top bar only exists after login, so the choice has to
            be available here too. Same visual language as Topbar's switch. */}
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

        {/* form panel */}
        <div className="flex flex-col justify-center px-8 py-12 sm:px-14">
          <h1 className="text-center text-3xl font-medium text-ink">
            {tt("Login", "เข้าสู่ระบบ")}
          </h1>

          <form
            className="mt-8 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              signIn("l1");
            }}
          >
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">
                {t("label.email")}
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={tt("Enter your Email", "กรอกอีเมลของคุณ")}
                className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">
                {tt("Password", "รหัสผ่าน")}
              </span>
              <span className="relative block">
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={tt("Enter your password", "กรอกรหัสผ่านของคุณ")}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2.5 pr-10 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={
                    show
                      ? tt("Hide password", "ซ่อนรหัสผ่าน")
                      : tt("Show password", "แสดงรหัสผ่าน")
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>
          </form>

          <div className="mt-7 space-y-3">
            {DEMO_ACCOUNTS.map((a) => {
              // the account labels live in the data file; the person's own name
              // stays as written, only the sentence around it is translated
              const who = findPerson(a.personId)?.name.split(" ")[0] ?? "";
              return (
                <button
                  key={a.role}
                  type="button"
                  onClick={() => signIn(a.role)}
                  className="w-full rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-brand-dark active:scale-[.99]"
                >
                  {tt(
                    a.label,
                    `เข้าสู่ระบบในชื่อ ${who} (${t(`role.${a.role}`)})`,
                  )}
                </button>
              );
            })}
          </div>

          <p className="mt-6 text-center text-xs text-muted">
            {tt(
              "Demo only — pick any role above. No password is checked and nothing is sent anywhere.",
              "เวอร์ชันสาธิต — เลือกบทบาทใดก็ได้ด้านบน ระบบไม่ตรวจสอบรหัสผ่านและไม่ส่งข้อมูลไปที่ใด",
            )}
          </p>
        </div>
      </div>
    </main>
  );
}
