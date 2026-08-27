"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  Eye,
  EyeOff,
  GraduationCap,
  Pencil,
  Plus,
  Tags,
  Trash2,
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
  AdminOnly,
  CountTile,
  IconAction,
  SearchInput,
  TableWrap,
  Td,
  Th,
  coverStyle,
} from "@/components/admin/shared";
import {
  COMPETENCIES,
  GROUP_LABEL,
  GROUP_LABEL_TH,
  type Group,
} from "@/data/competencies";
import type { Chapter, Course } from "@/data/learning";
import { useDemo } from "@/lib/store";
import { useT } from "@/lib/i18n";

export default function ManageLmsPage() {
  return (
    <AdminOnly>
      <ManageLms />
    </AdminOnly>
  );
}

const CATEGORIES: Course["category"][] = ["Core", "Functional", "Managerial"];
const COVERS = [
  "from-[#006bff] to-[#0b1b3f]",
  "from-[#f05123] to-[#faa21b]",
  "from-[#00b916] to-[#0b1b3f]",
  "from-[#006bff] to-[#00b916]",
  "from-[#1c1e29] to-[#006bff]",
];

const groupOf = (category: Course["category"]): Group =>
  category.toLowerCase() as Group;

type ChapterDraft = { id: string; title: string; minutes: string; summary: string };

type Draft = {
  title: string;
  category: Course["category"];
  competencyId: string;
  description: string;
  hours: string;
  lessons: string;
  chapters: ChapterDraft[];
};

const newChapter = (): ChapterDraft => ({
  id: `ch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  title: "",
  minutes: "10",
  summary: "",
});

const emptyDraft = (): Draft => ({
  title: "",
  category: "Core",
  competencyId: COMPETENCIES.find((c) => c.group === "core")!.id,
  description: "",
  hours: "6",
  lessons: "4",
  chapters: [newChapter()],
});

const fromCourse = (c: Course): Draft => ({
  title: c.title,
  category: c.category,
  competencyId: c.competencyId,
  description: c.description,
  hours: String(c.hours),
  lessons: String(c.lessons),
  chapters: c.chapters.map((ch) => ({
    id: ch.id,
    title: ch.title,
    minutes: String(ch.minutes),
    summary: ch.summary,
  })),
});

function ManageLms() {
  const { state, update, notify, logActivity } = useDemo();
  const { t, tt, lang } = useT();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [confirm, setConfirm] = useState<Course | null>(null);

  const courses = state.courses;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses.filter((c) => {
      const matchQ = !q || c.title.toLowerCase().includes(q);
      const matchF = filter === "all" || c.competencyId === filter;
      return matchQ && matchF;
    });
  }, [courses, query, filter]);

  const published = courses.filter((c) => c.status === "Published").length;
  const tags = new Set(courses.map((c) => c.competencyId)).size;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function openCreate() {
    setDraft(emptyDraft());
    setEditingId(null);
    setStep(1);
    setOpen(true);
  }

  function openEdit(c: Course) {
    setDraft(fromCourse(c));
    setEditingId(c.id);
    setStep(1);
    setOpen(true);
  }

  function setChapter(id: string, patch: Partial<ChapterDraft>) {
    setDraft((d) => ({
      ...d,
      chapters: d.chapters.map((ch) => (ch.id === id ? { ...ch, ...patch } : ch)),
    }));
  }

  function save() {
    if (!draft.title.trim()) {
      notify(tt("Course title is required", "กรุณากรอกชื่อหลักสูตร"));
      setStep(1);
      return;
    }
    const chapters: Chapter[] = draft.chapters
      .filter((ch) => ch.title.trim())
      .map((ch) => ({
        id: ch.id,
        title: ch.title.trim(),
        minutes: Number(ch.minutes) || 0,
        summary: ch.summary.trim(),
        bullets: [],
      }));

    if (editingId) {
      update((s) => ({
        ...s,
        courses: s.courses.map((c) =>
          c.id === editingId
            ? {
                ...c,
                title: draft.title.trim(),
                category: draft.category,
                competencyId: draft.competencyId,
                description: draft.description.trim(),
                hours: Number(draft.hours) || 0,
                lessons: Number(draft.lessons) || chapters.length,
                chapters,
              }
            : c,
        ),
      }));
      logActivity("Updated course", draft.title.trim());
      notify(
        tt(
          `“${draft.title.trim()}” updated`,
          `อัปเดต “${draft.title.trim()}” แล้ว`,
        ),
      );
    } else {
      const id = `${draft.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()
        .toString()
        .slice(-4)}`;
      const course: Course = {
        id,
        title: draft.title.trim(),
        category: draft.category,
        competencyId: draft.competencyId,
        hours: Number(draft.hours) || 0,
        lessons: Number(draft.lessons) || chapters.length,
        enrolled: 0,
        status: "Draft",
        cover: COVERS[courses.length % COVERS.length]!,
        description: draft.description.trim(),
        chapters,
      };
      update((s) => ({ ...s, courses: [...s.courses, course] }));
      logActivity("Created course", course.title);
      notify(
        tt(
          `Course “${course.title}” created as draft`,
          `สร้างหลักสูตร “${course.title}” เป็นฉบับร่างแล้ว`,
        ),
      );
    }
    setOpen(false);
  }

  function togglePublish(c: Course) {
    const next = c.status === "Published" ? "Draft" : "Published";
    update((s) => ({
      ...s,
      courses: s.courses.map((x) => (x.id === c.id ? { ...x, status: next } : x)),
    }));
    logActivity(
      next === "Published" ? "Published course" : "Unpublished course",
      c.title,
    );
    notify(
      tt(
        `“${c.title}” is now ${next === "Published" ? "published" : "a draft"}`,
        `“${c.title}” เปลี่ยนเป็น${next === "Published" ? "เผยแพร่แล้ว" : "ฉบับร่าง"}`,
      ),
    );
  }

  function remove(c: Course) {
    update((s) => ({ ...s, courses: s.courses.filter((x) => x.id !== c.id) }));
    logActivity("Deleted course", c.title);
    notify(tt(`“${c.title}” deleted`, `ลบ “${c.title}” แล้ว`));
    setConfirm(null);
  }

  const competencyName = (id: string) =>
    COMPETENCIES.find((c) => c.id === id)?.name ?? id;

  const competencyOptions = COMPETENCIES.filter(
    (c) => c.group === groupOf(draft.category),
  );

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading title={tt("Manage LMS", "จัดการระบบการเรียนรู้")} />

      <div className="grid gap-4 sm:grid-cols-3">
        <CountTile
          value={courses.length}
          label={tt("Total Courses", "หลักสูตรทั้งหมด")}
          icon={<BookOpen size={20} />}
        />
        <CountTile
          value={published}
          label={t("status.published")}
          tone="success"
          icon={<GraduationCap size={20} />}
        />
        <CountTile
          value={tags}
          label={tt("Skills Tags", "แท็กสมรรถนะ")}
          tone="amber"
          icon={<Tags size={20} />}
        />
      </div>

      <Card className="mt-5">
        <div className="flex flex-wrap items-center gap-3 p-5">
          <h3 className="text-lg font-bold text-ink">
            {tt("Courses", "หลักสูตร")}
          </h3>
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
            <option value="all">{tt("All Competency", "ทุกสมรรถนะ")}</option>
            {COMPETENCIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Button className="ml-auto" size="sm" onClick={openCreate}>
            <Plus size={15} />
            {tt("Create New Course", "สร้างหลักสูตรใหม่")}
          </Button>
        </div>

        <TableWrap>
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="border-y border-line/70 bg-surface/60">
                <Th>{t("label.course")}</Th>
                <Th>{t("label.category")}</Th>
                <Th>{t("label.competency")}</Th>
                <Th>{tt("Lessons", "บทเรียน")}</Th>
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
                        style={coverStyle(c.cover)}
                      />
                      <span className="min-w-0">
                        <span className="block font-bold">{c.title}</span>
                        <span className="block truncate text-[10px] text-muted">
                          {tt(
                            `${c.chapters.length} chapters`,
                            `${c.chapters.length} บท`,
                          )}
                        </span>
                      </span>
                    </div>
                  </Td>
                  <Td className="text-muted">
                    {lang === "th"
                      ? GROUP_LABEL_TH[groupOf(c.category)]
                      : c.category}
                  </Td>
                  <Td className="text-muted">{competencyName(c.competencyId)}</Td>
                  <Td className="text-muted">{c.lessons}</Td>
                  <Td className="text-muted">
                    {tt(`${c.hours} hours`, `${c.hours} ชม.`)}
                  </Td>
                  <Td className="text-muted">{c.enrolled}</Td>
                  <Td>
                    <Pill tone={c.status === "Published" ? "success" : "neutral"}>
                      {c.status === "Published"
                        ? t("status.published")
                        : t("status.draft")}
                    </Pill>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      <IconAction
                        aria-label={
                          c.status === "Published"
                            ? tt("Unpublish", "ยกเลิกการเผยแพร่")
                            : tt("Publish", "เผยแพร่")
                        }
                        onClick={() => togglePublish(c)}
                      >
                        {c.status === "Published" ? (
                          <EyeOff size={14} />
                        ) : (
                          <Eye size={14} />
                        )}
                      </IconAction>
                      <IconAction
                        tone="brand"
                        aria-label={`${t("action.edit")} ${c.title}`}
                        onClick={() => openEdit(c)}
                      >
                        <Pencil size={14} />
                      </IconAction>
                      <IconAction
                        tone="danger"
                        aria-label={`${t("action.delete")} ${c.title}`}
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
          editingId
            ? tt("Edit Course", "แก้ไขหลักสูตร")
            : tt("Create Course", "สร้างหลักสูตร")
        }
        subtitle={
          step === 1
            ? tt(
                "Step 1 of 2 · Course details",
                "ขั้นที่ 1 จาก 2 · รายละเอียดหลักสูตร",
              )
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
              <Button onClick={save}>
                {editingId ? t("action.saveChanges") : t("action.save")}
              </Button>
            </>
          )
        }
      >
        {step === 1 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={`${tt("Course name", "ชื่อหลักสูตร")} *`}
              className="sm:col-span-2"
            >
              <Input
                value={draft.title}
                placeholder={tt("Enter Course Name...", "กรอกชื่อหลักสูตร...")}
                onChange={(e) => set("title", e.target.value)}
              />
            </Field>
            <Field label={t("label.category")}>
              <Select
                value={draft.category}
                onChange={(e) => {
                  const category = e.target.value as Course["category"];
                  const first = COMPETENCIES.find(
                    (c) => c.group === groupOf(category),
                  );
                  setDraft((d) => ({
                    ...d,
                    category,
                    competencyId: first ? first.id : d.competencyId,
                  }));
                }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {lang === "th"
                      ? GROUP_LABEL_TH[groupOf(c)]
                      : GROUP_LABEL[groupOf(c)]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tt("Linked competency", "สมรรถนะที่เชื่อมโยง")}>
              <Select
                value={draft.competencyId}
                onChange={(e) => set("competencyId", e.target.value)}
              >
                {competencyOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("label.description")} className="sm:col-span-2">
              <Textarea
                value={draft.description}
                placeholder={tt("Enter Description Detail", "กรอกรายละเอียด")}
                onChange={(e) => set("description", e.target.value)}
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
            <Field label={tt("Lessons", "บทเรียน")}>
              <Input
                type="number"
                min={0}
                value={draft.lessons}
                onChange={(e) => set("lessons", e.target.value)}
              />
            </Field>
          </div>
        ) : (
          <div className="space-y-4">
            {draft.chapters.map((ch, i) => (
              <div key={ch.id} className="rounded-xl border border-line/70 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-ink">
                    {tt(`Chapter ${i + 1}`, `บทที่ ${i + 1}`)}
                  </p>
                  <IconAction
                    tone="danger"
                    aria-label={tt(`Remove chapter ${i + 1}`, `ลบบทที่ ${i + 1}`)}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        chapters: d.chapters.filter((c) => c.id !== ch.id),
                      }))
                    }
                  >
                    <Trash2 size={14} />
                  </IconAction>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                  <Field label={tt("Chapter title", "ชื่อบทเรียน")}>
                    <Input
                      value={ch.title}
                      placeholder={tt("Enter Chapter Name...", "กรอกชื่อบทเรียน...")}
                      onChange={(e) => setChapter(ch.id, { title: e.target.value })}
                    />
                  </Field>
                  <Field label={tt("Minutes", "นาที")}>
                    <Input
                      type="number"
                      min={0}
                      value={ch.minutes}
                      onChange={(e) => setChapter(ch.id, { minutes: e.target.value })}
                    />
                  </Field>
                  <Field label={tt("Summary", "สรุปเนื้อหา")} className="sm:col-span-2">
                    <Textarea
                      value={ch.summary}
                      placeholder={tt("What this chapter covers", "บทนี้ครอบคลุมเรื่องอะไร")}
                      onChange={(e) => setChapter(ch.id, { summary: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            ))}
            <Button
              variant="secondary"
              onClick={() =>
                setDraft((d) => ({ ...d, chapters: [...d.chapters, newChapter()] }))
              }
            >
              <Plus size={15} />
              {tt("Add chapter", "เพิ่มบทเรียน")}
            </Button>
            {draft.chapters.length === 0 ? (
              <p className="text-xs text-muted">
                {tt(
                  "No chapters yet — the course will be saved without a syllabus.",
                  "ยังไม่มีบทเรียน — หลักสูตรจะถูกบันทึกโดยไม่มีเนื้อหา",
                )}
              </p>
            ) : null}
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
            <Button variant="danger" onClick={() => confirm && remove(confirm)}>
              {t("action.delete")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {tt("Delete", "ลบ")}{" "}
          <span className="font-medium text-ink">{confirm?.title}</span>{" "}
          {tt(
            `and its ${confirm?.chapters.length ?? 0} chapters?`,
            `พร้อมบทเรียน ${confirm?.chapters.length ?? 0} บทหรือไม่?`,
          )}
        </p>
      </Modal>
    </div>
  );
}
