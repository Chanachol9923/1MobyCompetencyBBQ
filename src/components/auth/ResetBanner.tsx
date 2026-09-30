"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyRound } from "lucide-react";
import { useT } from "@/lib/i18n";

/**
 * Stays at the top of every page while HROD's request to set a new password
 * is open, so it cannot be missed the way a single notification can.
 */
export function ResetBanner() {
  const { tt } = useT();
  const pathname = usePathname();
  if (pathname === "/account/reset") return null;
  return (
    <div className="mx-auto max-w-[1200px] px-6 pt-6 lg:px-10">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3">
        <KeyRound size={18} className="shrink-0 text-[#b57408]" />
        <p className="min-w-0 flex-1 text-sm text-ink">
          {tt(
            "HROD asked you to set a new password.",
            "ฝ่าย HROD ขอให้คุณตั้งรหัสผ่านใหม่",
          )}
        </p>
        <Link
          href="/account/reset"
          className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-dark max-lg:h-11"
        >
          {tt("Start", "เริ่ม")}
        </Link>
      </div>
    </div>
  );
}
