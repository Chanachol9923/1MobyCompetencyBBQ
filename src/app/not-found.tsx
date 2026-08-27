"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";

export default function NotFound() {
  const { tt } = useT();
  return (
    <main className="grid min-h-screen place-items-center bg-surface/50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-[0_10px_40px_rgba(16,24,40,.12)]">
        <p className="text-5xl font-bold text-brand">404</p>
        <h1 className="mt-3 text-xl font-medium text-ink">
          {tt("Page not found", "ไม่พบหน้าที่ต้องการ")}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {tt(
            "This screen is not part of the demo.",
            "หน้านี้ไม่ได้อยู่ในเวอร์ชันสาธิต",
          )}
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex h-10 items-center rounded-lg bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        >
          {tt("Back to login", "กลับไปหน้าเข้าสู่ระบบ")}
        </Link>
      </div>
    </main>
  );
}
