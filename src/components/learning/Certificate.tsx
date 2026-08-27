"use client";

import { Download } from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * CSS-drawn certificate sheet — a blue-bordered page with the 1MOBY mark,
 * the recipient's name and a gold seal. No images, no downloads.
 */
export function Certificate({
  recipient,
  subject,
  kind,
  date,
  score,
  onDownload,
}: {
  recipient: string;
  subject: string;
  kind: string;
  date: string;
  /** post-test result, when the certificate came from a course */
  score?: number;
  onDownload: () => void;
}) {
  const { tt } = useT();

  return (
    <figure className="w-[280px] shrink-0 sm:w-[320px]">
      <div className="relative aspect-[1.42/1] overflow-hidden rounded-lg border-2 border-brand bg-white p-4 shadow-[0_2px_10px_rgba(16,24,40,.08)]">
        <div className="pointer-events-none absolute inset-2 rounded border border-brand/25" />

        <div className="relative flex h-full flex-col">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-bold tracking-[.12em] text-brand">
              1MOBY
            </span>
            <span className="text-[7px] uppercase tracking-wider text-line-2">
              {kind}
            </span>
          </div>

          <div className="mt-2 text-center">
            <p className="text-[7px] uppercase tracking-[.3em] text-muted">
              {tt("Certificate", "ใบรับรอง")}
            </p>
            <p className="text-[6px] uppercase tracking-[.22em] text-line-2">
              {tt("of achievement", "ผลสัมฤทธิ์การเรียนรู้")}
            </p>
            <p className="mt-2 text-[6px] uppercase tracking-[.18em] text-muted">
              {tt("This certifies that", "ขอรับรองว่า")}
            </p>
            <p className="mt-1 truncate text-lg font-bold tracking-tight text-brand">
              {recipient}
            </p>
            <p className="mx-auto mt-1 line-clamp-2 max-w-[85%] text-[8px] leading-snug text-muted">
              {tt(
                `has successfully completed ${subject} and is recognised for sustained progress.`,
                `ได้สำเร็จการเรียนรู้ในหลักสูตร ${subject} และได้รับการยกย่องในความก้าวหน้าอย่างต่อเนื่อง`,
              )}
            </p>
            {score !== undefined ? (
              <p className="mt-1 text-[8px] font-bold text-ink">
                {tt("Score", "คะแนน")}: {score}%
              </p>
            ) : null}
          </div>

          <div className="mt-auto flex items-end justify-between">
            <span className="text-[7px] text-muted">{date}</span>
            <span
              className={cn(
                "grid size-8 place-items-center rounded-full bg-gradient-to-br from-[#faa21b] to-[#f7d488]",
                "text-[6px] font-bold text-white shadow-inner ring-2 ring-amber/40",
              )}
              aria-hidden
            >
              SEAL
            </span>
            <span className="w-14 border-t border-line pt-0.5 text-center text-[6px] text-line-2">
              {tt("Signature", "ลายเซ็น")}
            </span>
          </div>
        </div>
      </div>

      <figcaption className="mt-2 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-medium text-ink">{subject}</span>
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line px-2 py-1 text-[11px] font-medium text-muted transition-colors hover:border-brand hover:text-brand"
        >
          <Download size={12} /> {tt("Download", "ดาวน์โหลด")}
        </button>
      </figcaption>
    </figure>
  );
}
