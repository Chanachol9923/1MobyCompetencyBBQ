"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { checkFile, uploadMedia } from "@/components/admin/media-upload";
import { MEDIA_LIMITS } from "@/components/learning/model";
import { discardReportImage } from "@/server/problems";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { MAX_IMAGES } from "./types";

/**
 * Screenshots for a report, or evidence for a fix. Pick, drop or paste
 * (Ctrl+V) up to four images; each uploads straight away and shows as a
 * thumbnail that can be taken off again.
 */
export function ImagePicker({
  folder,
  value,
  onChange,
  onBusyChange,
  pasteTarget,
}: {
  folder: "screenshots" | "evidence";
  value: string[];
  onChange: (urls: string[]) => void;
  onBusyChange?: (busy: boolean) => void;
  /** listen for pasted images while this element (usually the dialog) has focus */
  pasteTarget?: React.RefObject<HTMLElement | null>;
}) {
  const { tt } = useT();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => onBusyChange?.(pending > 0), [pending, onBusyChange]);

  async function add(files: File[]) {
    setError(null);
    const room = MAX_IMAGES - latest.current.length - pending;
    const picked = files.filter((f) => f.type.startsWith("image/")).slice(0, Math.max(0, room));
    if (!picked.length) {
      if (room <= 0) setError(tt(`Up to ${MAX_IMAGES} images.`, `แนบได้สูงสุด ${MAX_IMAGES} รูป`));
      return;
    }
    for (const f of picked) {
      const problem = checkFile(f, "image");
      if (problem) {
        setError(tt(problem.en, problem.th));
        continue;
      }
      setPending((n) => n + 1);
      try {
        const url = await uploadMedia(f, "image", folder, undefined, f.name || "screenshot.png");
        onChange([...latest.current, url]);
      } catch {
        setError(tt("An image could not be uploaded. Try again.", "อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่"));
      } finally {
        setPending((n) => n - 1);
      }
    }
  }

  useEffect(() => {
    const el = pasteTarget?.current;
    if (!el) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (!files.length) return;
      e.preventDefault();
      void add(files);
    };
    el.addEventListener("paste", onPaste);
    return () => el.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasteTarget]);

  const full = value.length + pending >= MAX_IMAGES;

  return (
    <div>
      <input
        ref={input}
        type="file"
        multiple
        accept={MEDIA_LIMITS.image.types.join(",")}
        className="hidden"
        onChange={(e) => {
          void add(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap gap-2">
        {value.map((url) => (
          <span key={url} className="group relative size-20 overflow-hidden rounded-lg border border-line bg-surface">
            <a href={url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
            </a>
            <button
              type="button"
              aria-label={tt("Remove image", "นำรูปออก")}
              onClick={() => {
                onChange(value.filter((u) => u !== url));
                void discardReportImage({ url }).catch(() => {});
              }}
              className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white opacity-90 hover:opacity-100"
            >
              <X size={13} />
            </button>
          </span>
        ))}
        {Array.from({ length: pending }).map((_, i) => (
          <span key={`p${i}`} className="grid size-20 place-items-center rounded-lg border border-line bg-surface">
            <Loader2 size={18} className="animate-spin text-brand" />
          </span>
        ))}
        {!full ? (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              void add(Array.from(e.dataTransfer.files));
            }}
            className={cn(
              "flex h-20 min-w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line px-3 text-[11px] text-muted transition hover:border-brand/60 hover:text-brand",
              over && "border-brand bg-brand-tint/50 text-brand",
            )}
          >
            <ImagePlus size={18} />
            {tt("Add image", "เพิ่มรูป")}
          </button>
        ) : null}
      </div>
      <p className="mt-1.5 text-[11px] text-muted">
        {tt(
          `Up to ${MAX_IMAGES} images (JPG, PNG, WebP · ${MEDIA_LIMITS.image.maxMB} MB each). You can also paste a screenshot with Ctrl+V.`,
          `แนบได้สูงสุด ${MAX_IMAGES} รูป (JPG, PNG, WebP · รูปละไม่เกิน ${MEDIA_LIMITS.image.maxMB} MB) วางภาพหน้าจอด้วย Ctrl+V ได้`,
        )}
      </p>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}
