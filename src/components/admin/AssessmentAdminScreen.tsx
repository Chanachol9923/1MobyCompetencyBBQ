"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Download,
  Mail,
  Save,
  SlidersHorizontal,
} from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Modal,
  PageHeading,
  Pill,
  Select,
} from "@/components/ui";
import {
  Note,
  SearchInput,
  TableWrap,
  Td,
  Th,
  downloadCsv,
  formatDate,
} from "@/components/admin/shared";
import { ResultBanner } from "@/components/admin/rbac-shared";
import type {
  ActionResult,
  AssessmentAdminData,
  CompetencyGroupValue,
  CycleStatusValue,
  MatrixCompetency,
} from "@/components/admin/content-types";
import {
  remindEmployee,
  remindEveryonePending,
  saveCycle,
  setExpectedLevel,
  updateCycleWeights,
} from "@/server/admin-content";
import { PERMISSIONS } from "@/lib/permissions";
import { usePermission } from "@/lib/viewer";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type WeightKey = "kpi" | "core" | "functional" | "managerial";
const WEIGHT_KEYS: WeightKey[] = ["kpi", "core", "functional", "managerial"];
type Weights = Record<WeightKey, number>;

const GROUPS: CompetencyGroupValue[] = ["CORE", "FUNCTIONAL", "MANAGERIAL"];
const GROUP_KEY: Record<CompetencyGroupValue, string> = {
  CORE: "group.core",
  FUNCTIONAL: "group.functional",
  MANAGERIAL: "group.managerial",
};

const CYCLE_STATUSES: CycleStatusValue[] = ["DRAFT", "OPEN", "REVIEW", "CLOSED"];

const cellKey = (jobRoleId: string, competencyId: string) =>
  `${jobRoleId}:${competencyId}`;

/**
 * Moves one slider and squeezes the remaining budget out of the other three, so
 * the four always read 100. The server refuses anything that does not, which is
 * what actually enforces the rule — this only keeps the UI honest while dragging.
 */
function rebalance(w: Weights, key: WeightKey, raw: number): Weights {
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

  const total = WEIGHT_KEYS.reduce((a, k) => a + next[k], 0);
  if (total !== 100) {
    const last = others[others.length - 1]!;
    next[last] = Math.max(0, next[last] + (100 - total));
  }
  return next;
}

type PendingCell = {
  jobRoleId: string;
  jobRoleName: string;
  competency: MatrixCompetency;
  from: number | null;
  to: number | null;
  employeeCount: number;
  scoredCount: number;
};

/**
 * The assessment cycle, the weighting and the competency framework.
 *
 * The matrix is the part that matters. Every cell is a row of `ExpectedLevel`,
 * and "Not assessed" is a real, saved null rather than a blank: the gap engine
 * drops that competency from the person's report entirely instead of rendering
 * a zero against them. Because one cell can change what an entire career role is
 * measured on, the change is described — how many people, how many existing
 * scores stop counting — and confirmed before it is written.
 */
export function AssessmentAdminScreen({ data }: { data: AssessmentAdminData }) {
  const { t, tt, lang } = useT();
  const { can } = usePermission();
  const { cycle, jobRoles, competencies, matrix, scored, employees, counts } = data;

  const canEditFramework = can(PERMISSIONS.MANAGE_FRAMEWORK);

  const [result, setResult] = useState<ActionResult | null>(null);
  const [busy, startTransition] = useTransition();

  const [nameEn, setNameEn] = useState(cycle?.nameEn ?? "");
  const [nameTh, setNameTh] = useState(cycle?.nameTh ?? "");
  const [startsAt, setStartsAt] = useState(cycle?.startsAt ?? "");
  const [endsAt, setEndsAt] = useState(cycle?.endsAt ?? "");
  const [status, setStatus] = useState<CycleStatusValue>(cycle?.status ?? "OPEN");

  const [weights, setWeights] = useState<Weights>({
    kpi: cycle?.weightKpi ?? 40,
    core: cycle?.weightCore ?? 20,
    functional: cycle?.weightFunctional ?? 25,
    managerial: cycle?.weightManagerial ?? 15,
  });

  const [pending, setPending] = useState<PendingCell | null>(null);
  const [query, setQuery] = useState("");
  const [scaleId, setScaleId] = useState(competencies[0]?.id ?? "");

  const weightTotal = WEIGHT_KEYS.reduce((a, k) => a + weights[k], 0);
  const weightsDirty =
    cycle !== null &&
    (weights.kpi !== cycle.weightKpi ||
      weights.core !== cycle.weightCore ||
      weights.functional !== cycle.weightFunctional ||
      weights.managerial !== cycle.weightManagerial);

  const competencyName = (c: { nameEn: string; nameTh: string | null }) =>
    lang === "th" ? (c.nameTh ?? c.nameEn) : c.nameEn;

  const visibleEmployees = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((p) =>
      [p.name, p.jobRoleName, p.level, p.departmentName ?? ""].some((v) =>
        v.toLowerCase().includes(q),
      ),
    );
  }, [employees, query]);

  const scaleCompetency =
    competencies.find((c) => c.id === scaleId) ?? competencies[0] ?? null;

  function run(fn: () => Promise<ActionResult>) {
    startTransition(async () => setResult(await fn()));
  }

  function weightLabel(k: WeightKey) {
    return k === "kpi" ? t("group.kpi") : t(`group.${k}`);
  }

  function requestCellChange(
    jobRoleId: string,
    jobRoleName: string,
    employeeCount: number,
    competency: MatrixCompetency,
    raw: string,
  ) {
    const key = cellKey(jobRoleId, competency.id);
    const from = matrix[key] ?? null;
    const to = raw === "none" ? null : Number(raw);
    if (from === to) return;
    setPending({
      jobRoleId,
      jobRoleName,
      competency,
      from,
      to,
      employeeCount,
      scoredCount: scored[key] ?? 0,
    });
  }

  function applyCellChange() {
    const cell = pending;
    setPending(null);
    if (!cell) return;
    startTransition(async () => {
      const res = await setExpectedLevel({
        jobRoleId: cell.jobRoleId,
        competencyId: cell.competency.id,
        level: cell.to,
      });
      setResult(res);
    });
  }

  function exportMatrix() {
    downloadCsv(
      "1moby-expected-level-matrix.csv",
      [t("label.competency"), tt("Group", "กลุ่ม"), ...jobRoles.map((r) => r.name)],
      competencies.map((c) => [
        competencyName(c),
        t(GROUP_KEY[c.group]),
        ...jobRoles.map((r) => {
          const v = matrix[cellKey(r.id, c.id)] ?? null;
          return v === null ? "-" : v;
        }),
      ]),
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading
        title={tt("Manage Assessment", "จัดการการประเมิน")}
        subtitle={tt(
          "The cycle, how the final score is weighted, and the framework itself.",
          "รอบการประเมิน การถ่วงน้ำหนักคะแนนสุดท้าย และกรอบสมรรถนะ",
        )}
        right={
          cycle ? (
            <Pill tone={cycle.status === "OPEN" ? "brand" : "neutral"}>
              {cycle.status === "OPEN"
                ? tt("On Going", "กำลังดำเนินการ")
                : cycle.status}
            </Pill>
          ) : null
        }
      />

      <ResultBanner result={result} onDismiss={() => setResult(null)} />

      {/* -------------------------------------------------- cycle setup */}
      <Card>
        <CardHeader
          title={tt("Assessment cycle", "รอบการประเมิน")}
          subtitle={tt(
            "Name, window and status. Everything on every other screen is scoped to the open cycle.",
            "ชื่อรอบ ช่วงเวลา และสถานะ ทุกหน้าจอในระบบอ้างอิงกับรอบที่เปิดอยู่",
          )}
          right={
            <span className="text-sm font-bold text-ink">
              {counts.selfSubmitted}/{counts.headcount}{" "}
              <span className="font-medium text-muted">{t("status.submitted")}</span>
            </span>
          }
        />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={tt("Cycle name (English)", "ชื่อรอบ (อังกฤษ)")}>
            <Input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="2026 Q3 Assessment"
            />
          </Field>
          <Field label={tt("Cycle name (Thai)", "ชื่อรอบ (ไทย)")}>
            <Input
              value={nameTh}
              onChange={(e) => setNameTh(e.target.value)}
              placeholder="การประเมินไตรมาส 3 ปี 2026"
            />
          </Field>
          <Field label={t("label.status")}>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as CycleStatusValue)}
            >
              {CYCLE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("label.startDate")}>
            <Input
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </Field>
          <Field label={t("label.dueDate")}>
            <Input
              type="date"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </Field>
          <div className="flex items-end">
            <Button
              className="w-full"
              disabled={busy}
              onClick={() =>
                run(() =>
                  saveCycle({
                    cycleId: cycle?.id ?? "",
                    nameEn,
                    nameTh,
                    startsAt,
                    endsAt,
                    status,
                  }),
                )
              }
            >
              <Save size={15} />
              {cycle
                ? tt("Save cycle", "บันทึกรอบการประเมิน")
                : tt("Create cycle", "สร้างรอบการประเมิน")}
            </Button>
          </div>
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
                  disabled={!cycle}
                  onChange={(e) =>
                    setWeights((w) => rebalance(w, k, Number(e.target.value)))
                  }
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
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-xs leading-relaxed text-muted">
              {tt(
                "Moving one slider redistributes the rest so the four sections always add up to 100%. The server checks that total again before it writes the cycle's four weight columns — a request that does not add up is refused.",
                "เมื่อเลื่อนแถบหนึ่ง ระบบจะปรับส่วนที่เหลือให้ผลรวมเท่ากับ 100% เสมอ และเซิร์ฟเวอร์จะตรวจผลรวมอีกครั้งก่อนบันทึกลงคอลัมน์น้ำหนักทั้งสี่ของรอบประเมิน หากไม่ครบ 100% จะถูกปฏิเสธ",
              )}
            </p>
            <Button
              variant={weightsDirty ? "primary" : "outline"}
              disabled={!cycle || busy || weightTotal !== 100 || !weightsDirty}
              onClick={() =>
                cycle &&
                run(() =>
                  updateCycleWeights({
                    cycleId: cycle.id,
                    kpi: weights.kpi,
                    core: weights.core,
                    functional: weights.functional,
                    managerial: weights.managerial,
                  }),
                )
              }
            >
              <Save size={15} />
              {tt("Save weighting", "บันทึกการถ่วงน้ำหนัก")}
            </Button>
          </div>
        </div>

        {cycle ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-line/70 px-5 py-4">
            <p className="flex items-center gap-2 text-xs text-muted">
              <CalendarDays size={14} />
              {tt("Active window", "ช่วงเวลาที่เปิด")} {formatDate(cycle.startsAt)} →{" "}
              {formatDate(cycle.endsAt)} ·{" "}
              {tt(`${cycle.daysRemaining} days left`, `เหลืออีก ${cycle.daysRemaining} วัน`)}
            </p>
          </div>
        ) : null}
      </Card>

      {/* --------------------------------------- expected level matrix */}
      <Card className="mt-5">
        <CardHeader
          title={tt("Expected level matrix", "ตารางระดับที่คาดหวัง")}
          subtitle={tt(
            "Competency × career role. A dash is a saved decision, not a blank: that role is not assessed on that competency and it never appears in their gap report.",
            "สมรรถนะ × บทบาทสายอาชีพ เครื่องหมายขีดคือค่าที่บันทึกไว้ ไม่ใช่ช่องว่าง หมายถึงบทบาทนั้นไม่ถูกประเมินสมรรถนะนั้น และจะไม่ปรากฏในรายงานช่องว่างเลย",
          )}
          right={
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="brand">
                {tt(
                  `${counts.assessedCells} assessed`,
                  `ประเมิน ${counts.assessedCells} ช่อง`,
                )}
              </Pill>
              <Pill tone="neutral">
                {tt(
                  `${counts.notAssessedCells} not assessed`,
                  `ไม่ประเมิน ${counts.notAssessedCells} ช่อง`,
                )}
              </Pill>
              <Button variant="outline" size="sm" onClick={exportMatrix}>
                <Download size={14} className="text-brand" />
                {t("action.exportCsv")}
              </Button>
            </div>
          }
        />
        {!canEditFramework ? (
          <div className="px-5 pb-3">
            <Note>
              {tt(
                "Your role can see the framework but not change it — that needs “Manage competency framework”.",
                "บทบาทของคุณดูกรอบสมรรถนะได้แต่แก้ไขไม่ได้ ต้องมีสิทธิ์ “จัดการกรอบสมรรถนะ”",
              )}
            </Note>
          </div>
        ) : null}
        <TableWrap>
          <table className="w-full min-w-[980px] border-collapse">
            <thead>
              <tr className="border-y border-line/70 bg-surface/60">
                <Th className="sticky left-0 z-10 bg-surface">
                  {t("label.competency")}
                </Th>
                {jobRoles.map((r) => (
                  <Th key={r.id} className="text-center">
                    <span className="block">{r.name}</span>
                    <span className="block text-[10px] font-normal text-line-2">
                      {tt(`${r.employeeCount} people`, `${r.employeeCount} คน`)}
                    </span>
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((g) => {
                const inGroup = competencies.filter((c) => c.group === g);
                if (!inGroup.length) return null;
                return (
                  <Fragment key={g}>
                    <tr className="bg-brand-tint/60">
                      <Td
                        colSpan={jobRoles.length + 1}
                        className="py-2 text-[11px] font-bold uppercase tracking-wide text-brand"
                      >
                        {t(GROUP_KEY[g])}
                      </Td>
                    </tr>
                    {inGroup.map((c) => (
                      <tr key={c.id} className="border-b border-line/60">
                        <Td className="sticky left-0 z-10 bg-white font-bold">
                          {competencyName(c)}
                        </Td>
                        {jobRoles.map((role) => {
                          const key = cellKey(role.id, c.id);
                          const value = matrix[key] ?? null;
                          const hasScores = (scored[key] ?? 0) > 0;
                          return (
                            <Td key={role.id} className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Select
                                  value={value === null ? "none" : String(value)}
                                  disabled={!canEditFramework || busy}
                                  onChange={(e) =>
                                    requestCellChange(
                                      role.id,
                                      role.name,
                                      role.employeeCount,
                                      c,
                                      e.target.value,
                                    )
                                  }
                                  className={cn(
                                    "h-8 w-[76px] px-2 py-0 text-center text-xs",
                                    value === null && "text-line-2",
                                  )}
                                  aria-label={`${c.nameEn} — ${role.name}`}
                                >
                                  <option value="none">
                                    {tt("–  n/a", "–  ไม่ประเมิน")}
                                  </option>
                                  {[1, 2, 3, 4].map((n) => (
                                    <option key={n} value={n}>
                                      {n}
                                    </option>
                                  ))}
                                </Select>
                                {value !== null && hasScores ? (
                                  <span
                                    className="size-1.5 shrink-0 rounded-full bg-success"
                                    aria-label={tt("has scores", "มีคะแนนแล้ว")}
                                  />
                                ) : null}
                              </div>
                            </Td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
        <div className="border-t border-line/70 p-5">
          <Note>
            {tt(
              "Each cell writes an ExpectedLevel row the moment you confirm it. A green dot means somebody already has a score there this cycle — turning that cell off does not delete their score, it stops it being counted.",
              "แต่ละช่องจะบันทึกลงตาราง ExpectedLevel ทันทีที่ยืนยัน จุดสีเขียวหมายถึงมีพนักงานได้คะแนนในช่องนั้นแล้วในรอบนี้ การปิดช่องจะไม่ลบคะแนนเดิม เพียงแต่จะไม่ถูกนำมาคำนวณ",
            )}
          </Note>
        </div>
      </Card>

      {/* -------------------------------------------------- rating scale */}
      {scaleCompetency ? (
        <Card className="mt-5">
          <CardHeader
            title={tt("Rating scale 1–4", "เกณฑ์การให้คะแนน 1–4")}
            subtitle={tt(
              "The client's own level wording, read from the competency's own level rows.",
              "ถ้อยคำระดับคะแนนของลูกค้า อ่านจากข้อมูลระดับของสมรรถนะนั้นโดยตรง",
            )}
            right={
              <Select
                value={scaleCompetency.id}
                onChange={(e) => setScaleId(e.target.value)}
                className="h-9 w-56 py-0 text-xs"
                aria-label={t("label.competency")}
              >
                {competencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {competencyName(c)}
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
                    <p className="text-sm font-bold text-ink">
                      {level ? (lang === "th" ? level.labelTh : level.labelEn) : t(`rating.${n}`)}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-ink/80">
                      {(lang === "th" ? level?.descTh : level?.descEn) ??
                        level?.descTh ??
                        level?.descEn ??
                        "—"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {/* --------------------------------------------- employee statuses */}
      <Card className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h3 className="text-lg font-bold text-ink">
              {tt("Employee status", "สถานะการประเมินรายบุคคล")}
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              {tt(
                `Self ${counts.selfSubmitted}/${counts.headcount} · Supervisor ${counts.supervisorSubmitted}/${counts.headcount}`,
                `ประเมินตนเอง ${counts.selfSubmitted}/${counts.headcount} · หัวหน้าประเมิน ${counts.supervisorSubmitted}/${counts.headcount}`,
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
              disabled={busy || counts.selfSubmitted === counts.headcount}
              onClick={() => run(() => remindEveryonePending({ mode: "SELF" }))}
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
              {visibleEmployees.map((p) => (
                <tr key={p.id} className="border-b border-line/60 last:border-0">
                  <Td>
                    <span className="block font-bold">{p.name}</span>
                    <span className="block text-[10px] text-muted">
                      {p.jobRoleName}
                      {p.departmentName ? ` · ${p.departmentName}` : ""}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-muted">{p.level}</Td>
                  <Td>
                    <Pill tone={p.selfSubmitted ? "success" : "danger"}>
                      {p.selfSubmitted ? t("status.completed") : t("status.incomplete")}
                    </Pill>
                  </Td>
                  <Td>
                    <Pill tone={p.supervisorSubmitted ? "success" : "danger"}>
                      {p.supervisorSubmitted
                        ? t("status.completed")
                        : t("status.incomplete")}
                    </Pill>
                  </Td>
                  <Td className="text-muted">
                    {tt(
                      `${p.phase}% of ${p.assessedCount}`,
                      `${p.phase}% จาก ${p.assessedCount}`,
                    )}
                  </Td>
                  <Td>
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy || p.selfSubmitted}
                        onClick={() => run(() => remindEmployee({ employeeId: p.id }))}
                      >
                        <Mail size={13} className="text-brand" />
                        {t("action.sendReminder")}
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
              {visibleEmployees.length === 0 ? (
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
              "“Progress” is scored competencies over the competencies that person's career role is assessed on — which is exactly what the matrix above decides. Sending a reminder raises a real in-app notification for that person.",
              "“ความคืบหน้า” คือจำนวนสมรรถนะที่มีคะแนน หารด้วยจำนวนสมรรถนะที่บทบาทของพนักงานคนนั้นถูกประเมิน ซึ่งกำหนดโดยตารางด้านบนนี้เอง การกดแจ้งเตือนจะส่งการแจ้งเตือนจริงถึงพนักงานคนนั้น",
            )}
          </Note>
        </div>
      </Card>

      {/* ---------------------------------------- confirm a matrix edit */}
      <Modal
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title={tt("Change the framework?", "ยืนยันการแก้ไขกรอบสมรรถนะ")}
        width="max-w-lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setPending(null)}>
              {t("action.cancel")}
            </Button>
            <Button
              variant={pending?.to === null ? "danger" : "primary"}
              disabled={busy}
              onClick={applyCellChange}
            >
              {pending?.to === null
                ? tt("Stop assessing it", "ยืนยันไม่ประเมิน")
                : tt("Save expected level", "บันทึกระดับที่คาดหวัง")}
            </Button>
          </>
        }
      >
        {pending ? (
          <div className="space-y-3 text-sm">
            <p className="text-ink">
              <span className="font-bold">{pending.jobRoleName}</span>{" "}
              {tt("on", "ในสมรรถนะ")}{" "}
              <span className="font-bold">{competencyName(pending.competency)}</span>:{" "}
              <span className="font-medium">
                {pending.from === null
                  ? tt("Not assessed", "ไม่ประเมิน")
                  : tt(`Level ${pending.from}`, `ระดับ ${pending.from}`)}
              </span>{" "}
              →{" "}
              <span className="font-bold text-brand">
                {pending.to === null
                  ? tt("Not assessed", "ไม่ประเมิน")
                  : tt(`Level ${pending.to}`, `ระดับ ${pending.to}`)}
              </span>
            </p>

            <div className="flex items-start gap-3 rounded-xl border border-amber/40 bg-amber/10 p-4">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber" />
              <div className="min-w-0 space-y-1.5 leading-relaxed text-ink">
                <p>
                  {tt(
                    `${pending.employeeCount} ${pending.employeeCount === 1 ? "person holds" : "people hold"} this career role. Their gap report, skill index and assessment progress are all recalculated from this cell.`,
                    `มีพนักงาน ${pending.employeeCount} คนอยู่ในบทบาทนี้ รายงานช่องว่าง ดัชนีสมรรถนะ และความคืบหน้าการประเมินของพวกเขาจะถูกคำนวณใหม่จากช่องนี้`,
                  )}
                </p>
                {pending.to === null ? (
                  <p>
                    {pending.scoredCount > 0
                      ? tt(
                          `${pending.scoredCount} of them already have a score for it this cycle. The score is kept but stops being counted — the competency disappears from their report rather than showing as a zero.`,
                          `ในจำนวนนี้ ${pending.scoredCount} คนมีคะแนนในสมรรถนะนี้แล้วในรอบปัจจุบัน คะแนนจะยังถูกเก็บไว้แต่จะไม่ถูกนำมาคิด สมรรถนะนี้จะหายไปจากรายงานของเขา ไม่ใช่แสดงเป็นศูนย์`,
                        )
                      : tt(
                          "Nobody has been scored on it yet, so nothing is lost.",
                          "ยังไม่มีใครได้รับคะแนนในสมรรถนะนี้ จึงไม่มีข้อมูลใดสูญหาย",
                        )}
                  </p>
                ) : pending.from === null ? (
                  <p>
                    {tt(
                      "They are not measured on this competency today. After this they will be, and it counts as unscored until somebody rates it.",
                      "ปัจจุบันพวกเขายังไม่ถูกประเมินสมรรถนะนี้ หลังจากบันทึกจะถูกประเมิน และจะนับว่ายังไม่มีคะแนนจนกว่าจะมีผู้ให้คะแนน",
                    )}
                  </p>
                ) : (
                  <p>
                    {tt(
                      "Gap is supervisor score minus expected level, so raising the bar can turn a “Competency Fit” into a “Development”.",
                      "ช่องว่างคำนวณจากคะแนนของหัวหน้าลบด้วยระดับที่คาดหวัง การยกระดับที่คาดหวังขึ้นอาจทำให้ผลเปลี่ยนจาก “ตรงตามมาตรฐาน” เป็น “ควรพัฒนา”",
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
