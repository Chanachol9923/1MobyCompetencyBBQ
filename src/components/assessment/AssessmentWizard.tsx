"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  Send,
} from "lucide-react";
import { Button, Card, PageHeading, Pill } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { useDemo } from "@/lib/store";
import { directReportsOf, findPerson } from "@/data/people";
import { expectedFor, type Group } from "@/data/competencies";
import { CompetencyRatingCard } from "./CompetencyRatingCard";
import { KpiStep } from "./KpiStep";
import { ResultStep } from "./ResultStep";
import { Stepper } from "./Stepper";
import {
  CYCLE,
  MODE_KEY,
  competenciesFor,
  formatDateTime,
  getRecord,
  kpiItemsFor,
  kpiKey,
  managerAnswersFor,
  stepKeyOf,
  stepsFor,
  withRecord,
  type Mode,
  type StepKey,
} from "./lib";

export function AssessmentWizard({
  mode,
  targetId,
}: {
  mode: Mode;
  targetId: string;
}) {
  const { state, person, update, notify, addPoints, logActivity, pushNotification } =
    useDemo();
  const { t, tt, lang } = useT();
  const [step, setStep] = useState(0);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const me = person?.id ?? "";
  const target = useMemo(() => findPerson(targetId), [targetId]);

  const steps: StepKey[] = useMemo(
    () => stepsFor(target.jobRole),
    [target.jobRole],
  );
  const kpiItems = useMemo(
    () => kpiItemsFor(state, target.id),
    [state, target.id],
  );

  const record = person ? getRecord(state, mode, me, target.id) : undefined;
  const answers = record?.answers ?? {};
  const submittedAt = record?.submittedAt ?? null;
  const managerAnswers = useMemo(
    () => managerAnswersFor(state, target),
    [state, target],
  );

  const stepComplete = useMemo(() => {
    const done = (key: StepKey) => {
      if (key === "kpi") return kpiItems.every((i) => answers[kpiKey(i.id)]);
      if (key === "complete") return true;
      return competenciesFor(target.jobRole, key as Group).every(
        (c) => answers[c.id],
      );
    };
    return steps.map(done);
  }, [steps, kpiItems, answers, target.jobRole]);

  const allDone = stepComplete.every(Boolean);

  if (!person) return null;

  /* ------------------------------------------------------------- guards */

  const authorised =
    mode === "self"
      ? target.id === me
      : directReportsOf(me).some((p) => p.id === target.id);

  if (!authorised) {
    return (
      <div className="max-w-[1200px] p-6 lg:p-10">
        <PageHeading title={t("nav.assessment")} />
        <Card className="grid place-items-center gap-3 px-6 py-16 text-center">
          <h2 className="text-xl font-bold text-ink">
            {tt(
              "This assessment is not available to you",
              "คุณไม่มีสิทธิ์เข้าถึงแบบประเมินนี้",
            )}
          </h2>
          <p className="max-w-lg break-words text-sm leading-relaxed text-muted">
            {tt(
              "Supervisor reviews are limited to your direct reports.",
              "การประเมินโดยหัวหน้าทำได้เฉพาะผู้ใต้บังคับบัญชาโดยตรงของคุณเท่านั้น",
            )}
          </p>
          <Link href="/assessment">
            <Button className="mt-2">
              {tt("Back to assessment hub", "กลับไปหน้าการประเมิน")}
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  /* ---------------------------------------------------------- mutations */

  const setAnswer = (key: string, value: number) => {
    update((s) =>
      withRecord(s, mode, me, target.id, (prev) => ({
        ...prev,
        answers: { ...prev.answers, [key]: value },
      })),
    );
  };

  const submit = () => {
    const now = new Date().toISOString();
    update((s) => {
      let next = withRecord(s, mode, me, target.id, (prev) => ({
        ...prev,
        submittedAt: now,
      }));
      if (mode === "supervisor") {
        // the supervisor review is the official record - write the KPI scores back
        const items = (next.kpi[target.id] ?? []).map((i) => ({
          ...i,
          score: answers[kpiKey(i.id)] ?? i.score,
        }));
        next = { ...next, kpi: { ...next.kpi, [target.id]: items } };
      }
      return next;
    });

    if (mode === "self") {
      addPoints(me, 30);
      logActivity("Submitted self assessment", target.name, CYCLE.nameEn);
      notify(
        tt(
          "Self assessment submitted +30 points",
          "ส่งแบบประเมินตนเองแล้ว +30 คะแนน",
        ),
      );
    } else {
      logActivity("Submitted manager review", target.name, CYCLE.nameEn);
      pushNotification({
        audience: target.id,
        title: tt(
          "Your manager submitted your review",
          "หัวหน้าของคุณส่งผลการประเมินแล้ว",
        ),
        body: tt(
          `${person.name} submitted your ${CYCLE.nameEn} supervisor review. Open Assessment to see your result and gap analysis.`,
          `${person.name} ส่งผลการประเมินรอบ ${CYCLE.nameTh} ของคุณแล้ว เปิดหน้าการประเมินเพื่อดูผลและการวิเคราะห์ส่วนต่าง`,
        ),
        kind: "assessment",
        channel: "Both",
        href: "/assessment",
      });
      notify(tt("Supervisor review submitted", "ส่งผลการประเมินโดยหัวหน้าแล้ว"));
    }
    setJustSubmitted(true);
  };

  const startNewCycle = () => {
    update((s) =>
      withRecord(s, mode, me, target.id, () => ({
        answers: {},
        submittedAt: null,
      })),
    );
    logActivity("Started a new assessment cycle", target.name, CYCLE.nameEn);
    setJustSubmitted(false);
    setStep(0);
    notify(tt("New assessment cycle started", "เริ่มรอบการประเมินใหม่แล้ว"));
  };

  /* -------------------------------------------------------------- header */

  const modeName = t(MODE_KEY[mode]);
  const heading = (
    <PageHeading
      title={t("nav.assessment")}
      subtitle={`${modeName} · ${target.name} — ${target.position} (${target.level})`}
      right={
        <div className="flex items-center gap-2">
          <Pill tone="brand">
            {lang === "th" ? CYCLE.nameTh : CYCLE.nameEn}
          </Pill>
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

  /* ------------------------------------------------------------- success */

  if (justSubmitted) {
    return (
      <div className="max-w-[1200px] p-6 lg:p-10">
        {heading}
        <Card className="grid place-items-center gap-3 px-6 py-14 text-center">
          <CheckCircle2 className="text-success" size={56} strokeWidth={1.5} />
          <h2 className="text-3xl font-bold text-ink lg:text-4xl">
            {tt("Assessment complete", "ประเมินเสร็จสมบูรณ์")}
          </h2>
          <p className="max-w-xl break-words text-sm leading-relaxed text-muted">
            {mode === "self"
              ? tt(
                  "Your self assessment has been recorded. Your supervisor will complete their review before the cycle closes.",
                  "บันทึกผลการประเมินตนเองเรียบร้อยแล้ว หัวหน้าของคุณจะประเมินให้เสร็จก่อนปิดรอบ",
                )
              : tt(
                  `${target.name} has been notified that the review is in.`,
                  `ระบบได้แจ้ง ${target.name} ว่าผลการประเมินถูกส่งแล้ว`,
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

  /* ------------------------------------------------------ already submitted */

  if (submittedAt) {
    return (
      <div className="max-w-[1200px] p-6 lg:p-10">
        {heading}
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
              {tt("Submitted", "ส่งเมื่อ")} {formatDateTime(submittedAt, lang)}
            </p>
          </div>
          <Button variant="outline" onClick={startNewCycle}>
            <RotateCcw size={16} />
            {tt("Start a new cycle", "เริ่มรอบใหม่")}
          </Button>
        </Card>

        <ResultStep
          mode={mode}
          target={target}
          answers={answers}
          kpiItems={kpiItems}
          weights={state.weights}
          managerAnswers={managerAnswers}
        />
      </div>
    );
  }

  /* -------------------------------------------------------------- wizard */

  const currentKey = steps[step] ?? "complete";
  const isComplete = currentKey === "complete";
  const canAdvance = stepComplete[step] ?? false;

  const stepItems = steps.map((k) => ({ key: k, label: t(stepKeyOf(k)) }));

  return (
    <div className="max-w-[1200px] p-6 lg:p-10">
      {heading}

      <Stepper steps={stepItems} current={step} onJump={(i) => setStep(i)} />

      <div className="mt-8">
        {currentKey === "kpi" ? (
          <KpiStep
            items={kpiItems}
            answers={answers}
            onChange={(id, score) => setAnswer(kpiKey(id), score)}
          />
        ) : isComplete ? (
          <ResultStep
            mode={mode}
            target={target}
            answers={answers}
            kpiItems={kpiItems}
            weights={state.weights}
            managerAnswers={managerAnswers}
          />
        ) : (
          <GroupStep
            mode={mode}
            group={currentKey as Group}
            jobRole={target.jobRole}
            targetName={target.name}
            answers={answers}
            onChange={setAnswer}
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
            disabled={!allDone}
            title={
              allDone
                ? undefined
                : tt(
                    "Rate every KPI and competency before submitting",
                    "ให้คะแนน KPI และสมรรถนะให้ครบก่อนส่ง",
                  )
            }
          >
            <Send size={18} />
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
                `Rate all ${competenciesFor(target.jobRole, currentKey as Group).length} competencies to continue.`,
                `ให้คะแนนสมรรถนะทั้ง ${competenciesFor(target.jobRole, currentKey as Group).length} ข้อเพื่อไปต่อ`,
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
    </div>
  );
}

/* ---------------------------------------------------------------- group */

function GroupStep({
  mode,
  group,
  jobRole,
  targetName,
  answers,
  onChange,
}: {
  mode: Mode;
  group: Group;
  jobRole: string;
  targetName: string;
  answers: Record<string, number>;
  onChange: (competencyId: string, rating: number) => void;
}) {
  const { t, tt } = useT();
  const list = competenciesFor(jobRole, group);
  const answered = list.filter((c) => answers[c.id]).length;

  const intro =
    mode === "self"
      ? tt(
          "Rate yourself against the description of each level. The expected level for your role is marked on the scale.",
          "ให้คะแนนตนเองตามคำอธิบายของแต่ละระดับ ระดับที่คาดหวังของตำแหน่งคุณถูกทำเครื่องหมายไว้บนสเกล",
        )
      : tt(
          `Rate ${targetName} against the expected level for their job role. This review is the official record.`,
          `ให้คะแนน ${targetName} เทียบกับระดับที่คาดหวังของตำแหน่ง ผลนี้จะเป็นผลอย่างเป็นทางการ`,
        );

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-ink">
            {t(
              group === "core"
                ? "group.core"
                : group === "functional"
                  ? "group.functional"
                  : "group.managerial",
            )}
          </h2>
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
            expected={expectedFor(jobRole, c.id)}
            value={answers[c.id]}
            onChange={(r) => onChange(c.id, r)}
          />
        ))}
      </div>
    </>
  );
}
