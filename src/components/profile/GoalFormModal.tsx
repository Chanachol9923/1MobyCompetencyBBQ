"use client";

import { useMemo, useState } from "react";
import { Button, Field, Input, Modal, Select } from "@/components/ui";
import { VerdictPill } from "./VerdictPill";
import { formatGap, nameOf, pick, type GapRow } from "./gap";
import { useT } from "@/lib/i18n";

/** The three development activities named in the requirement pack. */
export type ActivityKey = "ONLINE_COURSE" | "COACHING" | "ON_THE_JOB";

export const ACTIVITIES: ActivityKey[] = [
  "ONLINE_COURSE",
  "COACHING",
  "ON_THE_JOB",
];

export const ACTIVITY_LABEL: Record<ActivityKey, { en: string; th: string }> = {
  ONLINE_COURSE: { en: "Online Course", th: "เรียนออนไลน์" },
  COACHING: { en: "Coaching", th: "โค้ชชิ่ง" },
  ON_THE_JOB: { en: "On-the-job Training", th: "ฝึกจากงานจริง" },
};

export const isoIn = (days: number) =>
  new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);

/** Separator between the "assigned by …" stamp and the manager's own words. */
export const NOTE_SEP = " — ";

/** Pulls the manager's note back out of a stored remark so an edit prefills. */
export function noteOf(remark?: string | null) {
  if (!remark) return "";
  const i = remark.indexOf(NOTE_SEP);
  return i < 0 ? "" : remark.slice(i + NOTE_SEP.length);
}

export type CourseChoice = {
  id: string;
  titleEn: string;
  titleTh: string | null;
  competencyId: string | null;
};

/** What the form hands back — the server action owns ids and the remark stamp. */
export type GoalDraft = {
  competencyId: string;
  courseId: string | null;
  fromLevel: number;
  toLevel: number;
  activity: ActivityKey;
  startDate: string;
  dueDate: string;
  /** the manager's own words, without the "assigned by" stamp */
  note: string;
};

/** The subset of a stored goal the form needs to pre-fill an edit. */
export type GoalSeed = {
  competencyId: string;
  courseId: string | null;
  fromLevel: number;
  toLevel: number;
  activity: ActivityKey;
  startDate: string;
  dueDate: string;
  remark: string | null;
};

const NO_COURSE = "__none__";

/**
 * One form for both halves of the requirement — "เพิ่ม/แก้ไข" a development
 * activity. `goal` null means create; passing a goal pre-fills every field and
 * the caller saves it in place. Mount it with a `key` so switching between
 * rows re-seeds the fields.
 *
 * The competency list is the member's own gap rows, so a competency their
 * career role is not assessed on can never be picked.
 */
export function GoalFormModal({
  memberName,
  rows,
  courses,
  goal,
  pending = false,
  error,
  onClose,
  onSubmit,
}: {
  memberName: string;
  rows: GapRow[];
  courses: CourseChoice[];
  goal: GoalSeed | null;
  pending?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (draft: GoalDraft) => void;
}) {
  const { t, tt, lang } = useT();
  const editing = goal != null;

  /** Every assessed competency for this person, largest shortfall first. */
  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.gap - b.gap),
    [rows],
  );

  const [competencyId, setCompetencyId] = useState(
    goal?.competencyId ?? sorted[0]?.competencyId ?? "",
  );
  const [courseId, setCourseId] = useState<string>(
    goal?.courseId ?? NO_COURSE,
  );
  const [activity, setActivity] = useState<ActivityKey>(
    goal?.activity ?? "ONLINE_COURSE",
  );
  const [startDate, setStartDate] = useState(goal?.startDate ?? isoIn(0));
  const [dueDate, setDueDate] = useState(goal?.dueDate ?? isoIn(90));
  const [toLevel, setToLevel] = useState<number | null>(goal?.toLevel ?? null);
  const [note, setNote] = useState(noteOf(goal?.remark));
  const [localError, setLocalError] = useState<string | null>(null);

  const row = sorted.find((r) => r.competencyId === competencyId);

  /** The course written for this competency first, then everything else. */
  const courseChoices = useMemo(
    () => [
      ...courses.filter((c) => c.competencyId === competencyId),
      ...courses.filter((c) => c.competencyId !== competencyId),
    ],
    [courses, competencyId],
  );

  const currentLevel = goal?.fromLevel ?? row?.score ?? 0;
  const targetLevel =
    toLevel ??
    Math.min(4, Math.max(currentLevel + 1, row?.expected ?? currentLevel + 1));

  const levelChoices = [1, 2, 3, 4].filter(
    (n) => n >= Math.max(1, currentLevel) || n === targetLevel,
  );

  const submit = () => {
    if (!competencyId) {
      setLocalError(tt("Pick a competency first", "เลือกสมรรถนะก่อน"));
      return;
    }
    if (Date.parse(dueDate) <= Date.parse(startDate)) {
      setLocalError(
        tt(
          "Due date must be after the start date",
          "วันสิ้นสุดต้องอยู่หลังวันเริ่มต้น",
        ),
      );
      return;
    }
    setLocalError(null);
    onSubmit({
      competencyId,
      courseId: courseId === NO_COURSE ? null : courseId,
      fromLevel: currentLevel,
      toLevel: Math.max(targetLevel, currentLevel),
      activity,
      startDate,
      dueDate,
      note: note.trim(),
    });
  };

  const shown = localError ?? error ?? null;

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-2xl"
      title={
        editing
          ? tt(`Edit goal for ${memberName}`, `แก้ไขเป้าหมายของ ${memberName}`)
          : tt(`Add a goal for ${memberName}`, `เพิ่มเป้าหมายให้ ${memberName}`)
      }
      subtitle={tt(
        "Online Course, Coaching or On-the-job Training, with a level move and a timeline.",
        "เลือกวิธีพัฒนา เรียนออนไลน์ โค้ชชิ่ง หรือฝึกจากงานจริง พร้อมระดับเป้าหมายและกรอบเวลา",
      )}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {t("action.cancel")}
          </Button>
          <Button onClick={submit} disabled={pending}>
            {editing ? t("action.saveChanges") : t("action.add")}
          </Button>
        </>
      }
    >
      {row ? (
        <p className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-brand-tint px-3 py-2 text-xs text-muted">
          {tt("Current", "ปัจจุบัน")}{" "}
          <b className="text-ink">{row.score ?? tt("not scored", "ยังไม่มีคะแนน")}</b>{" "}
          · {t("label.expected")} <b className="text-ink">{row.expected}</b> ·{" "}
          {t("label.gap")}{" "}
          <b className={row.gap < 0 ? "text-accent" : "text-success"}>
            {formatGap(row.gap)}
          </b>
          <VerdictPill verdict={row.verdict} compact />
        </p>
      ) : null}

      {shown ? (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-accent/10 px-3 py-2 text-xs font-medium text-accent"
        >
          {shown}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          className="sm:col-span-2"
          label={tt(
            "Competency (largest gap first)",
            "สมรรถนะ (ช่องว่างมากสุดก่อน)",
          )}
        >
          <Select
            value={competencyId}
            onChange={(e) => {
              setCompetencyId(e.target.value);
              setCourseId(NO_COURSE);
              setToLevel(null);
            }}
          >
            {sorted.map((r) => (
              <option key={r.competencyId} value={r.competencyId}>
                {nameOf(r, lang)} — {t("label.gap")} {formatGap(r.gap)}
              </option>
            ))}
          </Select>
        </Field>

        <Field className="sm:col-span-2" label={t("label.course")}>
          <Select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            <option value={NO_COURSE}>
              {tt("No course — coaching or on the job", "ไม่มีหลักสูตร — โค้ชชิ่งหรือฝึกจากงานจริง")}
            </option>
            {courseChoices.map((c) => (
              <option key={c.id} value={c.id}>
                {pick(lang, c.titleEn, c.titleTh)}
                {c.competencyId === competencyId
                  ? tt(" (recommended)", " (แนะนำ)")
                  : ""}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={tt("Target level", "ระดับเป้าหมาย")}>
          <Select
            value={String(targetLevel)}
            onChange={(e) => setToLevel(Number(e.target.value))}
          >
            {levelChoices.map((n) => (
              <option key={n} value={n}>
                {tt(`Level ${currentLevel} → ${n}`, `ระดับ ${currentLevel} → ${n}`)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={tt("Development activity", "วิธีการพัฒนา")}>
          <Select
            value={activity}
            onChange={(e) => setActivity(e.target.value as ActivityKey)}
          >
            {ACTIVITIES.map((a) => (
              <option key={a} value={a}>
                {ACTIVITY_LABEL[a][lang]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t("label.startDate")}>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>

        <Field label={t("label.dueDate")}>
          <Input
            type="date"
            value={dueDate}
            min={startDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </Field>

        <Field
          className="sm:col-span-2"
          label={t("label.remark")}
          hint={tt(
            "Shown on the employee's plan as the reason you assigned it.",
            "จะแสดงในแผนของพนักงานเพื่อบอกเหตุผลที่คุณมอบหมาย",
          )}
        >
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={tt("Why this goal?", "ทำไมต้องพัฒนาเรื่องนี้?")}
          />
        </Field>
      </div>
    </Modal>
  );
}
