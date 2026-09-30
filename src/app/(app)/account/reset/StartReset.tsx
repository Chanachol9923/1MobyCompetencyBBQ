"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { formatDateTime } from "@/components/admin/shared";
import { startPasswordReset } from "@/server/account";

export function StartReset({
  loginId,
  expiresAt,
}: {
  loginId: string;
  expiresAt: string | null;
}) {
  const { tt } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [gone, setGone] = useState(false);

  const start = () =>
    startTransition(async () => {
      const res = await startPasswordReset();
      if (res.ok) router.push(res.path);
      else setGone(true);
    });

  const open = expiresAt !== null && !gone;

  return (
    <div className="mx-auto max-w-[640px] p-6 lg:p-10">
      <Card className="p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand-tint text-brand">
          {open ? <KeyRound size={22} /> : <CheckCircle2 size={22} />}
        </span>
        {open ? (
          <>
            <h1 className="mt-4 text-2xl font-medium text-ink">
              {tt("Set a new password", "ตั้งรหัสผ่านใหม่")}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
              {tt(
                `HROD asked you to set a new password for ${loginId}. Press Start and choose it on the next screen. Other devices will be signed out.`,
                `ฝ่าย HROD ขอให้คุณตั้งรหัสผ่านใหม่สำหรับ ${loginId} กดเริ่มแล้วตั้งรหัสผ่านในหน้าถัดไป อุปกรณ์อื่นจะถูกออกจากระบบ`,
              )}
            </p>
            <p className="mt-2 text-xs text-muted">
              {tt(
                `Request valid until ${formatDateTime(expiresAt!)}`,
                `คำขอนี้ใช้ได้ถึง ${formatDateTime(expiresAt!)}`,
              )}
            </p>
            <Button className="mt-6" size="lg" onClick={start} disabled={pending}>
              <KeyRound size={16} />
              {pending ? tt("Starting…", "กำลังเริ่ม…") : tt("Start", "เริ่ม")}
            </Button>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-2xl font-medium text-ink">
              {tt("Nothing to do", "ไม่มีรายการที่ต้องทำ")}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
              {tt(
                "There is no open request to set a new password — it may already be done, or it expired. To change your password yourself, use Change password in the menu.",
                "ไม่มีคำขอตั้งรหัสผ่านใหม่ที่ค้างอยู่ อาจทำไปแล้วหรือหมดอายุ หากต้องการเปลี่ยนรหัสผ่านเอง ใช้เมนูเปลี่ยนรหัสผ่าน",
              )}
            </p>
            <Link href="/" className="mt-6 inline-block">
              <Button variant="outline">{tt("Back to home", "กลับหน้าแรก")}</Button>
            </Link>
          </>
        )}
      </Card>
    </div>
  );
}
