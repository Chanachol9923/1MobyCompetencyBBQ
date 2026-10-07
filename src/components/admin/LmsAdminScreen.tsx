"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Eye,
  EyeOff,
  FileText,
  GraduationCap,
  Newspaper,
  Pencil,
  Plus,
  Tags,
  Trash2,
  Video,
} from "lucide-react";
import {
  Button,
  Card,
  Field,
  Input,
  Modal,
  PageHeading,
  Pill,
  Select,
  Textarea,
} from "@/components/ui";
import {
  CountTile,
  IconAction,
  SearchInput,
  TableWrap,
  Td,
  Th,
  coverStyle,
} from "@/components/admin/shared";
import { ResultBanner } from "@/components/admin/rbac-shared";
import type {
  ActionResult,
  AdminCourseRow,
  ChapterKindValue,
  CompetencyGroupValue,
  LmsAdminData,
} from "@/components/admin/content-types";
import { deleteCourse, saveCourse, setCourseStatus } from "@/server/admin-content";
import { useT } from "@/lib/i18n";

const CATEGORIES: CompetencyGroupValue[] = ["CORE", "FUNCTIONAL", "MANAGERIAL"];

const CATEGORY_LABEL: Record<CompetencyGroupValue, { key: string }> = {
  CORE: { key: "group.core" },
  FUNCTIONAL: { key: "group.functional" },
  MANAGERIAL: { key: "group.managerial" },
};

const KIND_ICON: Record<ChapterKindValue, typeof Video> = {
  VIDEO: Video,
  PDF: FileText,
  ARTICLE: Newspaper,
};

const COVERS = [
  "from-[#006bff] to-[#0b1b3f]",
  "from-[#f05123] to-[#faa21b]",
  "from-[#00b916] to-[#0b1b3f]",
  "from-[#006bff] to-[#00b916]",
  "from-[#1c1e29] to-[#006bff]",
];

type ChapterDraft = {
  /** the real chapter id when it already exists — keeping it keeps its progress */
  id: string;
  /** stable key for React while a brand new chapter has no id yet */
  uid: string;
  kind: ChapterKindValue;
  titleEn: string;
  titleTh: string;
  summaryEn: string;
  summaryTh: string;
  minutes: string;
  pages: string;
};

type Draft = {
  titleEn: string;
  titleTh: string;
  descriptionEn: string;
  descriptionTh: string;
  category: CompetencyGroupValue;
  competencyId: string;
  hours: string;
  cover: string;
  chapters: ChapterDraft[];
};

let uidCounter = 0;
const nextUid = () => `new-${++uidCounter}`;

const newChapter = (): ChapterDraft => ({
  id: "",
  uid: nextUid(),
  kind: "VIDEO",
  titleEn: "",
  titleTh: "",
  summaryEn: "",
  summaryTh: "",
  minutes: "10",
  pages: "",
});

const emptyDraft = (coverIndex: number): Draft => ({
  titleEn: "",
  titleTh: "",
  descriptionEn: "",
  descriptionTh: "",
  category: "CORE",
  competencyId: "",
  hours: "6",
  cover: COVERS[coverIndex % COVERS.length]!,
  chapters: [newChapter()],
});

const fromCourse = (c: AdminCourseRow): Draft => ({
  titleEn: c.titleEn,
  titleTh: c.titleTh ?? "",
  descriptionEn: c.descriptionEn ?? "",
  descriptionTh: c.descriptionTh ?? "",
  category: c.category,
  competencyId: c.competencyId ?? "",
  hours: String(c.hours),
  cover: c.cover ?? COVERS[0]!,
  chapters: c.chapters.map((ch) => ({
    id: ch.id,
    uid: ch.id,
    kind: ch.kind,
    titleEn: ch.titleEn,
    titleTh: ch.titleTh ?? "",
    summaryEn: ch.summaryEn ?? "",
    summaryTh: ch.summaryTh ?? "",
    minutes: String(ch.minutes),
    pages: ch.pages === null ? "" : String(ch.pages),
  })),
});

/**
 * The course library, writing `Course` and `Chapter`.
 *
 * Chapter order is the `sortOrder` column, so the arrows in step 2 are the real
 * syllabus order a learner walks through. A chapter that already exists keeps
 * its id through a save, which is what keeps everybody's completed lessons
 * completed when the syllabus is edited around them.
 */
export function LmsAdminScreen({ data }: { data: LmsAdminData }) {
  const { t, tt, lang } = useT();
  const { courses, competencies, counts } = data;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [editing, setEditing] = useState<AdminCourseRow | null>(null);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(0));
  const [confirm, setConfirm] = useState<AdminCourseRow | null>(null);
  const [busy, startTransition] = useTransition();

  const title = (c: { titleEn: string; titleTh: string | null }) =>
    lang === "th" ? (c.titleTh ?? c.titleEn) : c.titleEn;

  const competencyName = (c: { nameEn: string; nameTh: string | null }) =>
    lang === "th" ? (c.nameTh ?? c.nameEn) : c.nameEn;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses.filter((c) => {
      if (filter !== "all" && c.competencyId !== filter) return false;
      if (!q) return true;
      return `${c.titleEn} ${c.titleTh ?? ""} ${c.slug}`.toLowerCase().includes(q);
    });
  }, [courses, query, filter]);

  const competencyOptions = useMemo(
    () => competencies.filter((c) => c.group === draft.category),
    [competencies, draft.category],
  );

  function run(fn: () => Promise<ActionResult>) {
    startTransition(async () => setResult(await fn()));
  }

  // a form stays open until its save succeeds, so a refusal never costs the
  // administrator what they typed
  const [formError, setFormError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) setFormError(null);
  }, [open]);
  function runForm(fn: () => Promise<ActionResult>) {
    setFormError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setOpen(false);
        setResult(res);
      } else {
        setFormError(tt(res.error.en, res.error.th));
      }
    });
  }

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function setChapter(uid: string, patch: Partial<ChapterDraft>) {
    setDraft((d) => ({
      ...d,
      chapters: d.chapters.map((ch) => (ch.uid === uid ? { ...ch, ...patch } : ch)),
    }));
  }

  function moveChapter(index: number, by: -1 | 1) {
    setDraft((d) => {
      const next = [...d.chapters];
      const to = index + by;
      if (to < 0 || to >= next.length) return d;
      [next[index], next[to]] = [next[to]!, next[index]!];
      return { ...d, chapters: next };
    });
  }

  function openCreate() {
    setDraft(emptyDraft(courses.length));
    setEditing(null);
    setStep(1);
    setOpen(true);
  }

  function openEdit(c: AdminCourseRow) {
    setDraft(fromCourse(c));
    setEditing(c);
    setStep(1);
    setOpen(true);
  }

  function save() {
    const payload = {
      courseId: editing?.id ?? "",
      titleEn: draft.titleEn,
      titleTh: draft.titleTh,
      descriptionEn: draft.descriptionEn,
      descriptionTh: draft.descriptionTh,
      category: draft.category,
      competencyId: draft.competencyId,
      hours: draft.hours,
      cover: draft.cover,
      chapters: draft.chapters
        .filter((ch) => ch.titleEn.trim())
        .map((ch) => ({
          id: ch.id,
          kind: ch.kind,
          titleEn: ch.titleEn,
          titleTh: ch.titleTh,
          summaryEn: ch.summaryEn,
          summaryTh: ch.summaryTh,
          minutes: ch.minutes,
          pages: ch.pages || undefined,
        })),
    };
    runForm(() => saveCourse(payload));
  }

  const statusPill = (status: AdminCourseRow["status"]) =>
    status === "PUBLISHED" ? (
      <Pill tone="success">{t("status.published")}</Pill>
    ) : status === "ARCHIVED" ? (
      <Pill tone="neutral">{tt("Archived", "เก็บเข้าคลัง")}</Pill>
    ) : (
      <Pill tone="warn">{t("status.draft")}</Pill>
    );

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading
        title={tt("Manage courses", "จัดการหลักสูตร")}
        subtitle={tt(
          "The course library employees learn from — courses, chapters and what each one is tagged against.",
          "คลังหลักสูตรที่พนักงานใช้เรียน — หลักสูตร บทเรียน และสมรรถนะที่เชื่อมโยง",
        )}
      />

      <ResultBanner result={result} onDismiss={() => setResult(null)} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <CountTile
          value={counts.total}
          label={tt("Total courses", "หลักสูตรทั้งหมด")}
          icon={<BookOpen size={20} />}
        />
        <CountTile
          value={counts.published}
          label={t("status.published")}
          tone="success"
          icon={<GraduationCap size={20} />}
        />
        <CountTile
          value={counts.chapters}
          label={tt("Chapters", "บทเรียน")}
          tone="ink"
          icon={<Video size={20} />}
        />
        <CountTile
          value={counts.taggedCompetencies}
          label={tt("Skill tags", "แท็กสมรรถนะ")}
          tone="amber"
          icon={<Tags size={20} />}
        />
      </div>

      <Card className="mt-5">
        <div className="flex flex-wrap items-center gap-3 p-5">
          <h3 className="text-lg font-bold text-ink">{tt("Courses", "หลักสูตร")}</h3>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={tt("Search courses...", "ค้นหาหลักสูตร...")}
            className="w-full sm:w-60"
          />
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full sm:w-64"
            aria-label={t("label.competency")}
          >
            <option value="all">{tt("All competencies", "ทุกสมรรถนะ")}</option>
            {competencies.map((c) => (
              <option key={c.id} value={c.id}>
                {competencyName(c)}
              </option>
            ))}
          </Select>
          <Button className="ml-auto" size="sm" onClick={openCreate}>
            <Plus size={15} />
            {tt("New course", "หลักสูตรใหม่")}
          </Button>
        </div>

        <TableWrap>
          <table className="w-full min-w-[960px] xl:min-w-0 border-collapse">
            <thead>
              <tr className="border-y border-line/70 bg-surface/60">
                <Th>{t("label.course")}</Th>
                <Th>{t("label.category")}</Th>
                <Th>{t("label.competency")}</Th>
                <Th>{tt("Chapters", "บทเรียน")}</Th>
                <Th>{tt("Hours", "ชั่วโมง")}</Th>
                <Th>{tt("Enrolled", "ผู้ลงทะเบียน")}</Th>
                <Th>{t("label.status")}</Th>
                <Th className="text-right">{t("label.actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.id} className="border-b border-line/60 last:border-0">
                  <Td>
                    <div className="flex items-center gap-3">
                      <span
                        className="size-9 shrink-0 rounded-lg"
                        style={coverStyle(c.cover ?? "")}
                      />
                      <span className="min-w-0">
                        <span className="block font-bold">{title(c)}</span>
                        {c.pathStepCount ? (
                          <span className="block truncate text-[10px] text-muted">
                            {tt(
                              `In ${c.pathStepCount} learning path(s)`,
                              `อยู่ใน ${c.pathStepCount} เส้นทางการเรียนรู้`,
                            )}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </Td>
                  <Td className="text-muted">{t(CATEGORY_LABEL[c.category].key)}</Td>
                  <Td className="text-muted">{(lang === "th" ? (c.competencyNameTh ?? c.competencyName) : c.competencyName) ?? "—"}</Td>
                  <Td className="text-muted">{c.chapters.length}</Td>
                  <Td className="text-muted">
                    {tt(`${c.hours} hours`, `${c.hours} ชม.`)}
                  </Td>
                  <Td className="text-muted">
                    {c.enrolledCount}
                    {c.completedCount ? (
                      <span className="ml-1 text-[10px] text-success">
                        {tt(`(${c.completedCount} done)`, `(จบแล้ว ${c.completedCount})`)}
                      </span>
                    ) : null}
                  </Td>
                  <Td>{statusPill(c.status)}</Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      <IconAction
                        disabled={busy}
                        aria-label={
                          c.status === "PUBLISHED"
                            ? tt("Unpublish", "ยกเลิกการเผยแพร่")
                            : tt("Publish", "เผยแพร่")
                        }
                        onClick={() =>
                          run(() =>
                            setCourseStatus({
                              courseId: c.id,
                              status: c.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
                            }),
                          )
                        }
                      >
                        {c.status === "PUBLISHED" ? (
                          <EyeOff size={14} />
                        ) : (
                          <Eye size={14} />
                        )}
                      </IconAction>
                      <IconAction
                        disabled={busy || c.status === "ARCHIVED"}
                        aria-label={tt(`Archive ${c.titleEn}`, `เก็บ ${c.titleEn} เข้าคลัง`)}
                        onClick={() =>
                          run(() =>
                            setCourseStatus({ courseId: c.id, status: "ARCHIVED" }),
                          )
                        }
                      >
                        <Archive size={14} />
                      </IconAction>
                      <IconAction
                        tone="brand"
                        aria-label={`${t("action.edit")} ${c.titleEn}`}
                        onClick={() => openEdit(c)}
                      >
                        <Pencil size={14} />
                      </IconAction>
                      <IconAction
                        tone="danger"
                        aria-label={`${t("action.delete")} ${c.titleEn}`}
                        onClick={() => setConfirm(c)}
                      >
                        <Trash2 size={14} />
                      </IconAction>
                    </div>
                  </Td>
                </tr>
              ))}
              {visible.length === 0 ? (
                <tr>
                  <Td colSpan={8} className="py-10 text-center text-muted">
                    {t("admin.noMatch")}
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      {/* ---------------------------------------------- create / edit ---- */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          editing ? tt("Edit course", "แก้ไขหลักสูตร") : tt("Create course", "สร้างหลักสูตร")
        }
        subtitle={
          step === 1
            ? tt("Step 1 of 2 · Course details", "ขั้นที่ 1 จาก 2 · รายละเอียดหลักสูตร")
            : tt("Step 2 of 2 · Chapters", "ขั้นที่ 2 จาก 2 · บทเรียน")
        }
        width="max-w-3xl"
        footer={
          step === 1 ? (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t("action.cancel")}
              </Button>
              <Button onClick={() => setStep(2)}>
                {tt("Next: chapters", "ถัดไป: บทเรียน")}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                {t("action.back")}
              </Button>
              <Button onClick={save} disabled={busy}>
                {editing ? t("action.saveChanges") : t("action.save")}
              </Button>
            </>
          )
        }
      >
        {formError ? (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-ink"
          >
            {formError}
          </p>
        ) : null}
        {step === 1 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`${tt("Course name (English)", "ชื่อหลักสูตร (อังกฤษ)")} *`}>
              <Input
                value={draft.titleEn}
                placeholder={tt("Course name", "ชื่อหลักสูตร")}
                onChange={(e) => set("titleEn", e.target.value)}
              />
            </Field>
            <Field label={tt("Course name (Thai)", "ชื่อหลักสูตร (ไทย)")}>
              <Input
                value={draft.titleTh}
                placeholder={tt("Optional", "ไม่บังคับ")}
                onChange={(e) => set("titleTh", e.target.value)}
              />
            </Field>
            <Field label={t("label.category")}>
              <Select
                value={draft.category}
                onChange={(e) => {
                  const category = e.target.value as CompetencyGroupValue;
                  const first = competencies.find((c) => c.group === category);
                  setDraft((d) => ({
                    ...d,
                    category,
                    competencyId: first?.id ?? "",
                  }));
                }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(CATEGORY_LABEL[c].key)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={tt("Linked competency", "สมรรถนะที่เชื่อมโยง")}
              hint={tt("This is how the course is suggested for a development gap.",
                "ใช้แนะนำหลักสูตรนี้ให้กับผู้ที่มีส่วนต่างในสมรรถนะนี้",
              )}
            >
              <Select
                value={draft.competencyId}
                onChange={(e) => set("competencyId", e.target.value)}
              >
                <option value="">{tt("Not linked", "ไม่เชื่อมโยง")}</option>
                {competencyOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {competencyName(c)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={tt("Description (English)", "รายละเอียด (อังกฤษ)")}
              className="sm:col-span-2"
            >
              <Textarea
                value={draft.descriptionEn}
                placeholder={tt("What the course is about", "หลักสูตรนี้เกี่ยวกับอะไร")}
                onChange={(e) => set("descriptionEn", e.target.value)}
              />
            </Field>
            <Field
              label={tt("Description (Thai)", "รายละเอียด (ไทย)")}
              className="sm:col-span-2"
            >
              <Textarea
                value={draft.descriptionTh}
                placeholder={tt("Optional", "ไม่บังคับ")}
                onChange={(e) => set("descriptionTh", e.target.value)}
              />
            </Field>
            <Field label={tt("Hours", "ชั่วโมง")}>
              <Input
                type="number"
                min={0}
                value={draft.hours}
                onChange={(e) => set("hours", e.target.value)}
              />
            </Field>
            <Field label={tt("Cover", "ภาพหน้าปก")}>
              <Select value={draft.cover} onChange={(e) => set("cover", e.target.value)}>
                {COVERS.map((c, i) => (
                  <option key={c} value={c}>
                    {tt(`Gradient ${i + 1}`, `ไล่สีแบบที่ ${i + 1}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : (
          <div className="space-y-4">
            {draft.chapters.map((ch, i) => {
              const Icon = KIND_ICON[ch.kind];
              return (
                <div key={ch.uid} className="rounded-xl border border-line/70 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm font-bold text-ink">
                      <Icon size={15} className="text-brand" />
                      {tt(`Chapter ${i + 1}`, `บทที่ ${i + 1}`)}
                      {ch.id ? null : (
                        <Pill tone="brand">{tt("New", "ใหม่")}</Pill>
                      )}
                    </p>
                    <div className="flex gap-2">
                      <IconAction
                        disabled={i === 0}
                        aria-label={tt(`Move chapter ${i + 1} up`, `เลื่อนบทที่ ${i + 1} ขึ้น`)}
                        onClick={() => moveChapter(i, -1)}
                      >
                        <ArrowUp size={14} />
                      </IconAction>
                      <IconAction
                        disabled={i === draft.chapters.length - 1}
                        aria-label={tt(`Move chapter ${i + 1} down`, `เลื่อนบทที่ ${i + 1} ลง`)}
                        onClick={() => moveChapter(i, 1)}
                      >
                        <ArrowDown size={14} />
                      </IconAction>
                      <IconAction
                        tone="danger"
                        aria-label={tt(`Remove chapter ${i + 1}`, `ลบบทที่ ${i + 1}`)}
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            chapters: d.chapters.filter((c) => c.uid !== ch.uid),
                          }))
                        }
                      >
                        <Trash2 size={14} />
                      </IconAction>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label={`${tt("Chapter title (English)", "ชื่อบทเรียน (อังกฤษ)")} *`}>
                      <Input
                        value={ch.titleEn}
                        placeholder={tt("Chapter name", "ชื่อบทเรียน")}
                        onChange={(e) => setChapter(ch.uid, { titleEn: e.target.value })}
                      />
                    </Field>
                    <Field label={tt("Chapter title (Thai)", "ชื่อบทเรียน (ไทย)")}>
                      <Input
                        value={ch.titleTh}
                        placeholder={tt("Optional", "ไม่บังคับ")}
                        onChange={(e) => setChapter(ch.uid, { titleTh: e.target.value })}
                      />
                    </Field>
                    <Field label={tt("Content type", "ประเภทเนื้อหา")}>
                      <Select
                        value={ch.kind}
                        onChange={(e) =>
                          setChapter(ch.uid, {
                            kind: e.target.value as ChapterKindValue,
                          })
                        }
                      >
                        <option value="VIDEO">{tt("Video", "วิดีโอ")}</option>
                        <option value="PDF">{tt("PDF", "เอกสาร PDF")}</option>
                        <option value="ARTICLE">{tt("Article", "บทความ")}</option>
                      </Select>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label={tt("Minutes", "นาที")}>
                        <Input
                          type="number"
                          min={0}
                          value={ch.minutes}
                          onChange={(e) =>
                            setChapter(ch.uid, { minutes: e.target.value })
                          }
                        />
                      </Field>
                      <Field label={tt("Pages", "จำนวนหน้า")}>
                        <Input
                          type="number"
                          min={0}
                          value={ch.pages}
                          disabled={ch.kind !== "PDF"}
                          onChange={(e) => setChapter(ch.uid, { pages: e.target.value })}
                        />
                      </Field>
                    </div>
                    <Field label={tt("Summary (English)", "สรุปเนื้อหา (อังกฤษ)")}>
                      <Textarea
                        value={ch.summaryEn}
                        placeholder={tt(
                          "What this chapter covers",
                          "บทนี้ครอบคลุมเรื่องอะไร",
                        )}
                        onChange={(e) =>
                          setChapter(ch.uid, { summaryEn: e.target.value })
                        }
                      />
                    </Field>
                    <Field label={tt("Summary (Thai)", "สรุปเนื้อหา (ไทย)")}>
                      <Textarea
                        value={ch.summaryTh}
                        placeholder={tt("Optional", "ไม่บังคับ")}
                        onChange={(e) =>
                          setChapter(ch.uid, { summaryTh: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                </div>
              );
            })}
            <Button
              variant="secondary"
              onClick={() =>
                setDraft((d) => ({ ...d, chapters: [...d.chapters, newChapter()] }))
              }
            >
              <Plus size={15} />
              {tt("Add chapter", "เพิ่มบทเรียน")}
            </Button>
            <p className="text-xs leading-relaxed text-muted">
              {draft.chapters.length === 0
                ? tt(
                    "No chapters yet — a course with no syllabus cannot be published.",
                    "ยังไม่มีบทเรียน — หลักสูตรที่ไม่มีเนื้อหาจะเผยแพร่ไม่ได้",
                  )
                : tt("Saving keeps each chapter's progress, so re-ordering never resets anyone's completed lessons. Removing a chapter deletes the progress recorded for it.",
                    "การบันทึกจะคงความคืบหน้าของแต่ละบทไว้ การสลับลำดับจึงไม่ล้างบทที่ผู้เรียนเรียนจบแล้ว แต่การลบบทเรียนจะลบความคืบหน้าของบทนั้นไปด้วย",
                  )}
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={tt("Delete course", "ลบหลักสูตร")}
        width="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              {t("action.cancel")}
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                const target = confirm;
                setConfirm(null);
                if (target) run(() => deleteCourse({ courseId: target.id }));
              }}
            >
              {t("action.delete")}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          {tt("Delete", "ลบ")}{" "}
          <span className="font-medium text-ink">
            {confirm ? title(confirm) : ""}
          </span>{" "}
          {tt(
            `and its ${confirm?.chapters.length ?? 0} chapters?`,
            `พร้อมบทเรียน ${confirm?.chapters.length ?? 0} บทหรือไม่?`,
          )}{" "}
          {confirm &&
          (confirm.enrolledCount || confirm.certificateCount || confirm.pathStepCount)
            ? tt("People are enrolled on it, so it can't be deleted — archive it instead.",
                "มีผู้ลงทะเบียนเรียนอยู่ จึงลบไม่ได้ กรุณาเก็บเข้าคลังแทน",
              )
            : tt(
                "Nothing is attached to it, so this is safe.",
                "ยังไม่มีข้อมูลใดผูกกับหลักสูตรนี้ จึงลบได้อย่างปลอดภัย",
              )}
        </p>
      </Modal>
    </div>
  );
}
