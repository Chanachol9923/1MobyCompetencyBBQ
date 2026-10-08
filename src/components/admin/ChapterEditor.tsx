"use client";

import { useRef, useState, type MutableRefObject } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileText,
  Newspaper,
  Plus,
  RefreshCw,
  Trash2,
  UploadCloud,
  Video,
  X,
} from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { IconAction } from "@/components/admin/shared";
import { checkFile, readVideo, uploadMedia, type PickedFile } from "@/components/admin/media-upload";
import { countPdfPages } from "@/components/learning/PdfReader";
import { MEDIA_LIMITS } from "@/components/learning/model";
import { formatBytes } from "@/components/learning/media-types";
import type { AdminChapterRow, Bilingual, ChapterKindValue } from "@/components/admin/content-types";
import { discardUpload } from "@/server/learning-media";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ model */

export type ChapterDraft = {
  /** the real chapter id when it already exists — keeping it keeps its progress */
  id: string;
  /** stable key for React while a brand new chapter has no id yet */
  uid: string;
  kind: ChapterKindValue;
  titleEn: string;
  titleTh: string;
  summaryEn: string;
  summaryTh: string;
  bodyEn: string;
  bodyTh: string;
  minutes: string;
  pages: string;
  /** the uploaded video or PDF; none means the built-in preview */
  media: PickedFile | null;
  /** a file on its way up */
  upload: { progress: number; name: string } | null;
  uploadError: Bilingual | null;
};

let uidCounter = 0;
const nextUid = () => `new-${++uidCounter}`;

export const newChapter = (kind: ChapterKindValue = "VIDEO"): ChapterDraft => ({
  id: "",
  uid: nextUid(),
  kind,
  titleEn: "",
  titleTh: "",
  summaryEn: "",
  summaryTh: "",
  bodyEn: "",
  bodyTh: "",
  minutes: kind === "ARTICLE" ? "5" : "10",
  pages: "",
  media: null,
  upload: null,
  uploadError: null,
});

export const chapterFromRow = (ch: AdminChapterRow): ChapterDraft => ({
  id: ch.id,
  uid: ch.id,
  kind: ch.kind,
  titleEn: ch.titleEn,
  titleTh: ch.titleTh ?? "",
  summaryEn: ch.summaryEn ?? "",
  summaryTh: ch.summaryTh ?? "",
  bodyEn: ch.bodyEn ?? "",
  bodyTh: ch.bodyTh ?? "",
  minutes: String(ch.minutes),
  pages: ch.pages === null ? "" : String(ch.pages),
  media: ch.mediaUrl
    ? {
        url: ch.mediaUrl,
        bytes: ch.mediaBytes ?? 0,
        name: decodeURIComponent(ch.mediaUrl.split("/").pop() ?? "file"),
      }
    : null,
  upload: null,
  uploadError: null,
});

/** What `saveCourse` takes for one chapter. */
export const chapterPayload = (ch: ChapterDraft) => ({
  id: ch.id,
  kind: ch.kind,
  titleEn: ch.titleEn,
  titleTh: ch.titleTh,
  summaryEn: ch.summaryEn,
  summaryTh: ch.summaryTh,
  bodyEn: ch.bodyEn,
  bodyTh: ch.bodyTh,
  minutes: ch.minutes,
  pages: ch.pages || undefined,
  mediaUrl: ch.kind === "ARTICLE" ? "" : (ch.media?.url ?? ""),
  mediaBytes: ch.kind === "ARTICLE" ? 0 : (ch.media?.bytes ?? 0),
});

/** A chapter with nothing in it at all — safe to drop on save. */
export const isBlankChapter = (ch: ChapterDraft) =>
  !ch.titleEn.trim() &&
  !ch.titleTh.trim() &&
  !ch.summaryEn.trim() &&
  !ch.bodyEn.trim() &&
  !ch.media &&
  !ch.upload;

/** "03_code-review basics.mp4" → "Code review basics" */
export function titleFromFile(name: string) {
  const base = name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/^\s*\d+[\s.)]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  return base ? base[0]!.toUpperCase() + base.slice(1) : name;
}

const kindOfFile = (f: File): ChapterKindValue | null =>
  f.type === "application/pdf" ? "PDF" : f.type.startsWith("video/") ? "VIDEO" : null;

const KIND_ICON: Record<ChapterKindValue, typeof Video> = {
  VIDEO: Video,
  PDF: FileText,
  ARTICLE: Newspaper,
};

/* ---------------------------------------------------------------- uploads */

/**
 * Runs chapter uploads outside any one component, so a file keeps uploading
 * while the administrator flips back to step 1, and three at a time so a
 * dozen dropped videos do not all fight for the connection.
 *
 * `session` changes whenever the editor opens or closes; an upload that
 * finishes for a session that is gone deletes its own file again.
 */
export function useChapterUploader({
  session,
  getChapters,
  update,
  remember,
  forget,
}: {
  session: MutableRefObject<number>;
  getChapters: () => ChapterDraft[];
  update: (fn: (chapters: ChapterDraft[]) => ChapterDraft[]) => void;
  remember: (url: string) => void;
  forget: (url: string | undefined) => void;
}) {
  const queue = useRef<(() => Promise<void>)[]>([]);
  const running = useRef(0);
  const files = useRef(new Map<string, File>());

  const patch = (uid: string, p: Partial<ChapterDraft>) =>
    update((chs) => chs.map((c) => (c.uid === uid ? { ...c, ...p } : c)));

  const pump = () => {
    while (running.current < 3 && queue.current.length) {
      const job = queue.current.shift()!;
      running.current++;
      void job().finally(() => {
        running.current--;
        pump();
      });
    }
  };

  function start(uid: string, file: File) {
    const kind = kindOfFile(file);
    if (!kind) return;
    const s = session.current;
    files.current.set(uid, file);
    patch(uid, { upload: { progress: 0, name: file.name }, uploadError: null });

    queue.current.push(async () => {
      if (session.current !== s) return;
      // the length or page count, read locally before anything is sent
      try {
        if (kind === "VIDEO") {
          const meta = await readVideo(file);
          patch(uid, { minutes: String(Math.max(1, Math.round(meta.durationSec / 60))) });
        } else {
          patch(uid, { pages: String(await countPdfPages(file)) });
        }
      } catch {
        /* the numbers stay editable; the upload can still go ahead */
      }
      try {
        const url = await uploadMedia(file, kind === "VIDEO" ? "video" : "pdf", "chapters", (progress) => {
          if (session.current === s) patch(uid, { upload: { progress, name: file.name } });
        });
        const chapter = session.current === s ? getChapters().find((c) => c.uid === uid) : undefined;
        if (!chapter) {
          // the editor closed or the chapter was removed while this was uploading
          void discardUpload({ url }).catch(() => {});
          return;
        }
        remember(url);
        forget(chapter.media?.url);
        files.current.delete(uid);
        patch(uid, { media: { url, bytes: file.size, name: file.name }, upload: null });
      } catch (err) {
        if (session.current !== s) return;
        const msg = err instanceof Error ? err.message : "";
        patch(uid, {
          upload: null,
          uploadError: /403|permission|authori/i.test(msg)
            ? { en: "You don't have permission to upload.", th: "คุณไม่มีสิทธิ์อัปโหลดไฟล์" }
            : { en: "Upload failed — check the connection and try again.", th: "อัปโหลดไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง" },
        });
      }
    });
    pump();
  }

  return {
    start,
    retry: (uid: string) => {
      const file = files.current.get(uid);
      if (file) start(uid, file);
    },
    canRetry: (uid: string) => files.current.has(uid),
  };
}

export type ChapterUploader = ReturnType<typeof useChapterUploader>;

/* ----------------------------------------------------------------- editor */

/**
 * Step 2 of the course editor. Uploading is the main way in: drop a batch of
 * videos and PDFs and each becomes a chapter, named after its file, with its
 * length or page count already filled in. Chapters are compact rows that open
 * for the details; an article is written here directly.
 */
export function ChapterEditor({
  chapters,
  update,
  uploader,
  forget,
}: {
  chapters: ChapterDraft[];
  update: (fn: (chapters: ChapterDraft[]) => ChapterDraft[]) => void;
  uploader: ChapterUploader;
  forget: (url: string | undefined) => void;
}) {
  const { tt } = useT();
  const bulkInput = useRef<HTMLInputElement>(null);
  const oneInput = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [over, setOver] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);

  const patch = (uid: string, p: Partial<ChapterDraft>) =>
    update((chs) => chs.map((c) => (c.uid === uid ? { ...c, ...p } : c)));
  const toggle = (uid: string, force?: boolean) =>
    setOpen((s) => {
      const next = new Set(s);
      if (force ?? !next.has(uid)) next.add(uid);
      else next.delete(uid);
      return next;
    });

  function addFiles(list: FileList | File[] | null | undefined) {
    if (!list?.length) return;
    const bad: string[] = [];
    const good: File[] = [];
    for (const f of Array.from(list)) {
      const kind = kindOfFile(f);
      const problem = kind ? checkFile(f, kind === "VIDEO" ? "video" : "pdf") : null;
      if (!kind || problem) {
        bad.push(problem ? `${f.name} — ${tt(problem.en, problem.th)}` : `${f.name} — ${tt("not a video or PDF", "ไม่ใช่วิดีโอหรือ PDF")}`);
      } else good.push(f);
    }
    setRejected(bad);
    if (!good.length) return;
    // "01 intro", "02 basics", "10 wrap-up" stay in that order
    good.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const added = good.map((f) => ({
      ...newChapter(kindOfFile(f)!),
      titleEn: titleFromFile(f.name),
    }));
    update((chs) => [...chs.filter((c) => !isBlankChapter(c)), ...added]);
    added.forEach((ch, i) => uploader.start(ch.uid, good[i]!));
  }

  function addManual(kind: ChapterKindValue) {
    const ch = newChapter(kind);
    update((chs) => [...chs, ch]);
    toggle(ch.uid, true);
  }

  function move(index: number, by: -1 | 1) {
    update((chs) => {
      const next = [...chs];
      const to = index + by;
      if (to < 0 || to >= next.length) return chs;
      [next[index], next[to]] = [next[to]!, next[index]!];
      return next;
    });
  }

  function remove(ch: ChapterDraft) {
    forget(ch.media?.url);
    update((chs) => chs.filter((c) => c.uid !== ch.uid));
  }

  const totalMinutes = chapters.reduce((a, c) => a + (Number(c.minutes) || 0), 0);
  const needFile = chapters.filter((c) => c.kind !== "ARTICLE");
  const withFile = needFile.filter((c) => c.media).length;
  const uploading = chapters.filter((c) => c.upload).length;

  return (
    <div className="space-y-4">
      <input
        ref={bulkInput}
        type="file"
        multiple
        accept={[...MEDIA_LIMITS.video.types, ...MEDIA_LIMITS.pdf.types].join(",")}
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={oneInput}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          const uid = target.current;
          const ch = chapters.find((c) => c.uid === uid);
          if (!f || !ch) return;
          const problem = checkFile(f, ch.kind === "VIDEO" ? "video" : "pdf");
          if (problem) return patch(ch.uid, { uploadError: problem });
          uploader.start(ch.uid, f);
        }}
      />

      {/* the main way in */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line bg-surface/50 px-4 text-center transition",
          chapters.length ? "py-4 sm:flex-row sm:text-left" : "py-9",
          over && "border-brand bg-brand-tint/50",
        )}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-tint text-brand">
          <UploadCloud size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">
            {tt("Drop videos and PDFs to add chapters", "ลากวิดีโอและไฟล์ PDF มาวางเพื่อสร้างบทเรียน")}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {tt(
              `Each file becomes one chapter, in file-name order, with its length or page count filled in. Video up to ${MEDIA_LIMITS.video.maxMB} MB, PDF up to ${MEDIA_LIMITS.pdf.maxMB} MB.`,
              `ไฟล์ละ 1 บท เรียงตามชื่อไฟล์ ระบบใส่ความยาวหรือจำนวนหน้าให้ วิดีโอไม่เกิน ${MEDIA_LIMITS.video.maxMB} MB, PDF ไม่เกิน ${MEDIA_LIMITS.pdf.maxMB} MB`,
            )}
          </p>
        </div>
        <Button size="sm" variant={chapters.length ? "outline" : "primary"} onClick={() => bulkInput.current?.click()}>
          <UploadCloud size={15} /> {tt("Choose files", "เลือกไฟล์")}
        </Button>
      </div>

      {rejected.length ? (
        <div role="alert" className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-ink">
          <p className="font-medium">{tt("These files were skipped:", "ไฟล์เหล่านี้ไม่ถูกเพิ่ม:")}</p>
          <ul className="mt-1 list-disc pl-4">
            {rejected.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {chapters.length ? (
        <p className="text-xs text-muted">
          {tt(`${chapters.length} chapters`, `${chapters.length} บท`)} · {totalMinutes} {tt("min", "นาที")}
          {needFile.length ? (
            <>
              {" · "}
              {tt(`${withFile} of ${needFile.length} files uploaded`, `อัปโหลดไฟล์แล้ว ${withFile} จาก ${needFile.length}`)}
            </>
          ) : null}
          {uploading ? (
            <span className="ml-1 font-medium text-brand">
              · {tt(`${uploading} uploading…`, `กำลังอัปโหลด ${uploading} ไฟล์…`)}
            </span>
          ) : null}
        </p>
      ) : null}

      <ol className="space-y-2">
        {chapters.map((ch, i) => (
          <ChapterRow
            key={ch.uid}
            ch={ch}
            index={i}
            last={i === chapters.length - 1}
            open={open.has(ch.uid)}
            onToggle={() => toggle(ch.uid)}
            onPatch={(p) => patch(ch.uid, p)}
            onMove={(by) => move(i, by)}
            onRemove={() => remove(ch)}
            onPickFile={() => {
              target.current = ch.uid;
              if (oneInput.current) {
                oneInput.current.accept = (ch.kind === "VIDEO" ? MEDIA_LIMITS.video.types : MEDIA_LIMITS.pdf.types).join(",");
                oneInput.current.click();
              }
            }}
            onRemoveFile={() => {
              forget(ch.media?.url);
              patch(ch.uid, { media: null });
            }}
            onRetry={uploader.canRetry(ch.uid) ? () => uploader.retry(ch.uid) : undefined}
          />
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted">{tt("Or add one by hand:", "หรือเพิ่มเอง:")}</span>
        <Button size="sm" variant="secondary" onClick={() => addManual("VIDEO")}>
          <Plus size={14} /> {tt("Video", "วิดีโอ")}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => addManual("PDF")}>
          <Plus size={14} /> PDF
        </Button>
        <Button size="sm" variant="secondary" onClick={() => addManual("ARTICLE")}>
          <Plus size={14} /> {tt("Article", "บทความ")}
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- one row */

function ChapterRow({
  ch,
  index,
  last,
  open,
  onToggle,
  onPatch,
  onMove,
  onRemove,
  onPickFile,
  onRemoveFile,
  onRetry,
}: {
  ch: ChapterDraft;
  index: number;
  last: boolean;
  open: boolean;
  onToggle: () => void;
  onPatch: (p: Partial<ChapterDraft>) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  onPickFile: () => void;
  onRemoveFile: () => void;
  onRetry?: () => void;
}) {
  const { tt, lang } = useT();
  const Icon = KIND_ICON[ch.kind];
  const n = index + 1;
  const title = (lang === "th" ? ch.titleTh || ch.titleEn : ch.titleEn) || "";
  const words = ch.bodyEn.trim() ? ch.bodyEn.trim().split(/\s+/).length : 0;
  const missingTitle = !ch.titleEn.trim() && !isBlankChapter(ch);

  const kindLabel =
    ch.kind === "VIDEO"
      ? tt(`Video · ${ch.minutes || 0} min`, `วิดีโอ · ${ch.minutes || 0} นาที`)
      : ch.kind === "PDF"
        ? tt(`PDF · ${ch.pages || "?"} pages`, `PDF · ${ch.pages || "?"} หน้า`)
        : tt(`Article · ${ch.minutes || 0} min read`, `บทความ · อ่าน ${ch.minutes || 0} นาที`);

  const status = ch.upload ? (
    <span className="text-brand">
      {tt("Uploading", "กำลังอัปโหลด")} {ch.upload.progress}%
    </span>
  ) : ch.uploadError ? (
    <span className="text-accent">{tt(ch.uploadError.en, ch.uploadError.th)}</span>
  ) : ch.kind === "ARTICLE" ? (
    words ? (
      <span>{tt(`${words} words`, `${words} คำ`)}</span>
    ) : (
      <span className="text-amber">{tt("No text yet", "ยังไม่มีเนื้อหา")}</span>
    )
  ) : ch.media ? (
    <span className="inline-flex min-w-0 items-center gap-1 text-success">
      <CheckCircle2 size={12} className="shrink-0" />
      <span className="truncate">{ch.media.name}</span>
    </span>
  ) : (
    <span className="text-amber">{tt("No file yet — learners see a preview", "ยังไม่มีไฟล์ — ผู้เรียนจะเห็นตัวอย่างแทน")}</span>
  );

  return (
    <li
      className={cn(
        "overflow-hidden rounded-xl border bg-white transition-colors",
        open ? "border-brand/40 shadow-sm" : "border-line/70",
        missingTitle && "border-accent/50",
      )}
    >
      <div className="flex items-center gap-3 p-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-surface text-xs font-bold text-muted">
          {n}
        </span>
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg",
            ch.kind === "VIDEO" && "bg-accent/10 text-accent",
            ch.kind === "PDF" && "bg-brand-tint text-brand",
            ch.kind === "ARTICLE" && "bg-success/10 text-success",
          )}
        >
          <Icon size={16} />
        </span>
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left" aria-expanded={open}>
          <span className={cn("block truncate text-sm font-bold", title ? "text-ink" : "text-line-2")}>
            {title || tt("Untitled chapter", "บทที่ยังไม่มีชื่อ")}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted">
            <span className="shrink-0">{kindLabel}</span>
            <span className="shrink-0">·</span>
            {status}
          </span>
        </button>
        <div className="flex shrink-0 gap-1.5">
          <IconAction
            disabled={index === 0}
            aria-label={tt(`Move chapter ${n} up`, `เลื่อนบทที่ ${n} ขึ้น`)}
            onClick={() => onMove(-1)}
            className="max-sm:hidden"
          >
            <ArrowUp size={14} />
          </IconAction>
          <IconAction
            disabled={last}
            aria-label={tt(`Move chapter ${n} down`, `เลื่อนบทที่ ${n} ลง`)}
            onClick={() => onMove(1)}
            className="max-sm:hidden"
          >
            <ArrowDown size={14} />
          </IconAction>
          <IconAction
            tone="brand"
            aria-label={open ? tt(`Close chapter ${n}`, `ปิดบทที่ ${n}`) : tt(`Edit chapter ${n}`, `แก้ไขบทที่ ${n}`)}
            onClick={onToggle}
          >
            <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
          </IconAction>
          <IconAction tone="danger" aria-label={tt(`Remove chapter ${n}`, `ลบบทที่ ${n}`)} onClick={onRemove}>
            <Trash2 size={14} />
          </IconAction>
        </div>
      </div>

      {ch.upload ? (
        <div className="h-1 w-full bg-line/60">
          <div className="h-full bg-brand transition-[width]" style={{ width: `${ch.upload.progress}%` }} />
        </div>
      ) : null}

      {open ? (
        <div className="grid gap-3 border-t border-line/70 bg-surface/30 p-4 sm:grid-cols-2">
          <Field label={`${tt("Chapter title (English)", "ชื่อบทเรียน (อังกฤษ)")} *`}>
            <Input value={ch.titleEn} maxLength={160} onChange={(e) => onPatch({ titleEn: e.target.value })} />
          </Field>
          <Field label={tt("Chapter title (Thai)", "ชื่อบทเรียน (ไทย)")}>
            <Input
              value={ch.titleTh}
              maxLength={160}
              placeholder={tt("Optional", "ไม่บังคับ")}
              onChange={(e) => onPatch({ titleTh: e.target.value })}
            />
          </Field>
          <Field
            label={tt("Content type", "ประเภทเนื้อหา")}
            hint={
              ch.media || ch.upload
                ? tt("Remove the file to change the type.", "นำไฟล์ออกก่อนจึงจะเปลี่ยนประเภทได้")
                : undefined
            }
          >
            <Select
              value={ch.kind}
              disabled={Boolean(ch.media || ch.upload)}
              onChange={(e) => onPatch({ kind: e.target.value as ChapterKindValue })}
            >
              <option value="VIDEO">{tt("Video", "วิดีโอ")}</option>
              <option value="PDF">PDF</option>
              <option value="ARTICLE">{tt("Article", "บทความ")}</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={ch.kind === "ARTICLE" ? tt("Reading minutes", "นาทีในการอ่าน") : tt("Minutes", "นาที")}>
              <Input
                type="number"
                min={0}
                value={ch.minutes}
                onChange={(e) => onPatch({ minutes: e.target.value })}
              />
            </Field>
            {ch.kind === "PDF" ? (
              <Field label={tt("Pages", "จำนวนหน้า")}>
                <Input type="number" min={0} value={ch.pages} onChange={(e) => onPatch({ pages: e.target.value })} />
              </Field>
            ) : null}
          </div>

          {ch.kind !== "ARTICLE" ? (
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-sm font-medium text-ink">
                {ch.kind === "VIDEO" ? tt("Video file", "ไฟล์วิดีโอ") : tt("PDF file", "ไฟล์ PDF")}
              </p>
              {ch.upload ? (
                <div className="rounded-lg border border-line bg-white px-3 py-2.5 text-xs text-muted">
                  {tt("Uploading", "กำลังอัปโหลด")} {ch.upload.name} · {ch.upload.progress}%
                </div>
              ) : ch.media ? (
                <div className="flex items-center gap-3 rounded-lg border border-success/40 bg-success/5 px-3 py-2.5">
                  <CheckCircle2 size={18} className="shrink-0 text-success" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{ch.media.name}</p>
                    <p className="text-[11px] text-muted">{formatBytes(ch.media.bytes)}</p>
                  </div>
                  <a
                    href={ch.media.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={tt("Open the file", "เปิดไฟล์")}
                    className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink"
                  >
                    <ExternalLink size={14} />
                  </a>
                  <button
                    type="button"
                    onClick={onPickFile}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand hover:bg-brand-tint"
                  >
                    <RefreshCw size={13} /> {tt("Replace", "เปลี่ยนไฟล์")}
                  </button>
                  <button
                    type="button"
                    onClick={onRemoveFile}
                    aria-label={tt("Remove file", "นำไฟล์ออก")}
                    className="grid size-7 place-items-center rounded-md text-muted hover:bg-accent/10 hover:text-accent"
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-line bg-white px-3 py-2.5">
                  <span className="min-w-0 flex-1 text-xs text-muted">
                    {ch.uploadError ? (
                      <span className="inline-flex items-center gap-1 text-accent">
                        <AlertTriangle size={13} /> {tt(ch.uploadError.en, ch.uploadError.th)}
                      </span>
                    ) : (
                      tt(
                        "Optional. Without a file, learners see a preview built from the summary.",
                        "ไม่บังคับ ถ้าไม่มีไฟล์ ผู้เรียนจะเห็นตัวอย่างที่สร้างจากสรุปเนื้อหา",
                      )
                    )}
                  </span>
                  {ch.uploadError && onRetry ? (
                    <Button size="sm" variant="outline" onClick={onRetry}>
                      <RefreshCw size={14} /> {tt("Try again", "ลองอีกครั้ง")}
                    </Button>
                  ) : null}
                  <Button size="sm" variant="outline" onClick={onPickFile}>
                    <UploadCloud size={14} />
                    {ch.kind === "VIDEO" ? tt("Upload video", "อัปโหลดวิดีโอ") : tt("Upload PDF", "อัปโหลด PDF")}
                  </Button>
                </div>
              )}
            </div>
          ) : null}

          <Field label={tt("Summary (English)", "สรุปเนื้อหา (อังกฤษ)")}>
            <Textarea
              value={ch.summaryEn}
              placeholder={tt("What this chapter covers", "บทนี้ครอบคลุมเรื่องอะไร")}
              onChange={(e) => onPatch({ summaryEn: e.target.value })}
            />
          </Field>
          <Field label={tt("Summary (Thai)", "สรุปเนื้อหา (ไทย)")}>
            <Textarea
              value={ch.summaryTh}
              placeholder={tt("Optional", "ไม่บังคับ")}
              onChange={(e) => onPatch({ summaryTh: e.target.value })}
            />
          </Field>

          {ch.kind === "ARTICLE" ? (
            <>
              <Field
                className="sm:col-span-2"
                label={tt("Article text (English)", "เนื้อหาบทความ (อังกฤษ)")}
                hint={tt("Leave a blank line between paragraphs.", "เว้นบรรทัดว่างระหว่างย่อหน้า")}
              >
                <Textarea
                  rows={8}
                  value={ch.bodyEn}
                  onChange={(e) => onPatch({ bodyEn: e.target.value })}
                />
              </Field>
              <Field className="sm:col-span-2" label={tt("Article text (Thai)", "เนื้อหาบทความ (ไทย)")}>
                <Textarea
                  rows={8}
                  value={ch.bodyTh}
                  placeholder={tt("Optional", "ไม่บังคับ")}
                  onChange={(e) => onPatch({ bodyTh: e.target.value })}
                />
              </Field>
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
