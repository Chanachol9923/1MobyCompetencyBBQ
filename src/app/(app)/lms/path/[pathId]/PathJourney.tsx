"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  Flag,
  Lock,
  Route,
  Send,
} from "lucide-react";
import {
  Button,
  Card,
  Field,
  PageHeading,
  Pill,
  Progress,
  Textarea,
} from "@/components/ui";
import { KindBadge } from "@/components/learning/ChapterContent";
import {
  FALLBACK_COVER,
  categoryDictKey,
  pick,
  type Lang,
} from "@/components/learning/model";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { PathStepView, PathView, StepState } from "@/server/learning";
import { submitPathProjectAction, type LmsError } from "../../actions";

/**
 * A learning path: the course steps, then the final project.
 *
 * A step unlocks on real completion — the server recomputes it from this
 * person's chapter rows on every read, and `submitPathProjectAction` re-checks
 * the same rule before it writes, so a client that guesses the endpoint cannot
 * skip to the project.
 */
export function PathJourney({ path }: { path: PathView }) {
  const { t, tt, lang } = useT();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<LmsError | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const title = pick(lang, path.titleEn, path.titleTh);
  const description = path.descriptionEn
    ? pick(lang, path.descriptionEn, path.descriptionTh)
    : null;
  const projectTitle = path.projectTitleEn
    ? pick(lang, path.projectTitleEn, path.projectTitleTh)
    : tt("Final project", "โปรเจกต์สุดท้าย");
  const projectBrief = path.projectBriefEn
    ? pick(lang, path.projectBriefEn, path.projectBriefTh)
    : null;
  const projectDeliverable = path.projectDeliverableEn
    ? pick(lang, path.projectDeliverableEn, path.projectDeliverableTh)
    : null;

  const errorText = (code: LmsError) =>
    ({
      not_authorised: tt(
        "Sign in again to submit your project.",
        "กรุณาเข้าสู่ระบบอีกครั้งเพื่อส่งโปรเจกต์",
      ),
      invalid: tt(
        "Write at least a sentence about what you delivered.",
        "กรุณาเขียนอย่างน้อยหนึ่งประโยคอธิบายสิ่งที่คุณส่งมอบ",
      ),
      not_found: tt(
        "This learning path is no longer published.",
        "เส้นทางการเรียนรู้นี้ไม่ได้เผยแพร่แล้ว",
      ),
      not_complete: tt(
        "Finish every course in the path before submitting the project.",
        "กรุณาเรียนให้จบทุกหลักสูตรในเส้นทางก่อนส่งโปรเจกต์",
      ),
    })[code];

  const submitProject = () => {
    setError(null);
    startTransition(async () => {
      const result = await submitPathProjectAction({
        slug: path.slug,
        deliverable: note,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNote("");
      setMessage(
        tt(
          `Learning path complete — certificate ${result.data.certificateCode} issued${result.data.pointsAwarded ? `, +${result.data.pointsAwarded} points` : ""}`,
          `จบเส้นทางการเรียนรู้แล้ว ระบบออกใบรับรองเลขที่ ${result.data.certificateCode}${result.data.pointsAwarded ? ` +${result.data.pointsAwarded} คะแนน` : ""}`,
        ),
      );
      router.refresh();
    });
  };

  const steps = path.steps;
  const lastIndex = steps.length; // the project sits after every course step

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <Link
        href="/lms?view=journey"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand"
      >
        <ArrowLeft size={15} /> {tt("Training journey", "เส้นทางการฝึกอบรม")}
      </Link>

      <PageHeading
        title={title}
        subtitle={description ?? undefined}
        right={
          <div className="min-w-[220px]">
            <div className="mb-1 flex items-center justify-between text-xs text-muted">
              <span>
                {path.done} / {path.total}{" "}
                {tt("steps complete", "ขั้นตอนที่เสร็จแล้ว")}
              </span>
              <span className="font-bold text-ink">{path.percent}%</span>
            </div>
            <Progress
              value={path.percent}
              tone={path.complete ? "success" : "brand"}
            />
          </div>
        }
      />

      {error ? (
        <p className="mb-4 rounded-lg border border-accent/40 bg-accent/5 px-4 py-2.5 text-sm text-accent">
          {errorText(error)}
        </p>
      ) : message ? (
        <p className="mb-4 rounded-lg border border-brand/30 bg-brand-tint px-4 py-2.5 text-sm text-brand">
          {message}
        </p>
      ) : null}

      <Card className="mb-8 overflow-hidden">
        <div
          className={cn(
            "h-2 w-full bg-gradient-to-r",
            path.cover ?? FALLBACK_COVER,
          )}
        />
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
          {path.targetLevel ? (
            <Meta
              label={tt("Target level", "ระดับเป้าหมาย")}
              value={path.targetLevel}
              icon={<Route size={14} />}
            />
          ) : null}
          {path.audience ? (
            <Meta
              label={tt("Audience", "กลุ่มเป้าหมาย")}
              value={path.audience}
            />
          ) : null}
          <Meta
            label={tt("Structure", "โครงสร้าง")}
            value={tt(
              `${steps.length} courses + 1 project`,
              `${steps.length} หลักสูตร + 1 โปรเจกต์`,
            )}
          />
          <div className="ml-auto">
            <Pill tone={path.complete ? "success" : "brand"}>
              {path.complete
                ? tt("Path complete", "จบเส้นทางแล้ว")
                : tt("In progress", "กำลังเรียน")}
            </Pill>
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------------ the journey */}
      <ol className="relative space-y-4">
        {steps.map((step, i) => (
          <li key={step.courseId} className="relative flex gap-4">
            <div className="flex w-10 shrink-0 flex-col items-center">
              <StepNode state={step.state} index={i} project={false} />
              <span
                className={cn(
                  "mt-1 w-0.5 flex-1 rounded-full",
                  step.state === "complete" ? "bg-success" : "bg-line",
                )}
              />
            </div>
            <div className="min-w-0 flex-1 pb-4">
              <CourseStepCard step={step} index={i} lang={lang} />
            </div>
          </li>
        ))}

        <li className="relative flex gap-4">
          <div className="flex w-10 shrink-0 flex-col items-center">
            <StepNode state={path.projectState} index={lastIndex} project />
          </div>
          <div className="min-w-0 flex-1 pb-4">
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-accent">
                    <Flag size={12} /> {tt("Final project", "โปรเจกต์สุดท้าย")}
                  </span>
                  <h3 className="mt-1 text-base font-bold text-ink">
                    {projectTitle}
                  </h3>
                </div>
                <StepPill state={path.projectState} tt={tt} />
              </div>

              {projectBrief ? (
                <p className="mt-2 text-sm font-light text-muted">
                  {projectBrief}
                </p>
              ) : null}
              {projectDeliverable ? (
                <p className="mt-2 rounded-lg bg-surface p-3 text-xs text-muted">
                  <span className="font-bold text-ink">
                    {tt("Deliverable", "สิ่งที่ต้องส่งมอบ")}:{" "}
                  </span>
                  {projectDeliverable}
                </p>
              ) : null}

              {path.projectState === "complete" ? (
                <div className="mt-4 rounded-lg border border-success/40 bg-success/5 p-4">
                  <p className="inline-flex items-center gap-1.5 text-sm font-bold text-success">
                    <Award size={15} />
                    {path.certificate
                      ? tt(
                          `Project submitted — certificate ${path.certificate.code} issued`,
                          `ส่งโปรเจกต์แล้ว ระบบออกใบรับรองเลขที่ ${path.certificate.code}`,
                        )
                      : tt(
                          "Project submitted",
                          "ส่งโปรเจกต์แล้ว",
                        )}
                  </p>
                  {path.deliverable ? (
                    <p className="mt-2 whitespace-pre-wrap text-xs text-muted">
                      {path.deliverable}
                    </p>
                  ) : null}
                  <Link href="/achievements" className="mt-3 inline-block">
                    <Button variant="outline" size="sm">
                      <Award size={14} />{" "}
                      {tt("View certificate", "ดูใบรับรอง")}
                    </Button>
                  </Link>
                </div>
              ) : path.projectState === "locked" ? (
                <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted">
                  <Lock size={13} />
                  {tt(
                    `Finish all ${steps.length} courses to unlock the final project.`,
                    `เรียนให้จบทั้ง ${steps.length} หลักสูตรเพื่อปลดล็อกโปรเจกต์สุดท้าย`,
                  )}
                </p>
              ) : (
                <div className="mt-4">
                  <Field
                    label={tt("Deliverable note", "บันทึกสิ่งที่ส่งมอบ")}
                    hint={tt(
                      "A few sentences is enough — it is saved with your submission.",
                      "เขียนสั้น ๆ ไม่กี่ประโยคก็พอ ระบบจะบันทึกไว้พร้อมการส่งงาน",
                    )}
                  >
                    <Textarea
                      value={note}
                      onChange={(e) => {
                        setNote(e.target.value);
                        setError(null);
                      }}
                      placeholder={projectDeliverable ?? undefined}
                    />
                  </Field>
                  <Button
                    className="mt-3"
                    onClick={submitProject}
                    disabled={note.trim().length < 10 || pending}
                  >
                    <Send size={16} />
                    {tt("Submit project", "ส่งโปรเจกต์")}
                  </Button>
                </div>
              )}
            </Card>
          </div>
        </li>
      </ol>

      <p className="mt-6 text-xs text-muted">
        {tt(
          `Completing the project awards ${path.projectPoints} points and a path certificate.`,
          `เมื่อส่งโปรเจกต์สำเร็จ จะได้รับ ${path.projectPoints} คะแนน พร้อมใบรับรองเส้นทางการเรียนรู้`,
        )}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ parts */

function Meta({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="inline-flex items-center gap-1.5 text-sm font-bold text-ink">
        {icon}
        {value}
      </p>
    </div>
  );
}

function StepNode({
  state,
  index,
  project,
}: {
  state: StepState;
  index: number;
  project: boolean;
}) {
  return (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full border-2 text-sm font-bold",
        state === "complete" && "border-success bg-success text-white",
        state === "in-progress" && "border-amber bg-amber text-white",
        state === "available" && "border-brand bg-white text-brand",
        state === "locked" && "border-line bg-surface text-line-2",
      )}
    >
      {state === "complete" ? (
        <Check size={18} />
      ) : state === "locked" ? (
        <Lock size={15} />
      ) : project ? (
        <Flag size={16} />
      ) : (
        index + 1
      )}
    </span>
  );
}

function StepPill({
  state,
  tt,
}: {
  state: StepState;
  tt: (en: string, th: string) => string;
}) {
  if (state === "complete")
    return <Pill tone="success">{tt("Complete", "เสร็จสิ้น")}</Pill>;
  if (state === "in-progress")
    return <Pill tone="warn">{tt("In progress", "กำลังเรียน")}</Pill>;
  if (state === "locked")
    return <Pill tone="neutral">{tt("Locked", "ยังไม่ปลดล็อก")}</Pill>;
  return <Pill tone="brand">{tt("Ready to start", "พร้อมเริ่ม")}</Pill>;
}

function CourseStepCard({
  step,
  index,
  lang,
}: {
  step: PathStepView;
  index: number;
  lang: Lang;
}) {
  const { t, tt } = useT();
  const locked = step.state === "locked";
  const title = pick(lang, step.titleEn, step.titleTh);
  const description = step.descriptionEn
    ? pick(lang, step.descriptionEn, step.descriptionTh)
    : null;

  return (
    <Card className={cn("p-5", locked && "opacity-70")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[11px] uppercase tracking-wide text-muted">
            {tt("Step", "ขั้นที่")} {index + 1} ·{" "}
            {t(categoryDictKey(step.category))}
          </span>
          <h3 className="mt-0.5 text-base font-bold text-ink">{title}</h3>
        </div>
        <StepPill state={step.state} tt={tt} />
      </div>

      {description ? (
        <p className="mt-1.5 text-sm font-light text-muted">{description}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {step.kinds.map((k) => (
          <KindBadge key={k} kind={k} />
        ))}
        <span className="text-[11px] text-muted">
          {step.hours} {tt("hours", "ชั่วโมง")} · {step.chapterCount}{" "}
          {tt("chapters", "บท")}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="min-w-[160px] flex-1">
          <Progress
            value={step.progress}
            tone={step.progress >= 100 ? "success" : "brand"}
            showLabel
          />
        </div>
        {locked ? (
          <Button size="sm" variant="primary" disabled>
            {tt("Start", "เริ่มเรียน")}
            <ArrowRight size={15} />
          </Button>
        ) : (
          <Link href={`/lms/${step.slug}`}>
            <Button
              size="sm"
              variant={step.state === "complete" ? "outline" : "primary"}
            >
              {step.state === "complete"
                ? tt("Review", "ทบทวน")
                : step.progress > 0
                  ? t("action.continue")
                  : tt("Start", "เริ่มเรียน")}
              <ArrowRight size={15} />
            </Button>
          </Link>
        )}
      </div>

      {locked ? (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted">
          <Lock size={13} />
          {tt(
            "Complete the previous step to unlock this course.",
            "เรียนขั้นก่อนหน้าให้จบเพื่อปลดล็อกหลักสูตรนี้",
          )}
        </p>
      ) : null}
    </Card>
  );
}
