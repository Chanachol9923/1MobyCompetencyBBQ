"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { KeyRound } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { passwordProblems } from "@/lib/password-rules";
import { changeOwnPassword } from "@/server/account";
import { PasswordChecklist, PasswordInput, describeProblems } from "./AuthFrame";

/**
 * Change your own password. Changing it retires every other session, so this
 * browser signs straight back in with the new one — the person never notices.
 */
export function ChangePasswordModal({
  loginId,
  onClose,
}: {
  loginId: string;
  onClose: () => void;
}) {
  const { t, tt } = useT();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const problems = passwordProblems(password);
    if (problems.length) return setError(describeProblems(problems, tt));
    if (password !== confirm) {
      return setError(tt("The two new passwords do not match.", "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน"));
    }
    setError(null);
    startTransition(async () => {
      const res = await changeOwnPassword({ current, password, confirm });
      if (!res.ok) {
        const text: Record<string, string> = {
          wrong_current: tt("Your current password is not correct.", "รหัสผ่านปัจจุบันไม่ถูกต้อง"),
          mismatch: tt("The two new passwords do not match.", "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน"),
          same: tt("Choose a password different from the current one.", "กรุณาตั้งรหัสผ่านใหม่ที่ไม่ซ้ำกับรหัสเดิม"),
          not_allowed: tt(
            "This account signs in through the company identity provider — change the password there.",
            "บัญชีนี้เข้าสู่ระบบผ่านระบบยืนยันตัวตนของบริษัท กรุณาเปลี่ยนรหัสผ่านที่นั่น",
          ),
        };
        setError(res.reason === "weak" ? describeProblems(res.problems, tt) : text[res.reason]!);
        return;
      }
      const again = await signIn("company", { loginId, password, redirect: false });
      if (again?.ok && !again.error) {
        window.location.reload();
      } else {
        window.location.href = "/login?notice=password_changed";
      }
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={tt("Change password", "เปลี่ยนรหัสผ่าน")}
      subtitle={loginId}
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button disabled={pending || !current || !password || !confirm} onClick={submit}>
            <KeyRound size={15} />
            {pending ? tt("Saving…", "กำลังบันทึก…") : tt("Change password", "เปลี่ยนรหัสผ่าน")}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input type="hidden" name="username" autoComplete="username" value={loginId} readOnly />
        <PasswordInput
          label={tt("Current password", "รหัสผ่านปัจจุบัน")}
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoFocus
        />
        <div>
          <PasswordInput
            label={tt("New password", "รหัสผ่านใหม่")}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordChecklist password={password} />
        </div>
        <PasswordInput
          label={tt("Type the new password again", "ยืนยันรหัสผ่านใหม่")}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <p className="text-xs text-muted">
          {tt(
            "Other devices signed in to this account will be signed out.",
            "อุปกรณ์อื่นที่เข้าสู่ระบบด้วยบัญชีนี้อยู่จะถูกออกจากระบบ",
          )}
        </p>
        {error ? (
          <p role="alert" className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-ink">
            {error}
          </p>
        ) : null}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
