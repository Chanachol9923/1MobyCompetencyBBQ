"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { CheckCircle2, FileText, Film, RefreshCw, UploadCloud, X } from "lucide-react";
import { MEDIA_LIMITS, type MediaKind } from "@/components/learning/model";
import { formatBytes, formatDuration } from "@/components/learning/media-types";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type UploadFolder =
  | "shorts"
  | "documents"
  | "chapters"
  | "posters"
  | "screenshots"
  | "evidence";

/** A safe, readable file name: the random suffix keeps it unique. */
function blobPath(folder: UploadFolder, file: File | Blob, fallback: string) {
  const name = file instanceof File ? file.name : fallback;
  const clean = name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(-80);
  const root = folder === "screenshots" || folder === "evidence" ? "reports" : "learning";
  return `${root}/${folder}/${clean || fallback}`;
}

/**
 * Upload a file straight from the browser to Blob storage. The server only
 * signs the upload (after checking the administrator's permission, the type
 * and the size), so a 200 MB video never passes through a serverless function.
 */
export async function uploadMedia(
  file: File | Blob,
  kind: MediaKind,
  folder: UploadFolder,
  onProgress?: (percent: number) => void,
  fallbackName = "file",
) {
  const result = await upload(blobPath(folder, file, fallbackName), file, {
    access: "public",
    handleUploadUrl: "/api/upload",
    clientPayload: kind,
    multipart: file.size > 8 * 1024 * 1024,
    contentType: file.type || undefined,
    onUploadProgress: ({ percentage }) => onProgress?.(Math.round(percentage)),
  });
  return result.url;
}

/** What the type and size limits say about a file, before anything is sent. */
export function checkFile(file: File, kind: MediaKind): { en: string; th: string } | null {
  const limit = MEDIA_LIMITS[kind];
  if (!(limit.types as readonly string[]).includes(file.type)) {
    const what =
      kind === "video" ? "MP4, WebM or MOV" : kind === "pdf" ? "PDF" : "JPG, PNG or WebP";
    return {
      en: `That file type isn't supported — use ${what}.`,
      th: `ไม่รองรับไฟล์ประเภทนี้ กรุณาใช้ ${what}`,
    };
  }
  if (file.size > limit.maxMB * 1024 * 1024) {
    return {
      en: `That file is ${formatBytes(file.size)}; the limit is ${limit.maxMB} MB.`,
      th: `ไฟล์มีขนาด ${formatBytes(file.size)} เกินขีดจำกัด ${limit.maxMB} MB`,
    };
  }
  return null;
}

export type VideoMeta = {
  durationSec: number;
  width: number;
  height: number;
  /** a frame from early in the video, to use as the cover */
  poster: Blob | null;
};

/** Read a video's length and shape locally, and grab a frame for its cover. */
export function readVideo(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = url;
    const done = (meta: VideoMeta) => {
      URL.revokeObjectURL(url);
      resolve(meta);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable video"));
    };
    v.onloadedmetadata = () => {
      // a frame a little way in is more telling than the first black one
      v.currentTime = Math.min(1, (v.duration || 0) / 4);
    };
    v.onseeked = () => {
      const meta = {
        durationSec: Math.max(1, Math.round(v.duration || 0)),
        width: v.videoWidth,
        height: v.videoHeight,
      };
      try {
        const scale = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(v.videoWidth * scale);
        c.height = Math.round(v.videoHeight * scale);
        c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
        c.toBlob((poster) => done({ ...meta, poster }), "image/jpeg", 0.82);
      } catch {
        done({ ...meta, poster: null });
      }
    };
  });
}

/* ------------------------------------------------------------- the field */

export type PickedFile = { url: string; bytes: number; name: string };

/**
 * A drop zone that uploads as soon as a file is chosen, shows progress, and
 * then shows the file with "replace" and "remove". `prepare` runs first — to
 * read a video's length, say — and may refuse the file with a message.
 */
export function FileField({
  kind,
  folder,
  value,
  onChange,
  prepare,
  hint,
  compact,
}: {
  kind: "video" | "pdf";
  folder: UploadFolder;
  value: PickedFile | null;
  onChange: (file: PickedFile | null) => void;
  prepare?: (file: File) => Promise<{ en: string; th: string } | null>;
  hint?: string;
  compact?: boolean;
}) {
  const { tt } = useT();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const Icon = kind === "video" ? Film : FileText;

  async function take(file: File | undefined) {
    if (!file) return;
    setError(null);
    const problem = checkFile(file, kind) ?? (prepare ? await prepare(file).catch(() => ({
      en: "That file could not be read.",
      th: "อ่านไฟล์นี้ไม่ได้",
    })) : null);
    if (problem) {
      setError(tt(problem.en, problem.th));
      return;
    }
    setProgress(0);
    try {
      const url = await uploadMedia(file, kind, folder, setProgress);
      onChange({ url, bytes: file.size, name: file.name });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        /403|permission|Not authori/i.test(msg)
          ? tt("You don't have permission to upload.", "คุณไม่มีสิทธิ์อัปโหลดไฟล์")
          : tt("The upload failed — check your connection and try again.", "อัปโหลดไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง"),
      );
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  }

  const accept = MEDIA_LIMITS[kind].types.join(",");
  const busy = progress !== null;

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => void take(e.target.files?.[0])}
      />
      {value && !busy ? (
        <div className="flex items-center gap-3 rounded-lg border border-success/40 bg-success/5 px-3 py-2.5">
          <CheckCircle2 size={18} className="shrink-0 text-success" />
          <div className="min-w-0 flex-1">
            <a
              href={value.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-sm font-medium text-ink hover:text-brand hover:underline"
            >
              {value.name}
            </a>
            <p className="text-[11px] text-muted">{formatBytes(value.bytes)}</p>
          </div>
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand hover:bg-brand-tint"
          >
            <RefreshCw size={13} /> {tt("Replace", "เปลี่ยนไฟล์")}
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={tt("Remove file", "นำไฟล์ออก")}
            className="grid size-7 place-items-center rounded-md text-muted hover:bg-accent/10 hover:text-accent"
          >
            <X size={15} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void take(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-line bg-surface/50 px-4 text-center transition",
            compact ? "py-4" : "py-7",
            over && "border-brand bg-brand-tint/50",
            !busy && "hover:border-brand/60 hover:bg-brand-tint/30",
          )}
        >
          {busy ? (
            <>
              <UploadCloud size={22} className="text-brand" />
              <span className="text-sm font-medium text-ink">
                {tt("Uploading…", "กำลังอัปโหลด…")} {progress}%
              </span>
              <span className="mt-1 h-1.5 w-full max-w-60 overflow-hidden rounded-full bg-line">
                <span
                  className="block h-full rounded-full bg-brand transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </span>
            </>
          ) : (
            <>
              <Icon size={22} className="text-brand" />
              <span className="text-sm font-medium text-ink">
                {kind === "video"
                  ? tt("Choose a video or drop it here", "เลือกวิดีโอ หรือลากไฟล์มาวาง")
                  : tt("Choose a PDF or drop it here", "เลือกไฟล์ PDF หรือลากไฟล์มาวาง")}
              </span>
              <span className="text-[11px] text-muted">
                {hint ??
                  (kind === "video"
                    ? tt(`MP4, WebM or MOV · up to ${MEDIA_LIMITS.video.maxMB} MB`, `MP4, WebM หรือ MOV · ไม่เกิน ${MEDIA_LIMITS.video.maxMB} MB`)
                    : tt(`PDF · up to ${MEDIA_LIMITS.pdf.maxMB} MB`, `PDF · ไม่เกิน ${MEDIA_LIMITS.pdf.maxMB} MB`))}
              </span>
            </>
          )}
        </button>
      )}
      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { formatDuration };
