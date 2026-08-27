"use client";

import { useMemo, useState } from "react";
import { Button, Field, Input, Modal, Select } from "@/components/ui";
import { VerdictPill } from "./VerdictPill";
import { formatGap, gapRows, managerScoreFor } from "./gap";
import { COMPETENCIES } from "@/data/competencies";
import { COURSES, findCourse } from "@/data/learning";
import type { Person } from "@/data/people";
import { useT } from "@/lib/i18n";
import { useDemo, type IdpGoal } from "@/lib/store";

/** The three development activities named in the requirement pack. */
export const ACTIVITIES: IdpGoal["activity"][] = [
  "Online Course",
  "Coaching",
  "On-the-job Training",
];

export const ACTIVITY_TH: Record<IdpGoal["activity"], string> = {
  "Online Course": "เรียนออนไลน์",
  Coaching: "โค้ชชิ่ง",
  "On-the-job Training": "ฝึกจากงานจริง",
};

export const isoIn = (days: number) =>
  new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);

/** Separator between the "assigned by …" stamp and the manager's own words. */
const NOTE_SEP = " — ";

/** Pulls the manager's note back out of a stored remark so an edit prefills. */
export function noteOf(remark?: string) {
  if (!remark) return "";
  const i = remark.indexOf(NOTE_SEP);
  return i < 0 ? "" : remark.slice(i + NOTE_SEP.length);
}

/** What the form hands back — the caller owns ids, progress and the remark. */
export type GoalDraft = {
  competencyId: string;
  competencyName: string;
  courseId: string;
  courseTitle: string;
  fromLevel: number;
  toLevel: number;
  activity: IdpGoal["activity"];
  startDate: string;
  dueDate: string;
  /** the manager's own words, without the "assigned by" stamp */
  note: string;
};

/**
 * One form for both halves of the requirement — "เพิ่ม/แก้ไข" a development
 * activity. `goal` null means create; passing a goal pre-fills every field and
 * the caller saves it in place. Mount it with a `key` so switching between
 * rows re-seeds the fields.
 */
export function GoalFormModal({
  member,
  goal,
  onClose,
  onSubmit,
}: {
  member: Person;
  goal: IdpGoal | null;
  onClose: () => void;
  onSubmit: (draft: GoalDraft) => void;
}) {
  const { state, notify } = useDemo();
  const { t, tt, lang } = useT();
  const editing = goal != null;

  /** Every assessed competency for this person, largest shortfall first. */
  const rows = useMemo(
    () => [...gapRows(state, member)].sort((a, b) => a.gap - b.gap),
    [state, member],
  );

  const [competencyId, setCompetencyId] = useState(
    goal?.competencyId ?? rows[0]?.competency.id ?? "",
  );
  const [courseId, setCourseId] = useState(goal?.courseId ?? "");
  const [activity, setActivity] = useState<IdpGoal["activity"]>(
    goal?.activity ?? "Online Course",
  );
  const [startDate, setStartDate] = useState(goal?.startDate ?? isoIn(0));
  const [dueDate, setDueDate] = useState(goal?.dueDate ?? isoIn(90));
  const [toLevel, setToLevel] = useState<number | null>(goal?.toLevel ?? null);
  const [note, setNote] = useState(noteOf(goal?.remark));

  const row = rows.find((r) => r.competency.id === competencyId);

  /** The course written for this competency first, then everything else. */
  const courseChoices = useMemo(
    () => [
      ...COURSES.filter((c) => c.competencyId === competencyId),
      ...COURSES.filter((c) => c.competencyId !== competencyId),
    ],
    [competencyId],
  );
  const pickedCourse = courseId || courseChoices[0]?.id || "";

  const currentLevel = competencyId
    ? managerScoreFor(state, member, competencyId)
    : 0;
  const targetLevel =
    toLevel ??
    Math.min(4, Math.max(currentLevel + 1, row?.expected ?? currentLevel + 1));

  const levelChoices = [1, 2, 3, 4].filter(
    (n) => n >= Math.max(1, currentLevel) || n === targetLevel,
  );

  const submit = () => {
    const competency = COMPETENCIES.find((c) => c.id === competencyId);
    const course = findCourse(pickedCourse);
    if (!competency || !course) {
      notify(
        tt("Pick a competency and a course first", "เลือกสมรรถนะและหลักสูตรก่อน"),
      );
      return;
    }
    if (Date.parse(dueDate) <= Date.parse(startDate)) {
      notify(
        tt(
          "Due date must be after the start date",
          "วันสิ้นสุดต้องอยู่หลังวันเริ่มต้น",
        ),
      );
      return;
    }
    onSubmit({
      competencyId: competency.id,
      competencyName: competency.name,
      courseId: course.id,
      courseTitle: course.title,
      fromLevel: currentLevel,
      toLevel: Math.max(targetLevel, currentLevel),
      activity,
      startDate,
      dueDate,
      note: note.trim(),
    });
  };

  const who = member.nickname || member.name.split(" ")[0] || member.name;

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-2xl"
      title={
        editing
          ? tt(`Edit goal for ${who}`, `แก้ไขเป้าหมายของ ${who}`)
          : tt(`Add a goal for ${who}`, `เพิ่มเป้าหมายให้ ${who}`)
      }
      subtitle={tt(
        "Online Course, Coaching or On-the-job Training, with a level move and a timeline.",
        "เลือกวิธีพัฒนา เรียนออนไลน์ โค้ชชิ่ง หรือฝึกจากงานจริง พร้อมระดับเป้าหมายและกรอบเวลา",
      )}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button onClick={submit}>
            {editing ? t("action.saveChanges") : t("action.add")}
          </Button>
        </>
      }
    >
      {row ? (
        <p className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-brand-tint px-3 py-2 text-xs text-muted">
          {tt("Current", "ปัจจุบัน")} <b className="text-ink">{row.manager}</b> ·{" "}
          {t("label.expected")} <b className="text-ink">{row.expected}</b> ·{" "}
          {t("label.gap")}{" "}
          <b className={row.gap < 0 ? "text-accent" : "text-success"}>
            {formatGap(row.gap)}
          </b>
          <VerdictPill verdict={row.verdict} compact />
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
              setCourseId("");
              setToLevel(null);
            }}
          >
            {rows.map((r) => (
              <option key={r.competency.id} value={r.competency.id}>
                {r.competency.name} — {t("label.gap")} {formatGap(r.gap)}
              </option>
            ))}
          </Select>
        </Field>

        <Field className="sm:col-span-2" label={t("label.course")}>
          <Select
            value={pickedCourse}
            onChange={(e) => setCourseId(e.target.value)}
          >
            {courseChoices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
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
            onChange={(e) =>
              setActivity(e.target.value as IdpGoal["activity"])
            }
          >
            {ACTIVITIES.map((a) => (
              <option key={a} value={a}>
                {lang === "th" ? ACTIVITY_TH[a] : a}
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
