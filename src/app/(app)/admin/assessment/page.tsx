"use client";

import { Fragment, useMemo, useState } from "react";
import {
  CalendarDays,
  Download,
  Mail,
  RotateCcw,
  Save,
  SlidersHorizontal,
} from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeading,
  Pill,
  Select,
} from "@/components/ui";
import {
  AdminOnly,
  Note,
  SearchInput,
  TableWrap,
  Td,
  Th,
  downloadCsv,
  formatDate,
} from "@/components/admin/shared";
import {
  COMPETENCIES,
  GROUP_LABEL,
  GROUP_LABEL_TH,
  RATING_LABELS,
  type Group,
} from "@/data/competencies";
import {
  EXPECTED_BY_ROLE,
  FRAMEWORK,
  LEVEL_LABEL_TH,
  expectedFor,
  type RoleName,
} from "@/data/framework";
import { currentCycle } from "@/data/cycle";
import type { Person } from "@/data/people";
import { useDemo, type Weights } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export default function ManageAssessmentPage() {
  return (
    <AdminOnly>
      <ManageAssessment />
    </AdminOnly>
  );
}

/** Column order straight from the requirement pack's Map Level table. */
const ROLE_ORDER: RoleName[] = [
  "Executive",
  "Senior",
  "Specialist",
  "Team Lead",
  "Specialist Lead",
  "Manager",
  "Expertise",
  "Director",
];

const GROUPS: Group[] = ["core", "functional", "managerial"];
const WEIGHT_KEYS: (keyof Weights)[] = ["kpi", "core", "functional", "managerial"];

const cellKey = (role: string, competencyId: string) => `${role}|${competencyId}`;

/** Moves one slider and squeezes the remaining budget out of the other three. */
function rebalance(w: Weights, key: keyof Weights, raw: number): Weights {
  const value = Math.max(0, Math.min(100, Math.round(raw)));
  const others = WEIGHT_KEYS.filter((k) => k !== key);
  const rest = 100 - value;
  const currentSum = others.reduce((a, k) => a + w[k], 0);
  const next: Weights = { ...w, [key]: value };

  let assigned = 0;
  others.forEach((k, i) => {
    if (i === others.length - 1) {
      next[k] = Math.max(0, rest - assigned);
    } else {
      const share =
        currentSum > 0
          ? Math.round((w[k] / currentSum) * rest)
          : Math.floor(rest / others.length);
      next[k] = Math.max(0, share);
      assigned += next[k];
    }
  });

  // rounding can leave a point on the table — put it back on the last slider
  const total = WEIGHT_KEYS.reduce((a, k) => a + next[k], 0);
  if (total !== 100) {
    const last = others[others.length - 1]!;
    next[last] = Math.max(0, next[last] + (100 - total));
  }
  return next;
}

function ManageAssessment() {
  const { state, update, notify, pushNotification, logActivity } = useDemo();
  const { t, tt, lang } = useT();

  const CYCLE = currentCycle();
  const [cycleName, setCycleName] = useState(`${CYCLE.nameEn} Assessment`);
  const [start, setStart] = useState(CYCLE.startIso);
  const [end, setEnd] = useState(CYCLE.endIso);
  const [query, setQuery] = useState("");
  const [scaleCompetencyId, setScaleCompetencyId] = useState(FRAMEWORK[0]!.id);
  const [edits, setEdits] = useState<Record<string, number>>({});

  const weights = state.weights;
  const employees = state.employees;

  /* ------------------------------------------------------------ weights */

  function setWeight(key: keyof Weights, value: number) {
    update((s) => ({ ...s, weights: rebalance(s.weights, key, value) }));
  }

  function saveConfig() {
    logActivity(
      "Saved assessment configuration",
      cycleName,
      `KPI ${weights.kpi}% · Core ${weights.core}% · Functional ${weights.functional}% · Managerial ${weights.managerial}%`,
    );
    notify(
      tt(
        `Configuration saved — ${cycleName}`,
        `บันทึกการตั้งค่าแล้ว — ${cycleName}`,
      ),
    );
  }

  const weightLabel = (k: keyof Weights) =>
    k === "kpi" ? t("group.kpi") : t(`group.${k}`);

  const weightTotal = WEIGHT_KEYS.reduce((a, k) => a + weights[k], 0);

  /* ------------------------------------------------ expected level matrix */

  const expectedAt = (role: RoleName, competencyId: string) => {
    const key = cellKey(role, competencyId);
    if (key in edits) return edits[key]!;
    return expectedFor(role, competencyId);
  };

  const isModified = (role: RoleName, competencyId: string) =>
    cellKey(role, competencyId) in edits;

  function changeExpected(
    role: RoleName,
    competencyId: string,
    competencyName: string,
    value: number,
  ) {
    const before = expectedAt(role, competencyId);
    const original = expectedFor(role, competencyId);
    setEdits((e) => {
      const next = { ...e };
      if (value === original) delete next[cellKey(role, competencyId)];
      else next[cellKey(role, competencyId)] = value;
      return next;
    });
    logActivity(
      "Updated expected level",
      competencyName,
      `${role} ${before} → ${value}`,
    );
  }

  function resetMatrix() {
    const count = Object.keys(edits).length;
    setEdits({});
    logActivity("Reset expected-level matrix", cycleName, `${count} cells`);
    notify(
      tt(
        `${count} cell${count === 1 ? "" : "s"} reverted to the workbook values`,
        `คืนค่า ${count} ช่องกลับเป็นค่าจากไฟล์ต้นทางแล้ว`,
      ),
    );
  }

  function exportMatrix() {
    downloadCsv(
      "1moby-expected-level-matrix.csv",
      [t("label.competency"), tt("Group", "กลุ่ม"), ...ROLE_ORDER],
      COMPETENCIES.map((c) => [
        c.name,
        lang === "th" ? GROUP_LABEL_TH[c.group] : GROUP_LABEL[c.group],
        ...ROLE_ORDER.map((r) => {
          const v = expectedAt(r, c.id);
          return v == null ? "-" : v;
        }),
      ]),
    );
    notify(tt("Expected-level matrix exported", "ส่งออกตารางระดับที่คาดหวังแล้ว"));
  }

  const modifiedCount = Object.keys(edits).length;

  /* --------------------------------------------------- employee statuses */

  const selfOf = (p: Person) => state.selfAssessment[p.id];

  const reviewOf = (p: Person) => {
    const entry = Object.entries(state.managerReview).find(([k]) =>
      k.endsWith(`:${p.id}`),
    );
    return entry?.[1];
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((p) =>
      [p.name, p.position, p.jobRole, p.level].some((v) =>
        v.toLowerCase().includes(q),
      ),
    );
  }, [employees, query]);

  const selfDone = employees.filter((p) => selfOf(p)?.submittedAt).length;
  const reviewDone = employees.filter((p) => reviewOf(p)?.submittedAt).length;

  function sendReminder(p: Person) {
    pushNotification({
      audience: p.id,
      title: tt("Assessment reminder", "แจ้งเตือนการประเมิน"),
      body: tt(
        `Please complete your self assessment for ${cycleName} before ${formatDate(end)}.`,
        `กรุณาทำการประเมินตนเองของรอบ ${cycleName} ให้เสร็จก่อนวันที่ ${formatDate(end)}`,
      ),
      kind: "assessment",
      channel: "Both",
      href: "/assessment",
    });
    logActivity("Sent assessment reminder", p.name, cycleName);
    notify(
      tt(`Reminder sent to ${p.name}`, `ส่งการแจ้งเตือนถึง ${p.name} แล้ว`),
    );
  }

  function remindEveryonePending() {
    const pending = employees.filter((p) => !selfOf(p)?.submittedAt);
    pending.forEach((p) =>
      pushNotification({
        audience: p.id,
        title: tt("Assessment reminder", "แจ้งเตือนการประเมิน"),
        body: tt(
          `Your self assessment for ${cycleName} is still open.`,
          `การประเมินตนเองรอบ ${cycleName} ของคุณยังไม่เสร็จ`,
        ),
        kind: "assessment",
        channel: "Both",
        href: "/assessment",
      }),
    );
    logActivity("Sent bulk assessment reminder", cycleName, `${pending.length} people`);
    notify(
      tt(
        `Reminder sent to ${pending.length} pending employees`,
        `ส่งการแจ้งเตือนถึงพนักงานที่ยังไม่ส่ง ${pending.length} คน`,
      ),
    );
  }

  const statusPill = (submittedAt: string | null | undefined) =>
    submittedAt ? (
      <Pill tone="success">{t("status.completed")}</Pill>
    ) : (
      <Pill tone="danger">{t("status.incomplete")}</Pill>
    );

  /* ------------------------------------------------------- rating scale */

  const scaleCompetency =
    FRAMEWORK.find((f) => f.id === scaleCompetencyId) ?? FRAMEWORK[0]!;

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading
        title={tt("Manage Assessment", "จัดการการประเมิน")}
        right={<Pill tone="brand">{tt("On Going", "กำลังดำเนินการ")}</Pill>}
      />

      {/* -------------------------------------------------- cycle setup */}
      <Card>
        <CardHeader
          title={tt("Assessment cycle", "รอบการประเมิน")}
          subtitle={tt(
            "Name, window and the weighting applied to the final score.",
            "ชื่อรอบ ช่วงเวลา และการถ่วงน้ำหนักที่ใช้คำนวณคะแนนสุดท้าย",
          )}
          right={
            <span className="text-sm font-bold text-ink">
              {selfDone}/{employees.length}{" "}
              <span className="font-medium text-muted">
                {t("status.submitted")}
              </span>
            </span>
          }
        />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-3">
          <Field label={tt("Cycle name", "ชื่อรอบการประเมิน")}>
            <Input
              value={cycleName}
              onChange={(e) => setCycleName(e.target.value)}
              placeholder={`${CYCLE.nameEn} Assessment`}
            />
          </Field>
          <Field label={t("label.startDate")}>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label={t("label.dueDate")}>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>

        {/* ------------------------------------------------- weighting */}
        <div className="border-t border-line/70 px-5 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <SlidersHorizontal size={16} className="text-brand" />
            <h4 className="text-sm font-bold text-ink">
              {tt("Score weighting", "การถ่วงน้ำหนักคะแนน")}
            </h4>
            <Pill tone={weightTotal === 100 ? "success" : "danger"} className="ml-auto">
              {t("label.total")} {weightTotal}%
            </Pill>
          </div>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            {WEIGHT_KEYS.map((k) => (
              <label key={k} className="block">
                <span className="mb-1.5 flex items-center justify-between gap-3 text-sm font-medium text-ink">
                  <span>{weightLabel(k)}</span>
                  <span
                    className={cn(
                      k === "kpi" && "text-brand",
                      k === "core" && "text-amber",
                      k === "functional" && "text-success",
                      k === "managerial" && "text-accent",
                    )}
                  >
                    {weights[k]}%
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={weights[k]}
                  onChange={(e) => setWeight(k, Number(e.target.value))}
                  className={cn(
                    "w-full",
                    k === "kpi" && "accent-[#006bff]",
                    k === "core" && "accent-[#faa21b]",
                    k === "functional" && "accent-[#00b916]",
                    k === "managerial" && "accent-[#f05123]",
                  )}
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-surface">
            <div className="bg-brand" style={{ width: `${weights.kpi}%` }} />
            <div className="bg-amber" style={{ width: `${weights.core}%` }} />
            <div className="bg-success" style={{ width: `${weights.functional}%` }} />
            <div className="bg-accent" style={{ width: `${weights.managerial}%` }} />
          </div>
          <p className="mt-3 text-xs text-muted">
            {tt(
              "Moving one slider redistributes the rest so the four sections always add up to 100%. The assessment wizard reads these weights when it computes the final score.",
              "เมื่อเลื่อนแถบหนึ่ง ระบบจะปรับส่วนที่เหลือให้ผลรวมเท่ากับ 100% เสมอ ตัวช่วยการประเมินจะใช้ค่าน้ำหนักนี้ในการคำนวณคะแนนสุดท้าย",
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 px-5 py-4">
          <p className="flex items-center gap-2 text-xs text-muted">
            <CalendarDays size={14} />
            {tt("Active window", "ช่วงเวลาที่เปิด")} {formatDate(start)} →{" "}
            {formatDate(end)}
          </p>
          <Button onClick={saveConfig}>
            <Save size={15} />
            {tt("Save configuration", "บันทึกการตั้งค่า")}
          </Button>
        </div>
      </Card>

      {/* --------------------------------------- expected level matrix */}
      <Card className="mt-5">
        <CardHeader
          title={tt("Expected level matrix", "ตารางระดับที่คาดหวัง")}
          subtitle={tt(
            "Competency × career role, from the client's Map Level sheet. A dash means the competency is not assessed for that role.",
            "สมรรถนะ × บทบาทสายอาชีพ ตามชีต Map Level ของลูกค้า เครื่องหมายขีดหมายถึงไม่ได้ประเมินสมรรถนะนั้นสำหรับบทบาทนั้น",
          )}
          right={
            <div className="flex flex-wrap items-center gap-2">
              {modifiedCount > 0 ? (
                <Pill tone="warn">
                  {tt(
                    `${modifiedCount} modified`,
                    `แก้ไขแล้ว ${modifiedCount} ช่อง`,
                  )}
                </Pill>
              ) : null}
              <Button variant="outline" size="sm" onClick={exportMatrix}>
                <Download size={14} className="text-brand" />
                {t("action.exportCsv")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetMatrix}
                disabled={modifiedCount === 0}
              >
                <RotateCcw size={14} />
                {t("action.reset")}
              </Button>
            </div>
          }
        />
        <TableWrap>
          <table className="w-full min-w-[980px] border-collapse">
            <thead>
              <tr className="border-y border-line/70 bg-surface/60">
                <Th className="sticky left-0 z-10 bg-surface">
                  {t("label.competency")}
                </Th>
                {ROLE_ORDER.map((r) => (
                  <Th key={r} className="text-center">
                    {r}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((g) => (
                <Fragment key={g}>
                  <tr className="bg-brand-tint/60">
                    <Td
                      colSpan={ROLE_ORDER.length + 1}
                      className="py-2 text-[11px] font-bold uppercase tracking-wide text-brand"
                    >
                      {lang === "th" ? GROUP_LABEL_TH[g] : GROUP_LABEL[g]}
                    </Td>
                  </tr>
                  {COMPETENCIES.filter((c) => c.group === g).map((c) => (
                    <tr key={c.id} className="border-b border-line/60">
                      <Td className="sticky left-0 z-10 bg-white font-bold">
                        {c.name}
                      </Td>
                      {ROLE_ORDER.map((role) => {
                        const value = expectedAt(role, c.id);
                        if (value == null) {
                          return (
                            <Td key={role} className="text-center text-line-2">
                              <span
                                title={t("label.notAssessed")}
                                aria-label={`${c.name} — ${role}: ${t("label.notAssessed")}`}
                              >
                                –
                              </span>
                            </Td>
                          );
                        }
                        const modified = isModified(role, c.id);
                        return (
                          <Td key={role} className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Select
                                value={String(value)}
                                onChange={(e) =>
                                  changeExpected(
                                    role,
                                    c.id,
                                    c.name,
                                    Number(e.target.value),
                                  )
                                }
                                className={cn(
                                  "h-8 w-16 px-2 py-0 text-center text-xs",
                                  modified && "border-amber ring-2 ring-amber/30",
                                )}
                                aria-label={`${c.name} — ${role}`}
                              >
                                {[1, 2, 3, 4].map((n) => (
                                  <option key={n} value={n}>
                                    {n}
                                  </option>
                                ))}
                              </Select>
                              {modified ? (
                                <span
                                  className="size-1.5 rounded-full bg-amber"
                                  aria-label={tt("modified", "แก้ไขแล้ว")}
                                />
                              ) : null}
                            </div>
                          </Td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <div className="border-t border-line/70 p-5">
          <Note>
            {tt(
              "Edits are held in this screen's local state and written to the activity log, but they do not change the generated framework — persisting a new matrix needs the backend, because every employee's gap analysis is recalculated from it.",
              "การแก้ไขถูกเก็บไว้ในหน้าจอนี้และบันทึกลงบันทึกกิจกรรม แต่ยังไม่เปลี่ยนกรอบสมรรถนะที่สร้างไว้ — การบันทึกตารางใหม่อย่างถาวรต้องใช้ระบบหลังบ้าน เพราะการวิเคราะห์ส่วนต่างของพนักงานทุกคนจะถูกคำนวณใหม่จากตารางนี้",
            )}
          </Note>
        </div>
      </Card>

      {/* -------------------------------------------------- rating scale */}
      <Card className="mt-5">
        <CardHeader
          title={tt("Rating scale 1–4", "เกณฑ์การให้คะแนน 1–4")}
          subtitle={tt(
            "The client's own level wording, straight from the competency framework.",
            "ถ้อยคำระดับคะแนนของลูกค้า นำมาจากกรอบสมรรถนะโดยตรง",
          )}
          right={
            <Select
              value={scaleCompetencyId}
              onChange={(e) => setScaleCompetencyId(e.target.value)}
              className="h-9 w-56 py-0 text-xs"
              aria-label={t("label.competency")}
            >
              {FRAMEWORK.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          }
        />
        <ul className="grid gap-4 border-t border-line/70 p-5 lg:grid-cols-2">
          {[4, 3, 2, 1].map((n) => {
            const level = scaleCompetency.levels.find((l) => l.score === n);
            return (
              <li
                key={n}
                className="flex items-start gap-3 rounded-xl border border-line/70 p-4"
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold",
                    n === 4 && "bg-success/10 text-success",
                    n === 3 && "bg-brand-tint text-brand",
                    n === 2 && "bg-amber/15 text-amber",
                    n === 1 && "bg-accent/10 text-accent",
                  )}
                >
                  {n}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">{RATING_LABELS[n]}</p>
                  <p className="mt-0.5 text-xs font-medium text-muted">
                    {LEVEL_LABEL_TH[n]}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-ink/80">
                    {level?.descTh ?? "—"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="px-5 pb-5">
          <Note>
            {tt(
              "The Thai wording is the definition the assessors see on the rating screens — it is never machine translated.",
              "ถ้อยคำภาษาไทยนี้คือคำนิยามที่ผู้ประเมินเห็นบนหน้าจอให้คะแนน ไม่ได้แปลด้วยเครื่อง",
            )}
          </Note>
        </div>
      </Card>

      {/* --------------------------------------------- employee statuses */}
      <Card className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h3 className="text-lg font-bold text-ink">
              {tt("Employee status", "สถานะการประเมินรายบุคคล")}
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              {tt(
                `Self assessment ${selfDone}/${employees.length} · Manager review ${reviewDone}/${employees.length} · ${cycleName}`,
                `ประเมินตนเอง ${selfDone}/${employees.length} · หัวหน้าประเมิน ${reviewDone}/${employees.length} · ${cycleName}`,
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder={t("admin.searchEmployee")}
              className="w-full sm:w-64"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={remindEveryonePending}
              disabled={selfDone === employees.length}
            >
              <Mail size={13} className="text-brand" />
              {tt("Remind everyone pending", "แจ้งเตือนผู้ที่ยังไม่ส่ง")}
            </Button>
          </div>
        </div>
        <TableWrap>
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="border-y border-line/70 bg-surface/60">
                <Th>{t("label.employee")}</Th>
                <Th>{t("label.level")}</Th>
                <Th>{t("mode.self")}</Th>
                <Th>{t("mode.supervisor")}</Th>
                <Th className="w-40">{t("label.progress")}</Th>
                <Th className="text-right">{t("label.action")}</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const self = selfOf(p);
                const review = reviewOf(p);
                return (
                  <tr key={p.id} className="border-b border-line/60 last:border-0">
                    <Td>
                      <span className="block font-bold">{p.name}</span>
                      <span className="block text-[10px] text-muted">
                        {p.jobRole} · {p.position}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{p.level}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        {statusPill(self?.submittedAt)}
                        <span className="text-[10px] text-muted">
                          {self?.submittedAt
                            ? formatDate(self.submittedAt.slice(0, 10))
                            : "-"}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        {statusPill(review?.submittedAt)}
                        <span className="text-[10px] text-muted">
                          {review?.submittedAt
                            ? formatDate(review.submittedAt.slice(0, 10))
                            : "-"}
                        </span>
                      </div>
                    </Td>
                    <Td className="text-muted">{p.phase}%</Td>
                    <Td>
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => sendReminder(p)}
                        >
                          <Mail size={13} className="text-brand" />
                          {t("action.sendReminder")}
                        </Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
              {visible.length === 0 ? (
                <tr>
                  <Td colSpan={6} className="py-10 text-center text-muted">
                    {t("admin.noMatch")}
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableWrap>
        <div className="border-t border-line/70 p-5">
          <Note>
            {tt(
              "Status is read live from the demo store: “Self” is the employee's own submission, “Supervisor” is a submitted manager review keyed reviewer:target. Sending a reminder raises a real in-app notification for that person.",
              "สถานะอ่านจากข้อมูลจริงในระบบสาธิต: “ประเมินตนเอง” คือการส่งของพนักงานเอง ส่วน “หัวหน้าประเมิน” คือผลการประเมินที่หัวหน้าส่งแล้ว การกดแจ้งเตือนจะส่งการแจ้งเตือนจริงถึงพนักงานคนนั้น",
            )}
          </Note>
        </div>
      </Card>

      <p className="mt-4 text-[11px] text-muted">
        {tt(
          `${Object.keys(EXPECTED_BY_ROLE).length} career roles configured · ${COMPETENCIES.length} competencies`,
          `กำหนดบทบาทสายอาชีพ ${Object.keys(EXPECTED_BY_ROLE).length} บทบาท · สมรรถนะ ${COMPETENCIES.length} รายการ`,
        )}
      </p>
    </div>
  );
}
