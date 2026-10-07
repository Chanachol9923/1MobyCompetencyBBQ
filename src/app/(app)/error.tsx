"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useT } from "@/lib/i18n";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { tt } = useT();
  const router = useRouter();

  useEffect(() => {
    // Surfaced in the browser console so the failure is still diagnosable.
    console.error("Screen failed to render:", error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-white p-8 text-center shadow-[0_8px_36px_rgba(16,24,40,.10)]">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent/10 text-accent">
          <AlertTriangle size={22} />
        </span>
        <h1 className="mt-4 text-xl font-medium text-ink">
          {tt("This screen hit an error", "หน้านี้เกิดข้อผิดพลาด")}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {tt("The rest of the system is still fine. Try again, or go back to your home page.",
            "ส่วนอื่นของระบบยังใช้งานได้ตามปกติ ลองใหม่อีกครั้ง หรือกลับไปหน้าแรก",
          )}
        </p>
        {/* the raw message helps a developer; in production people get a
            reference code to quote to HROD instead */}
        {process.env.NODE_ENV === "development" && error.message ? (
          <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-surface p-3 text-left text-[11px] leading-relaxed text-muted">
            {error.message}
          </pre>
        ) : error.digest ? (
          <p className="mt-3 text-xs text-muted">
            {tt("Reference", "รหัสอ้างอิง")}: <span className="font-mono">{error.digest}</span>
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
          >
            <RotateCcw size={15} />
            {tt("Try again", "ลองใหม่อีกครั้ง")}
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="inline-flex h-11 items-center rounded-lg border border-line px-5 text-sm font-medium text-ink transition-colors hover:bg-surface"
          >
            {tt("Back to home", "กลับหน้าแรก")}
          </button>
        </div>
      </div>
    </div>
  );
}
