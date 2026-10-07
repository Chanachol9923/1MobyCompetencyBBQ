"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  CheckCircle2,
  Clapperboard,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Heart,
  ImagePlus,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { Button, Card, Field, Input, Modal, Pill, Select, Textarea } from "@/components/ui";
import {
  CountTile,
  IconAction,
  SearchInput,
  TableWrap,
  Td,
  Th,
} from "@/components/admin/shared";
import { ResultBanner } from "@/components/admin/rbac-shared";
import {
  FileField,
  checkFile,
  readVideo,
  uploadMedia,
  type PickedFile,
} from "@/components/admin/media-upload";
import { countPdfPages } from "@/components/learning/PdfReader";
import { LMS_POINTS, MEDIA_LIMITS } from "@/components/learning/model";
import {
  formatBytes,
  formatDuration,
  type AdminDocumentRow,
  type AdminShortRow,
  type MediaAdminData,
  type MediaOption,
  type MediaResult,
  type MediaStatus,
} from "@/components/learning/media-types";
import {
  deleteDocument,
  deleteShort,
  discardUpload,
  saveDocument,
  saveShort,
  setDocumentPublished,
  setShortPublished,
} from "@/server/learning-media";
import { useT } from "@/lib/i18n";

/* ------------------------------------------------------------- plumbing */

const fileName = (url: string) => decodeURIComponent(url.split("/").pop() ?? "file");

/**
 * Shared bits of both editors: the banner, the pending flag, and the files
 * uploaded while a form is open — those are deleted again if the form is
 * cancelled, so abandoned uploads do not pile up in storage.
 */
function useEditor() {
  const [result, setResult] = useState<MediaResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const fresh = useRef(new Set<string>());

  const forget = (url: string | null | undefined) => {
    if (url && fresh.current.delete(url)) void discardUpload({ url }).catch(() => {});
  };
  const remember = (url: string | null | undefined) => {
    if (url) fresh.current.add(url);
  };
  const discardAll = () => {
    for (const url of fresh.current) void discardUpload({ url }).catch(() => {});
    fresh.current.clear();
  };

  return {
    result,
    setResult,
    formError,
    setFormError,
    busy,
    startTransition,
    forget,
    remember,
    discardAll,
    keepAll: () => fresh.current.clear(),
  };
}

function StatusPill({ status }: { status: MediaStatus }) {
  const { t } = useT();
  return status === "PUBLISHED" ? (
    <Pill tone="success" className="whitespace-nowrap">{t("status.published")}</Pill>
  ) : (
    <Pill tone="warn" className="whitespace-nowrap">{t("status.draft")}</Pill>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mb-4 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-ink"
    >
      {message}
    </p>
  );
}

function TagFields({
  competencies,
  courses,
  competencyId,
  courseId,
  onCompetency,
  onCourse,
}: {
  competencies: MediaOption[];
  courses: MediaOption[];
  competencyId: string;
  courseId: string;
  onCompetency: (id: string) => void;
  onCourse: (id: string) => void;
}) {
  const { tt, lang } = useT();
  const name = (o: MediaOption) => (lang === "th" ? (o.nameTh ?? o.nameEn) : o.nameEn);
  return (
    <>
      <Field
        label={tt("Competency", "สมรรถนะ")}
        hint={tt("Shown as a tag, and used to group related learning.", "แสดงเป็นแท็ก และใช้จัดกลุ่มเนื้อหาที่เกี่ยวข้อง")}
      >
        <Select value={competencyId} onChange={(e) => onCompetency(e.target.value)}>
          <option value="">{tt("None", "ไม่ระบุ")}</option>
          {competencies.map((c) => (
            <option key={c.id} value={c.id}>
              {name(c)}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label={tt("Related course", "หลักสูตรที่เกี่ยวข้อง")}
        hint={tt("Learners get a link to go deeper.", "ผู้เรียนจะเห็นลิงก์ไปเรียนต่อในหลักสูตรนี้")}
      >
        <Select value={courseId} onChange={(e) => onCourse(e.target.value)}>
          <option value="">{tt("None", "ไม่ระบุ")}</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {name(c)}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}

/* ================================================================ shorts */

type ShortDraft = {
  id: string;
  titleEn: string;
  titleTh: string;
  captionEn: string;
  captionTh: string;
  video: PickedFile | null;
  durationSec: number;
  landscape: boolean;
  posterUrl: string | null;
  competencyId: string;
  courseId: string;
};

const emptyShort = (): ShortDraft => ({
  id: "",
  titleEn: "",
  titleTh: "",
  captionEn: "",
  captionTh: "",
  video: null,
  durationSec: 0,
  landscape: false,
  posterUrl: null,
  competencyId: "",
  courseId: "",
});

const fromShort = (s: AdminShortRow): ShortDraft => ({
  id: s.id,
  titleEn: s.titleEn,
  titleTh: s.titleTh ?? "",
  captionEn: s.captionEn ?? "",
  captionTh: s.captionTh ?? "",
  video: { url: s.videoUrl, bytes: s.videoBytes, name: fileName(s.videoUrl) },
  durationSec: s.durationSec,
  landscape: false,
  posterUrl: s.posterUrl,
  competencyId: s.competencyId ?? "",
  courseId: s.courseId ?? "",
});

/** Upload, tag and publish the Reels-style shorts. */
export function ShortsAdmin({ data }: { data: MediaAdminData }) {
  const { t, tt, lang } = useT();
  const ed = useEditor();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ShortDraft>(emptyShort);
  const [confirm, setConfirm] = useState<AdminShortRow | null>(null);
  const [posterBusy, setPosterBusy] = useState(false);
  const meta = useRef<{ durationSec: number; landscape: boolean; poster: Blob | null } | null>(null);
  const posterInput = useRef<HTMLInputElement>(null);

  const { shorts } = data;
  const title = (s: { titleEn: string; titleTh: string | null }) =>
    lang === "th" ? (s.titleTh ?? s.titleEn) : s.titleEn;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? shorts.filter((s) => `${s.titleEn} ${s.titleTh ?? ""}`.toLowerCase().includes(q))
      : shorts;
  }, [shorts, query]);

  const totals = useMemo(
    () => ({
      published: shorts.filter((s) => s.status === "PUBLISHED").length,
      views: shorts.reduce((a, s) => a + s.views, 0),
      completions: shorts.reduce((a, s) => a + s.completions, 0),
      likes: shorts.reduce((a, s) => a + s.likes, 0),
    }),
    [shorts],
  );

  const set = <K extends keyof ShortDraft>(k: K, v: ShortDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  function openEditor(row?: AdminShortRow) {
    setDraft(row ? fromShort(row) : emptyShort());
    ed.setFormError(null);
    setOpen(true);
  }
  function close() {
    ed.discardAll();
    setOpen(false);
  }

  async function setPoster(blob: Blob, name: string) {
    setPosterBusy(true);
    try {
      const url = await uploadMedia(blob, "image", "posters", undefined, name);
      ed.remember(url);
      setDraft((d) => {
        ed.forget(d.posterUrl);
        return { ...d, posterUrl: url };
      });
    } catch {
      ed.setFormError(tt("The cover image could not be uploaded.", "อัปโหลดภาพปกไม่สำเร็จ"));
    } finally {
      setPosterBusy(false);
    }
  }

  function save(publish: boolean) {
    if (!draft.video) {
      ed.setFormError(tt("Upload a video first.", "กรุณาอัปโหลดวิดีโอก่อน"));
      return;
    }
    const payload = {
      id: draft.id,
      titleEn: draft.titleEn,
      titleTh: draft.titleTh,
      captionEn: draft.captionEn,
      captionTh: draft.captionTh,
      videoUrl: draft.video.url,
      posterUrl: draft.posterUrl,
      videoBytes: draft.video.bytes,
      durationSec: draft.durationSec,
      competencyId: draft.competencyId,
      courseId: draft.courseId,
      publish,
    };
    ed.setFormError(null);
    ed.startTransition(async () => {
      const res = await saveShort(payload);
      if (res.ok) {
        ed.keepAll();
        setOpen(false);
        ed.setResult(res);
      } else {
        ed.setFormError(tt(res.error.en, res.error.th));
      }
    });
  }

  const run = (fn: () => Promise<MediaResult>) =>
    ed.startTransition(async () => ed.setResult(await fn()));

  return (
    <div>
      <ResultBanner result={ed.result} onDismiss={() => ed.setResult(null)} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <CountTile
          value={totals.published}
          label={tt(`Live (of ${shorts.length})`, `เผยแพร่อยู่ (จาก ${shorts.length})`)}
          tone="success"
          icon={<Clapperboard size={20} />}
        />
        <CountTile value={totals.views} label={tt("People reached", "จำนวนผู้ชม")} icon={<Users size={20} />} />
        <CountTile
          value={totals.completions}
          label={tt("Watched to the end", "ดูจนจบ")}
          tone="ink"
          icon={<CheckCircle2 size={20} />}
        />
        <CountTile value={totals.likes} label={tt("Likes", "ถูกใจ")} tone="amber" icon={<Heart size={20} />} />
      </div>

      <Card className="mt-5">
        <div className="flex flex-wrap items-center gap-3 p-5">
          <h3 className="text-lg font-bold text-ink">Shorts</h3>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={tt("Search shorts...", "ค้นหาคลิปสั้น...")}
            className="w-full sm:w-60"
          />
          <Button className="ml-auto" size="sm" onClick={() => openEditor()}>
            <Plus size={15} />
            {tt("Upload short", "อัปโหลดคลิปสั้น")}
          </Button>
        </div>

        <TableWrap>
          <table className="w-full min-w-[860px] border-collapse xl:min-w-0">
            <thead>
              <tr className="border-y border-line/70 bg-surface/60">
                <Th>{tt("Short", "คลิปสั้น")}</Th>
                <Th>{tt("Competency", "สมรรถนะ")}</Th>
                <Th>{tt("Viewers", "ผู้ชม")}</Th>
                <Th>{tt("Watched to end", "ดูจนจบ")}</Th>
                <Th>{tt("Likes", "ถูกใจ")}</Th>
                <Th>{t("label.status")}</Th>
                <Th className="text-right">{t("label.actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <tr key={s.id} className="border-b border-line/60 last:border-0">
                  <Td>
                    <div className="flex items-center gap-3">
                      <span className="relative h-14 w-8 shrink-0 overflow-hidden rounded-md bg-ink">
                        {s.posterUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.posterUrl} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-bold">{title(s)}</span>
                        <span className="block text-[11px] text-muted">
                          {formatDuration(s.durationSec)} · {formatBytes(s.videoBytes)}
                        </span>
                      </span>
                    </div>
                  </Td>
                  <Td className="text-muted">
                    {s.competency
                      ? lang === "th"
                        ? (s.competency.nameTh ?? s.competency.nameEn)
                        : s.competency.nameEn
                      : "—"}
                  </Td>
                  <Td className="text-muted">{s.views}</Td>
                  <Td className="text-muted">
                    {s.completions}
                    {s.views ? (
                      <span className="ml-1 text-[11px] text-line-2">
                        ({Math.round((s.completions / s.views) * 100)}%)
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-muted">{s.likes}</Td>
                  <Td>
                    <StatusPill status={s.status} />
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      <IconAction
                        disabled={ed.busy}
                        aria-label={
                          s.status === "PUBLISHED"
                            ? tt("Unpublish", "ยกเลิกการเผยแพร่")
                            : tt("Publish", "เผยแพร่")
                        }
                        title={
                          s.status === "PUBLISHED"
                            ? tt("Unpublish", "ยกเลิกการเผยแพร่")
                            : tt("Publish", "เผยแพร่")
                        }
                        onClick={() =>
                          run(() => setShortPublished({ id: s.id, publish: s.status !== "PUBLISHED" }))
                        }
                      >
                        {s.status === "PUBLISHED" ? <EyeOff size={14} /> : <Eye size={14} />}
                      </IconAction>
                      <IconAction
                        tone="brand"
                        aria-label={`${t("action.edit")} ${s.titleEn}`}
                        onClick={() => openEditor(s)}
                      >
                        <Pencil size={14} />
                      </IconAction>
                      <IconAction
                        tone="danger"
                        aria-label={`${t("action.delete")} ${s.titleEn}`}
                        onClick={() => setConfirm(s)}
                      >
                        <Trash2 size={14} />
                      </IconAction>
                    </div>
                  </Td>
                </tr>
              ))}
              {visible.length === 0 ? (
                <tr>
                  <Td colSpan={7} className="py-10 text-center text-muted">
                    {shorts.length
                      ? t("admin.noMatch")
                      : tt(
                          "No shorts yet. Upload a vertical video of up to 3 minutes to start the feed.",
                          "ยังไม่มีคลิปสั้น อัปโหลดวิดีโอแนวตั้งความยาวไม่เกิน 3 นาทีเพื่อเริ่มฟีด",
                        )}
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <Modal
        open={open}
        onClose={close}
        title={draft.id ? tt("Edit short", "แก้ไขคลิปสั้น") : tt("Upload short", "อัปโหลดคลิปสั้น")}
        subtitle={tt(
          `A vertical (9:16) video of up to ${MEDIA_LIMITS.shortMaxSeconds / 60} minutes. Learners earn ${LMS_POINTS.short} points for watching one to the end.`,
          `วิดีโอแนวตั้ง (9:16) ยาวไม่เกิน ${MEDIA_LIMITS.shortMaxSeconds / 60} นาที ผู้เรียนได้ ${LMS_POINTS.short} คะแนนเมื่อดูจนจบ`,
        )}
        width="max-w-3xl"
        footer={
          <>
            <Button variant="outline" onClick={close}>
              {t("action.cancel")}
            </Button>
            <Button variant="secondary" onClick={() => save(false)} disabled={ed.busy || posterBusy}>
              {tt("Save as draft", "บันทึกฉบับร่าง")}
            </Button>
            <Button onClick={() => save(true)} disabled={ed.busy || posterBusy}>
              {tt("Publish", "เผยแพร่")}
            </Button>
          </>
        }
      >
        <FormError message={ed.formError} />
        <div className="grid gap-5 sm:grid-cols-[160px_minmax(0,1fr)]">
          {/* cover */}
          <div>
            <div className="relative mx-auto aspect-[9/16] w-32 overflow-hidden rounded-xl bg-ink sm:w-full">
              {draft.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.posterUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center p-3 text-center text-[11px] text-white/60">
                  {posterBusy
                    ? tt("Making the cover…", "กำลังสร้างภาพปก…")
                    : tt("The cover is taken from the video", "ระบบจะใช้ภาพจากวิดีโอเป็นปก")}
                </div>
              )}
            </div>
            <input
              ref={posterInput}
              type="file"
              accept={MEDIA_LIMITS.image.types.join(",")}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                const problem = checkFile(f, "image");
                if (problem) return ed.setFormError(tt(problem.en, problem.th));
                void setPoster(f, f.name);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-full"
              disabled={posterBusy}
              onClick={() => posterInput.current?.click()}
            >
              <ImagePlus size={14} /> {tt("Change cover", "เปลี่ยนภาพปก")}
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-sm font-medium text-ink">{tt("Video", "วิดีโอ")} *</p>
              <FileField
                kind="video"
                folder="shorts"
                value={draft.video}
                hint={tt(
                  `Vertical MP4 works best · up to ${MEDIA_LIMITS.shortMaxSeconds / 60} min · ${MEDIA_LIMITS.video.maxMB} MB`,
                  `แนะนำ MP4 แนวตั้ง · ไม่เกิน ${MEDIA_LIMITS.shortMaxSeconds / 60} นาที · ${MEDIA_LIMITS.video.maxMB} MB`,
                )}
                prepare={async (file) => {
                  const m = await readVideo(file);
                  if (m.durationSec > MEDIA_LIMITS.shortMaxSeconds) {
                    return {
                      en: `This video is ${formatDuration(m.durationSec)} long; a short can be at most ${MEDIA_LIMITS.shortMaxSeconds / 60} minutes. Add longer videos as a course chapter.`,
                      th: `วิดีโอนี้ยาว ${formatDuration(m.durationSec)} คลิปสั้นยาวได้ไม่เกิน ${MEDIA_LIMITS.shortMaxSeconds / 60} นาที วิดีโอที่ยาวกว่านี้ให้เพิ่มเป็นบทเรียนในหลักสูตร`,
                    };
                  }
                  meta.current = { durationSec: m.durationSec, landscape: m.width > m.height, poster: m.poster };
                  return null;
                }}
                onChange={(video) => {
                  ed.forget(draft.video?.url);
                  if (!video) {
                    setDraft((d) => ({ ...d, video: null, durationSec: 0, landscape: false }));
                    return;
                  }
                  ed.remember(video.url);
                  const m = meta.current;
                  setDraft((d) => ({
                    ...d,
                    video,
                    durationSec: m?.durationSec ?? d.durationSec,
                    landscape: m?.landscape ?? false,
                    // a title to start from, which the admin will usually rewrite
                    titleEn: d.titleEn || video.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " "),
                  }));
                  if (m?.poster) void setPoster(m.poster, "cover.jpg");
                }}
              />
              {draft.video ? (
                <p className="mt-1.5 text-xs text-muted">
                  {tt("Length", "ความยาว")} {formatDuration(draft.durationSec)}
                  {draft.landscape ? (
                    <span className="ml-2 text-amber">
                      {tt(
                        "· This video is landscape; it will be cropped to fill a phone screen.",
                        "· วิดีโอนี้เป็นแนวนอน ภาพจะถูกครอปให้เต็มจอมือถือ",
                      )}
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>

            <Field label={`${tt("Title (English)", "ชื่อ (อังกฤษ)")} *`}>
              <Input value={draft.titleEn} maxLength={120} onChange={(e) => set("titleEn", e.target.value)} />
            </Field>
            <Field label={tt("Title (Thai)", "ชื่อ (ไทย)")}>
              <Input
                value={draft.titleTh}
                maxLength={120}
                placeholder={tt("Optional", "ไม่บังคับ")}
                onChange={(e) => set("titleTh", e.target.value)}
              />
            </Field>
            <Field label={tt("Caption (English)", "คำบรรยาย (อังกฤษ)")}>
              <Textarea
                value={draft.captionEn}
                maxLength={500}
                placeholder={tt("One or two lines on the key point", "สรุปประเด็นสำคัญ 1-2 บรรทัด")}
                onChange={(e) => set("captionEn", e.target.value)}
              />
            </Field>
            <Field label={tt("Caption (Thai)", "คำบรรยาย (ไทย)")}>
              <Textarea
                value={draft.captionTh}
                maxLength={500}
                placeholder={tt("Optional", "ไม่บังคับ")}
                onChange={(e) => set("captionTh", e.target.value)}
              />
            </Field>
            <TagFields
              competencies={data.competencies}
              courses={data.courses}
              competencyId={draft.competencyId}
              courseId={draft.courseId}
              onCompetency={(id) => set("competencyId", id)}
              onCourse={(id) => set("courseId", id)}
            />
          </div>
        </div>
      </Modal>

      <DeleteConfirm
        open={Boolean(confirm)}
        title={tt("Delete short", "ลบคลิปสั้น")}
        name={confirm ? title(confirm) : ""}
        detail={tt(
          "The video file is deleted too, along with its views and likes.",
          "ไฟล์วิดีโอ ยอดชม และยอดถูกใจจะถูกลบไปด้วย",
        )}
        busy={ed.busy}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          const target = confirm;
          setConfirm(null);
          if (target) run(() => deleteShort({ id: target.id }));
        }}
      />
    </div>
  );
}

/* ============================================================= documents */

type DocDraft = {
  id: string;
  titleEn: string;
  titleTh: string;
  descriptionEn: string;
  descriptionTh: string;
  file: PickedFile | null;
  pages: number;
  competencyId: string;
  courseId: string;
};

const emptyDoc = (): DocDraft => ({
  id: "",
  titleEn: "",
  titleTh: "",
  descriptionEn: "",
  descriptionTh: "",
  file: null,
  pages: 0,
  competencyId: "",
  courseId: "",
});

const fromDoc = (d: AdminDocumentRow): DocDraft => ({
  id: d.id,
  titleEn: d.titleEn,
  titleTh: d.titleTh ?? "",
  descriptionEn: d.descriptionEn ?? "",
  descriptionTh: d.descriptionTh ?? "",
  file: { url: d.fileUrl, bytes: d.fileBytes, name: fileName(d.fileUrl) },
  pages: d.pages,
  competencyId: d.competencyId ?? "",
  courseId: d.courseId ?? "",
});

/** Upload and publish PDF handbooks, guides and slide decks. */
export function DocumentsAdmin({ data }: { data: MediaAdminData }) {
  const { t, tt, lang } = useT();
  const ed = useEditor();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DocDraft>(emptyDoc);
  const [confirm, setConfirm] = useState<AdminDocumentRow | null>(null);
  const pagesRead = useRef(0);

  const { documents } = data;
  const title = (d: { titleEn: string; titleTh: string | null }) =>
    lang === "th" ? (d.titleTh ?? d.titleEn) : d.titleEn;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? documents.filter((d) => `${d.titleEn} ${d.titleTh ?? ""}`.toLowerCase().includes(q))
      : documents;
  }, [documents, query]);

  const totals = useMemo(
    () => ({
      published: documents.filter((d) => d.status === "PUBLISHED").length,
      readers: documents.reduce((a, d) => a + d.readers, 0),
      completions: documents.reduce((a, d) => a + d.completions, 0),
      pages: documents.reduce((a, d) => a + d.pages, 0),
    }),
    [documents],
  );

  const set = <K extends keyof DocDraft>(k: K, v: DocDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  function openEditor(row?: AdminDocumentRow) {
    setDraft(row ? fromDoc(row) : emptyDoc());
    ed.setFormError(null);
    setOpen(true);
  }
  function close() {
    ed.discardAll();
    setOpen(false);
  }

  function save(publish: boolean) {
    if (!draft.file) {
      ed.setFormError(tt("Upload a PDF first.", "กรุณาอัปโหลดไฟล์ PDF ก่อน"));
      return;
    }
    const payload = {
      id: draft.id,
      titleEn: draft.titleEn,
      titleTh: draft.titleTh,
      descriptionEn: draft.descriptionEn,
      descriptionTh: draft.descriptionTh,
      fileUrl: draft.file.url,
      fileBytes: draft.file.bytes,
      pages: draft.pages,
      competencyId: draft.competencyId,
      courseId: draft.courseId,
      publish,
    };
    ed.setFormError(null);
    ed.startTransition(async () => {
      const res = await saveDocument(payload);
      if (res.ok) {
        ed.keepAll();
        setOpen(false);
        ed.setResult(res);
      } else {
        ed.setFormError(tt(res.error.en, res.error.th));
      }
    });
  }

  const run = (fn: () => Promise<MediaResult>) =>
    ed.startTransition(async () => ed.setResult(await fn()));

  return (
    <div>
      <ResultBanner result={ed.result} onDismiss={() => ed.setResult(null)} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <CountTile
          value={totals.published}
          label={tt(`Live (of ${documents.length})`, `เผยแพร่อยู่ (จาก ${documents.length})`)}
          tone="success"
          icon={<FileText size={20} />}
        />
        <CountTile value={totals.readers} label={tt("Readers", "ผู้อ่าน")} icon={<Users size={20} />} />
        <CountTile
          value={totals.completions}
          label={tt("Read to the end", "อ่านจนจบ")}
          tone="ink"
          icon={<CheckCircle2 size={20} />}
        />
        <CountTile value={totals.pages} label={tt("Pages in the library", "จำนวนหน้าในคลัง")} tone="amber" />
      </div>

      <Card className="mt-5">
        <div className="flex flex-wrap items-center gap-3 p-5">
          <h3 className="text-lg font-bold text-ink">{tt("Documents", "เอกสาร")}</h3>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={tt("Search documents...", "ค้นหาเอกสาร...")}
            className="w-full sm:w-60"
          />
          <Button className="ml-auto" size="sm" onClick={() => openEditor()}>
            <Plus size={15} />
            {tt("Upload PDF", "อัปโหลด PDF")}
          </Button>
        </div>

        <TableWrap>
          <table className="w-full min-w-[860px] border-collapse xl:min-w-0">
            <thead>
              <tr className="border-y border-line/70 bg-surface/60">
                <Th>{tt("Document", "เอกสาร")}</Th>
                <Th>{tt("Competency", "สมรรถนะ")}</Th>
                <Th>{tt("Readers", "ผู้อ่าน")}</Th>
                <Th>{tt("Read to end", "อ่านจนจบ")}</Th>
                <Th>{t("label.status")}</Th>
                <Th className="text-right">{t("label.actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((d) => (
                <tr key={d.id} className="border-b border-line/60 last:border-0">
                  <Td>
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-tint text-brand">
                        <FileText size={17} />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-bold">{title(d)}</span>
                        <span className="block text-[11px] text-muted">
                          {d.pages} {tt("pages", "หน้า")} · {formatBytes(d.fileBytes)}
                        </span>
                      </span>
                    </div>
                  </Td>
                  <Td className="text-muted">
                    {d.competency
                      ? lang === "th"
                        ? (d.competency.nameTh ?? d.competency.nameEn)
                        : d.competency.nameEn
                      : "—"}
                  </Td>
                  <Td className="text-muted">{d.readers}</Td>
                  <Td className="text-muted">{d.completions}</Td>
                  <Td>
                    <StatusPill status={d.status} />
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      <a
                        href={d.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={tt("Open the PDF", "เปิดไฟล์ PDF")}
                        title={tt("Open the PDF", "เปิดไฟล์ PDF")}
                        className="grid size-8 place-items-center rounded-lg border border-line bg-white text-muted transition hover:bg-surface hover:text-ink max-lg:size-11"
                      >
                        <ExternalLink size={14} />
                      </a>
                      <IconAction
                        disabled={ed.busy}
                        aria-label={
                          d.status === "PUBLISHED"
                            ? tt("Unpublish", "ยกเลิกการเผยแพร่")
                            : tt("Publish", "เผยแพร่")
                        }
                        title={
                          d.status === "PUBLISHED"
                            ? tt("Unpublish", "ยกเลิกการเผยแพร่")
                            : tt("Publish", "เผยแพร่")
                        }
                        onClick={() =>
                          run(() =>
                            setDocumentPublished({ id: d.id, publish: d.status !== "PUBLISHED" }),
                          )
                        }
                      >
                        {d.status === "PUBLISHED" ? <EyeOff size={14} /> : <Eye size={14} />}
                      </IconAction>
                      <IconAction
                        tone="brand"
                        aria-label={`${t("action.edit")} ${d.titleEn}`}
                        onClick={() => openEditor(d)}
                      >
                        <Pencil size={14} />
                      </IconAction>
                      <IconAction
                        tone="danger"
                        aria-label={`${t("action.delete")} ${d.titleEn}`}
                        onClick={() => setConfirm(d)}
                      >
                        <Trash2 size={14} />
                      </IconAction>
                    </div>
                  </Td>
                </tr>
              ))}
              {visible.length === 0 ? (
                <tr>
                  <Td colSpan={6} className="py-10 text-center text-muted">
                    {documents.length
                      ? t("admin.noMatch")
                      : tt(
                          "No documents yet. Upload a handbook, guide or slide deck as a PDF.",
                          "ยังไม่มีเอกสาร อัปโหลดคู่มือ เอกสารแนะนำ หรือสไลด์เป็นไฟล์ PDF",
                        )}
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <Modal
        open={open}
        onClose={close}
        title={draft.id ? tt("Edit document", "แก้ไขเอกสาร") : tt("Upload document", "อัปโหลดเอกสาร")}
        subtitle={tt(
          `Employees read it in the app and earn ${LMS_POINTS.document} points for reaching the last page.`,
          `พนักงานอ่านได้ในแอป และได้ ${LMS_POINTS.document} คะแนนเมื่ออ่านถึงหน้าสุดท้าย`,
        )}
        width="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={close}>
              {t("action.cancel")}
            </Button>
            <Button variant="secondary" onClick={() => save(false)} disabled={ed.busy}>
              {tt("Save as draft", "บันทึกฉบับร่าง")}
            </Button>
            <Button onClick={() => save(true)} disabled={ed.busy}>
              {tt("Publish", "เผยแพร่")}
            </Button>
          </>
        }
      >
        <FormError message={ed.formError} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-sm font-medium text-ink">PDF *</p>
            <FileField
              kind="pdf"
              folder="documents"
              value={draft.file}
              prepare={async (file) => {
                pagesRead.current = await countPdfPages(file);
                return null;
              }}
              onChange={(file) => {
                ed.forget(draft.file?.url);
                if (!file) {
                  setDraft((d) => ({ ...d, file: null, pages: 0 }));
                  return;
                }
                ed.remember(file.url);
                setDraft((d) => ({
                  ...d,
                  file,
                  pages: pagesRead.current || d.pages,
                  titleEn: d.titleEn || file.name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " "),
                }));
              }}
            />
            {draft.file ? (
              <p className="mt-1.5 text-xs text-muted">
                {draft.pages} {tt("pages", "หน้า")}
                {draft.id ? (
                  <span className="ml-2">
                    {tt(
                      "· Replacing the file starts everyone from page 1 again.",
                      "· หากเปลี่ยนไฟล์ ผู้อ่านทุกคนจะเริ่มจากหน้า 1 ใหม่",
                    )}
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
          <Field label={`${tt("Title (English)", "ชื่อ (อังกฤษ)")} *`}>
            <Input value={draft.titleEn} maxLength={160} onChange={(e) => set("titleEn", e.target.value)} />
          </Field>
          <Field label={tt("Title (Thai)", "ชื่อ (ไทย)")}>
            <Input
              value={draft.titleTh}
              maxLength={160}
              placeholder={tt("Optional", "ไม่บังคับ")}
              onChange={(e) => set("titleTh", e.target.value)}
            />
          </Field>
          <Field label={tt("Description (English)", "คำอธิบาย (อังกฤษ)")}>
            <Textarea
              value={draft.descriptionEn}
              maxLength={800}
              placeholder={tt("What's inside and who it's for", "มีเนื้อหาอะไร และเหมาะกับใคร")}
              onChange={(e) => set("descriptionEn", e.target.value)}
            />
          </Field>
          <Field label={tt("Description (Thai)", "คำอธิบาย (ไทย)")}>
            <Textarea
              value={draft.descriptionTh}
              maxLength={800}
              placeholder={tt("Optional", "ไม่บังคับ")}
              onChange={(e) => set("descriptionTh", e.target.value)}
            />
          </Field>
          <TagFields
            competencies={data.competencies}
            courses={data.courses}
            competencyId={draft.competencyId}
            courseId={draft.courseId}
            onCompetency={(id) => set("competencyId", id)}
            onCourse={(id) => set("courseId", id)}
          />
        </div>
      </Modal>

      <DeleteConfirm
        open={Boolean(confirm)}
        title={tt("Delete document", "ลบเอกสาร")}
        name={confirm ? title(confirm) : ""}
        detail={tt(
          "The PDF is deleted too, along with everyone's reading progress.",
          "ไฟล์ PDF และความคืบหน้าการอ่านของทุกคนจะถูกลบไปด้วย",
        )}
        busy={ed.busy}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          const target = confirm;
          setConfirm(null);
          if (target) run(() => deleteDocument({ id: target.id }));
        }}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- delete */

function DeleteConfirm({
  open,
  title,
  name,
  detail,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  name: string;
  detail: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t, tt } = useT();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button variant="danger" disabled={busy} onClick={onConfirm}>
            {t("action.delete")}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-muted">
        {tt("Delete", "ลบ")} <span className="font-medium text-ink">{name}</span>?{" "}
        {detail} {tt("This can't be undone. To hide it for now, unpublish it instead.", "การลบย้อนกลับไม่ได้ หากต้องการซ่อนชั่วคราว ให้ยกเลิกการเผยแพร่แทน")}
      </p>
    </Modal>
  );
}
