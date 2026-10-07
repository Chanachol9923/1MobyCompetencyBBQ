"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Send,
} from "lucide-react";
import { Button, Card, Modal, PageHeading, Pill } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { CompetencyRatingCard } from "./CompetencyRatingCard";
import { KpiStep } from "./KpiStep";
import { ResultStep } from "./ResultStep";
import { Stepper } from "./Stepper";
import {
  MODE_KEY,
  formatDateTime,
  groupDictKey,
  pick,
  stepDictKey,
  stepsFor,
  type CompetencyGroup,
  type CompetencyQuestion,
  type StepKey,
} from "./lib";
import type { WizardData } from "@/server/assessment";
import {
  reopenAssessmentAction,
  saveKpiItemsAction,
  saveKpiScoreAction,
  saveScoreAction,
  submitAssessmentAction,
  type ActionError,
  type KpiItemInput,
} from "@/app/(app)/assessment/actions";

/**
 * The 180° wizard, over Postgres.
 *
 * Answers are written as they are made — one `AssessmentScore` upsert per
 * rating — so a half-finished assessment survives a refresh, and "submit" only
 * has to stamp `submittedAt`. The component keeps an optimistic copy of the
 * answers so the scale responds instantly, but the database is what it reloads
 * from, never this state.
 *
 * Which steps exist comes from the *target's* career role: the server already
 * dropped every competency that role has no expected level for, so an Executive
 * simply has no Managerial step.
 */
export function AssessmentWizard({ data }: { data: WizardData }) {
  const { t, tt, lang } = useT();
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<Record<string, number | undefined>>(
    () => ({ ...data.scores }),
  );
  const [kpiScores, setKpiScores] = useState<Record<string, number | null>>({});
  const [error, setError] = useState<ActionError | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [confirmReopen, setConfirmReopen] = useState(false);

  const { competencies, kpis, cycle, subject, mode } = data;
  const steps = useMemo(() => stepsFor(competencies), [competencies]);

  const kpiScoreOf = (id: string, fallback: number | null) =>
    kpiScores[id] ?? fallback;

  const stepComplete = useMemo(
    () =>
      steps.map((key) => {
        if (key === "kpi") {
          return kpis.every((i) => kpiScoreOf(i.id, i.score) !== null);
        }
        if (key === "complete") return true;
        return competencies
          .filter((c) => c.group === key)
          .every((c) => Boolean(scores[c.id]));
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [steps, kpis, kpiScores, competencies, scores],
  );

  const allDone = stepComplete.every(Boolean);
  const submittedAt = data.submittedAt;

  /* ------------------------------------------------------------- errors */

  const ERROR_TEXT: Record<ActionError, [string, string]> = {
    not_authorised: [
      "You are not allowed to change this assessment.",
      "คุณไม่มีสิทธิ์แก้ไขแบบประเมินนี้",
    ],
    invalid: ["That value was not accepted.", "ค่าที่ส่งไปไม่ถูกต้อง"],
    no_cycle: [
      "There is no assessment cycle to write into.",
      "ยังไม่มีรอบการประเมินให้บันทึก",
    ],
    cycle_closed: [
      "This assessment cycle is not open.",
      "รอบการประเมินนี้ยังไม่เปิดหรือปิดไปแล้ว",
    ],
    not_found: ["That record no longer exists.", "ไม่พบข้อมูลนี้แล้ว"],
    not_assessed: [
      "This career role is not assessed on that competency.",
      "ตำแหน่งนี้ไม่ได้ถูกประเมินในสมรรถนะดังกล่าว",
    ],
    already_submitted: [
      "This assessment has already been submitted. Re-open it to make changes.",
      "แบบประเมินนี้ถูกส่งไปแล้ว หากต้องการแก้ไขให้เปิดรอบใหม่",
    ],
    not_submitted: [
      "This assessment has not been submitted yet.",
      "แบบประเมินนี้ยังไม่ได้ถูกส่ง",
    ],
    incomplete: [
      "Rate every KPI and competency before submitting.",
      "ให้คะแนน KPI และสมรรถนะให้ครบก่อนส่ง",
    ],
    bad_weights: [
      "KPI weights must total 100%.",
      "น้ำหนักของ KPI ต้องรวมได้ 100%",
    ],
  };

  const errorText = error ? tt(ERROR_TEXT[error][0], ERROR_TEXT[error][1]) : null;

  /* ---------------------------------------------------------- mutations */

  const rate = (competencyId: string, score: number) => {
    const previous = scores[competencyId];
    setScores((s) => ({ ...s, [competencyId]: score }));
    setError(null);
    startTransition(async () => {
      const result = await saveScoreAction({
        mode,
        targetId: subject.id,
        competencyId,
        score,
      });
      if (!result.ok) {
        // the database refused it — put the scale back rather than leave the
        // browser showing an answer nobody saved
        setScores((s) => ({ ...s, [competencyId]: previous }));
        setError(result.error);
      }
    });
  };

  const rateKpi = (kpiItemId: string, score: number) => {
    const item = kpis.find((k) => k.id === kpiItemId);
    const previous = kpiScoreOf(kpiItemId, item?.score ?? null);
    setKpiScores((s) => ({ ...s, [kpiItemId]: score }));
    setError(null);
    startTransition(async () => {
      const result = await saveKpiScoreAction({
        mode,
        targetId: subject.id,
        kpiItemId,
        score,
      });
      if (!result.ok) {
        setKpiScores((s) => ({ ...s, [kpiItemId]: previous }));
        setError(result.error);
      }
    });
  };

  const saveKpiItems = (items: KpiItemInput[]) => {
    setError(null);
    startTransition(async () => {
      const result = await saveKpiItemsAction({
        mode,
        targetId: subject.id,
        items,
      });
      if (!result.ok) setError(result.error);
    });
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await submitAssessmentAction({
        mode,
        targetId: subject.id,
      });
      if (result.ok) setJustSubmitted(true);
      else setError(result.error);
    });
  };

  const reopen = () => {
    setConfirmReopen(false);
    setError(null);
    startTransition(async () => {
      const result = await reopenAssessmentAction({
        mode,
        targetId: subject.id,
      });
      if (result.ok) {
        setJustSubmitted(false);
        setStep(0);
      } else setError(result.error);
    });
  };

  /* -------------------------------------------------------------- header */

  const modeName = t(MODE_KEY[mode]);
  const heading = (
    <PageHeading
      title={t("nav.assessment")}
      subtitle={`${modeName} · ${subject.name} — ${subject.position ?? subject.jobRole} (${subject.level})`}
      right={
        <div className="flex items-center gap-2">
          <Pill tone="brand">{pick(lang, cycle.nameEn, cycle.nameTh)}</Pill>
          <Link href="/assessment">
            <Button variant="outline" size="sm">
              <ArrowLeft size={15} />
              {tt("Assessment hub", "หน้าการประเมิน")}
            </Button>
          </Link>
        </div>
      }
    />
  );

  const banner = errorText ? (
    <Card className="mb-6 border-accent/40 bg-accent/5 p-4">
      <p className="break-words text-sm text-accent">{errorText}</p>
    </Card>
  ) : null;

  const resultStep = (
    <ResultStep
      mode={mode}
      weights={cycle.weights}
      competencies={competencies}
      scores={scores}
      kpis={kpis}
      kpiScores={kpiScores}
      counterpart={data.counterpart}
    />
  );

  /* ------------------------------------------------------------- success */

  if (justSubmitted) {
    return (
      <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
        {heading}
        <Card className="grid place-items-center gap-3 px-6 py-14 text-center">
          <CheckCircle2 className="text-success" size={56} strokeWidth={1.5} />
          <h2 className="text-3xl font-bold text-ink lg:text-4xl">
            {tt("Assessment complete", "ประเมินเสร็จสมบูรณ์")}
          </h2>
          <p className="max-w-xl break-words text-sm leading-relaxed text-muted">
            {mode === "self"
              ? tt(
                  "Your self assessment has been recorded and you earned 30 points. Your supervisor will complete their review before the cycle closes.",
                  "บันทึกผลการประเมินตนเองเรียบร้อยแล้ว และคุณได้รับ 30 คะแนน หัวหน้าของคุณจะประเมินให้เสร็จก่อนปิดรอบ",
                )
              : tt(
                  `${subject.name} has been notified that the review is in.`,
                  `ระบบได้แจ้ง ${subject.name} ว่าผลการประเมินถูกส่งแล้ว`,
                )}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {mode === "self" ? (
              <Link href="/idp">
                <Button size="lg">{tt("Build my IDP", "สร้างแผนพัฒนา")}</Button>
              </Link>
            ) : (
              <Link href="/team-profile">
                <Button size="lg">
                  {tt("Open team profile", "เปิดโปรไฟล์ทีม")}
                </Button>
              </Link>
            )}
            <Link href="/assessment">
              <Button size="lg" variant="outline">
                {tt("Back to assessment hub", "กลับไปหน้าการประเมิน")}
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  /* ------------------------------------------------ already submitted */

  if (submittedAt) {
    return (
      <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
        {heading}
        {banner}
        <Card className="mb-6 flex flex-wrap items-center gap-4 border-success/40 bg-success/5 p-5">
          <CheckCircle2 className="shrink-0 text-success" size={22} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">
              {tt(
                `${modeName} assessment submitted`,
                `ส่งแบบประเมิน (${modeName}) แล้ว`,
              )}
            </p>
            <p className="break-words text-xs text-muted">
              {tt("Submitted", "ส่งเมื่อ")} {formatDateTime(submittedAt, lang)} ·{" "}
              {tt(
                "This is the record for the cycle and is read-only.",
                "นี่คือผลของรอบนี้ และไม่สามารถแก้ไขได้",
              )}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setConfirmReopen(true)}
            disabled={pending}
          >
            <RotateCcw size={16} />
            {tt("Re-open for editing", "เปิดแก้ไขอีกครั้ง")}
          </Button>
        </Card>

        {resultStep}

        <Modal
          open={confirmReopen}
          onClose={() => setConfirmReopen(false)}
          title={tt("Re-open this assessment?", "เปิดแบบประเมินนี้อีกครั้ง?")}
          subtitle={pick(lang, cycle.nameEn, cycle.nameTh)}
          footer={
            <>
              <Button variant="outline" onClick={() => setConfirmReopen(false)}>
                {t("action.cancel")}
              </Button>
              <Button onClick={reopen} disabled={pending}>
                {tt("Re-open", "เปิดอีกครั้ง")}
              </Button>
            </>
          }
        >
          <p className="break-words text-sm leading-relaxed text-muted">
            {mode === "self"
              ? tt(
                  "Your answers are kept as the starting point — nothing is erased. The assessment goes back to in progress until you submit it again, and the points you already earned are not paid twice.",
                  "คำตอบเดิมจะถูกเก็บไว้เป็นจุดเริ่มต้น ไม่มีการลบข้อมูล แบบประเมินจะกลับไปเป็นสถานะกำลังดำเนินการจนกว่าคุณจะส่งใหม่ และคะแนนที่ได้รับแล้วจะไม่ถูกให้ซ้ำ",
                )
              : tt(
                  `Your scores are kept as the starting point — nothing is erased. Until you submit again, ${subject.name} will not see this review as their result.`,
                  `คะแนนเดิมจะถูกเก็บไว้เป็นจุดเริ่มต้น ไม่มีการลบข้อมูล และจนกว่าคุณจะส่งใหม่ ${subject.name} จะยังไม่เห็นผลการประเมินนี้`,
                )}
          </p>
        </Modal>
      </div>
    );
  }

  /* -------------------------------------------------------------- wizard */

  const currentKey: StepKey = steps[step] ?? "complete";
  const isComplete = currentKey === "complete";
  const canAdvance = stepComplete[step] ?? false;
  const stepItems = steps.map((k) => ({ key: k, label: t(stepDictKey(k)) }));
  const groupCount = competencies.filter((c) => c.group === currentKey).length;

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      {heading}
      {banner}

      <Stepper steps={stepItems} current={step} onJump={(i) => setStep(i)} />

      <div className="mt-8">
        {currentKey === "kpi" ? (
          <KpiStep
            items={kpis}
            scores={kpiScores}
            onScore={rateKpi}
            onSaveItems={saveKpiItems}
            saving={pending}
          />
        ) : isComplete ? (
          resultStep
        ) : (
          <GroupStep
            mode={mode}
            group={currentKey}
            subjectName={subject.name}
            competencies={competencies}
            scores={scores}
            onChange={rate}
          />
        )}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          size="lg"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ArrowLeft size={18} />
          {t("action.back")}
        </Button>

        {isComplete ? (
          <Button
            size="lg"
            onClick={submit}
            disabled={!allDone || pending}
            title={
              allDone
                ? undefined
                : tt(
                    "Rate every KPI and competency before submitting",
                    "ให้คะแนน KPI และสมรรถนะให้ครบก่อนส่ง",
                  )
            }
          >
            {pending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
            {tt("Submit assessment", "ส่งแบบประเมิน")}
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
            disabled={!canAdvance}
            title={
              canAdvance
                ? undefined
                : tt(
                    "Rate everything on this step first",
                    "ให้คะแนนในขั้นตอนนี้ให้ครบก่อน",
                  )
            }
          >
            {t("action.next")}
            <ArrowRight size={18} />
          </Button>
        )}
      </div>

      {!canAdvance && !isComplete ? (
        <p className="mt-3 break-words text-right text-xs text-muted">
          {currentKey === "kpi"
            ? tt(
                "Score every KPI to continue.",
                "ให้คะแนน KPI ให้ครบทุกข้อเพื่อไปต่อ",
              )
            : tt(
                `Rate all ${groupCount} competencies to continue.`,
                `ให้คะแนนสมรรถนะทั้ง ${groupCount} ข้อเพื่อไปต่อ`,
              )}
        </p>
      ) : null}

      {isComplete && !allDone ? (
        <p className="mt-3 break-words text-right text-xs text-accent">
          {tt(
            "Some steps are still incomplete — go back and finish them before submitting.",
            "ยังมีขั้นตอนที่ทำไม่ครบ กรุณาย้อนกลับไปให้คะแนนให้ครบก่อนส่ง",
          )}
        </p>
      ) : null}

      <p className="mt-6 break-words text-xs leading-relaxed text-muted">
        {tt(
          "Every rating is saved as you make it — you can close this page and pick it up later.",
          "ทุกคะแนนจะถูกบันทึกทันทีที่ให้ คุณสามารถปิดหน้านี้แล้วกลับมาทำต่อได้",
        )}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- group */

function GroupStep({
  mode,
  group,
  subjectName,
  competencies,
  scores,
  onChange,
}: {
  mode: "self" | "supervisor";
  group: CompetencyGroup;
  subjectName: string;
  competencies: CompetencyQuestion[];
  scores: Record<string, number | undefined>;
  onChange: (competencyId: string, rating: number) => void;
}) {
  const { t, tt } = useT();
  const list = competencies.filter((c) => c.group === group);
  const answered = list.filter((c) => scores[c.id]).length;

  const intro =
    mode === "self"
      ? tt("Rate yourself against the description of each level. The expected level for your career role is marked on the scale.",
          "ให้คะแนนตนเองตามคำอธิบายของแต่ละระดับ ระดับที่คาดหวังของบทบาทสายอาชีพของคุณมีเครื่องหมายไว้บนสเกล",
        )
      : tt(`Rate ${subjectName} against the expected level for their career role. This review is the official record.`,
          `ให้คะแนน ${subjectName} เทียบกับระดับที่คาดหวังของบทบาทสายอาชีพ ผลนี้คือผลอย่างเป็นทางการ`,
        );

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-ink">{t(groupDictKey(group))}</h2>
          <p className="mt-0.5 max-w-2xl break-words text-sm leading-relaxed text-muted">
            {intro}
          </p>
        </div>
        <Pill tone={answered === list.length ? "success" : "neutral"}>
          {answered}/{list.length} {tt("rated", "ให้คะแนนแล้ว")}
        </Pill>
      </div>

      <div className="mt-5 space-y-5">
        {list.map((c, i) => (
          <CompetencyRatingCard
            key={c.id}
            index={i + 1}
            competency={c}
            value={scores[c.id]}
            onChange={(r) => onChange(c.id, r)}
          />
        ))}
      </div>
    </>
  );
}
