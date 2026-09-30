"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowLeft, CheckCircle2, Clock3, LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { passwordProblems } from "@/lib/password-rules";
import {
  AuthFrame,
  AuthInput,
  AuthNotice,
  PasswordChecklist,
  PasswordInput,
  describeProblems,
} from "@/components/auth/AuthFrame";
import { completeActivation, type LinkState } from "@/server/account";

export function ActivateForm({ token, link }: { token: string; link: LinkState }) {
  const { tt } = useT();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<LinkState["state"] | "done">(link.state);
  const [busy, setBusy] = useState(false);

  if (state !== "valid" && state !== "done") {
    return <DeadLink state={state} />;
  }
  const valid = link.state === "valid" ? link : null;
  const isReset = valid?.purpose === "RESET";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !valid) return;
    const problems = passwordProblems(password);
    if (problems.length) return setError(describeProblems(problems, tt));
    if (password !== confirm) {
      return setError(tt("The two passwords do not match.", "รหัสผ่านทั้งสองช่องไม่ตรงกัน"));
    }
    setBusy(true);
    setError(null);
    const res = await completeActivation({ token, password, confirm });
    if (!res.ok) {
      setBusy(false);
      if (res.reason === "weak") return setError(describeProblems(res.problems, tt));
      if (res.reason === "mismatch") {
        return setError(tt("The two passwords do not match.", "รหัสผ่านทั้งสองช่องไม่ตรงกัน"));
      }
      setState(res.reason);
      return;
    }
    setState("done");
    // straight in — no second trip through the login form
    const signedIn = await signIn("company", {
      loginId: res.loginId,
      password,
      redirect: false,
    });
    if (signedIn?.ok && !signedIn.error) {
      router.replace("/");
      router.refresh();
    } else {
      router.replace("/login?notice=activated");
    }
  }

  return (
    <AuthFrame>
      <h1 className="text-center text-3xl font-medium text-ink">
        {isReset
          ? tt("Set a new password", "ตั้งรหัสผ่านใหม่")
          : tt("Activate your account", "เปิดใช้งานบัญชี")}
      </h1>
      <p className="mt-2 text-center text-sm text-muted">
        {isReset
          ? tt(
              "Choose a new password. Other devices will be signed out.",
              "ตั้งรหัสผ่านใหม่ อุปกรณ์อื่นที่เข้าสู่ระบบอยู่จะถูกออกจากระบบ",
            )
          : tt(
              `Welcome, ${valid?.name}. Set the password you will use to sign in.`,
              `ยินดีต้อนรับ ${valid?.name} กรุณาตั้งรหัสผ่านสำหรับเข้าสู่ระบบ`,
            )}
      </p>

      {error ? <AuthNotice>{error}</AuthNotice> : null}
      {state === "done" ? (
        <AuthNotice tone="success">
          {tt("Password saved. Signing you in…", "บันทึกรหัสผ่านแล้ว กำลังเข้าสู่ระบบ…")}
        </AuthNotice>
      ) : null}

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        {/* the username field lets password managers save the pair correctly */}
        <AuthInput
          label={tt("Your login ID", "ไอดีเข้าสู่ระบบของคุณ")}
          name="username"
          autoComplete="username"
          value={valid?.loginId ?? ""}
          readOnly
          disabled
        />
        <div>
          <PasswordInput
            label={tt("New password", "รหัสผ่านใหม่")}
            name="new-password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            autoFocus
          />
          <PasswordChecklist password={password} />
        </div>
        <PasswordInput
          label={tt("Type it again", "ยืนยันรหัสผ่าน")}
          name="confirm-password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy}
          className={cn(
            "flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-white shadow-sm",
            "transition-all hover:bg-brand-dark active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          <CheckCircle2 size={16} />
          {busy
            ? tt("Saving…", "กำลังบันทึก…")
            : isReset
              ? tt("Save and sign in", "บันทึกและเข้าสู่ระบบ")
              : tt("Activate and sign in", "เปิดใช้งานและเข้าสู่ระบบ")}
        </button>
      </form>
    </AuthFrame>
  );
}

function DeadLink({ state }: { state: "invalid" | "expired" | "used" }) {
  const { tt } = useT();
  const copy = {
    expired: {
      icon: <Clock3 size={22} />,
      title: tt("This link has expired", "ลิงก์นี้หมดอายุแล้ว"),
      body: tt(
        "Links work for a limited time. Ask HROD to send you a new one.",
        "ลิงก์มีอายุการใช้งานจำกัด กรุณาติดต่อฝ่าย HROD เพื่อขอลิงก์ใหม่",
      ),
    },
    used: {
      icon: <CheckCircle2 size={22} />,
      title: tt("This link has already been used", "ลิงก์นี้ถูกใช้ไปแล้ว"),
      body: tt(
        "If you set your password with it, just sign in. If that was not you, tell HROD straight away.",
        "หากคุณตั้งรหัสผ่านด้วยลิงก์นี้แล้ว เข้าสู่ระบบได้เลย หากไม่ใช่คุณ กรุณาแจ้งฝ่าย HROD ทันที",
      ),
    },
    invalid: {
      icon: <LinkIcon size={22} />,
      title: tt("This link is not valid", "ลิงก์นี้ใช้ไม่ได้"),
      body: tt(
        "Check that the whole link was copied, or ask HROD for a new one. A newer link replaces any older one.",
        "ตรวจสอบว่าคัดลอกลิงก์มาครบ หรือขอลิงก์ใหม่จากฝ่าย HROD ลิงก์ที่ออกใหม่จะทำให้ลิงก์เดิมใช้ไม่ได้",
      ),
    },
  }[state];

  return (
    <AuthFrame>
      <div className="text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand-tint text-brand">
          {copy.icon}
        </span>
        <h1 className="mt-4 text-2xl font-medium text-ink">{copy.title}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">{copy.body}</p>
        <Link
          href="/login"
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg border border-line px-5 text-sm font-medium text-ink transition-colors hover:bg-surface"
        >
          <ArrowLeft size={15} />
          {tt("Go to sign in", "ไปหน้าเข้าสู่ระบบ")}
        </Link>
      </div>
    </AuthFrame>
  );
}
