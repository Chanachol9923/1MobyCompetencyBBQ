"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
  EmptyState,
  Field,
  PageHeading,
  Pill,
  Progress,
  Textarea,
} from "@/components/ui";
import { KindBadge } from "@/components/learning/ChapterContent";
import { pathCompletion } from "@/components/learning/pathProgress";
import type { StepState } from "@/components/learning/pathProgress";
import {
  courseKinds,
  findPath,
  pathNoteKey,
  pathProgressKey,
} from "@/data/learning";
import { useT } from "@/lib/i18n";
import { useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function LearningPathPage() {
  const { state, person, update, notify, addPoints, logActivity, pushNotification } =
    useDemo();
  const { t, tt, lang } = useT();
  const params = useParams<{ pathId: string }>();
  const router = useRouter();

  const pathId = params?.pathId ?? "";
  const path = findPath(pathId);
  const [note, setNote] = useState("");

  if (!path) {
    return (
      <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
        <PageHeading title={t("nav.lms")} />
        <Card>
          <EmptyState
            title={tt("Learning path not found", "ไม่พบเส้นทางการเรียนรู้นี้")}
            hint={tt(
              "Pick a path from the training journey tab.",
              "กรุณาเลือกเส้นทางจากแท็บเส้นทางการฝึกอบรม",
            )}
          />
          <div className="grid place-items-center pb-8">
            <Link href="/lms">
              <Button variant="outline">
                {tt("Back to LMS", "กลับไปหน้าระบบการเรียนรู้")}
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const { steps, done, total, percent, complete } = pathCompletion(state, path);
  const savedNote = person ? state.teamNotes[pathNoteKey(path.id, person.id)] ?? "" : "";

  const title = lang === "th" ? path.titleTh : path.title;
  const description = lang === "th" ? path.descriptionTh : path.description;
  const level = lang === "th" ? path.targetLevelTh : path.targetLevel;
  const audience = lang === "th" ? path.audienceTh : path.audience;
  const project = path.project;

  const submitProject = () => {
    const text = note.trim();
    if (!person || !text) return;
    const issuedAt = new Date().toISOString().slice(0, 10);

    update((s) => {
      const alreadyCertified = s.certificates.some(
        (c) => c.personId === person.id && c.courseId === path.id,
      );
      return {
        ...s,
        courseProgress: {
          ...s.courseProgress,
          [pathProgressKey(path.id)]: 100,
        },
        teamNotes: {
          ...s.teamNotes,
          [pathNoteKey(path.id, person.id)]: text,
        },
        certificates: alreadyCertified
          ? s.certificates
          : [
              ...s.certificates,
              {
                id: `cert-path-${path.id}-${person.id}`,
                personId: person.id,
                courseId: path.id,
                courseTitle: path.title,
                issuedAt,
                score: 100,
              },
            ],
      };
    });

    addPoints(person.id, project.points);
    logActivity("Submitted learning path project", path.title, project.title);
    logActivity("Certificate issued", path.title, "Learning path");
    pushNotification({
      audience: person.id,
      title: `Learning path complete — ${path.title}`,
      body: `Your final project "${project.title}" was submitted. The path certificate is on your Achievements page.`,
      kind: "lms",
      channel: "Both",
      href: "/achievements",
    });
    notify(
      tt(
        `Learning path complete — certificate issued, +${project.points} points`,
        `จบเส้นทางการเรียนรู้แล้ว ระบบออกใบรับรองให้ +${project.points} คะแนน`,
      ),
    );
    setNote("");
  };

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <button
        type="button"
        onClick={() => router.push("/lms")}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand"
      >
        <ArrowLeft size={15} /> {tt("Training journey", "เส้นทางการฝึกอบรม")}
      </button>

      <PageHeading
        title={title}
        subtitle={description}
        right={
          <div className="min-w-[220px]">
            <div className="mb-1 flex items-center justify-between text-xs text-muted">
              <span>
                {done} / {total} {tt("steps complete", "ขั้นตอนที่เสร็จแล้ว")}
              </span>
              <span className="font-bold text-ink">{percent}%</span>
            </div>
            <Progress value={percent} tone={complete ? "success" : "brand"} />
          </div>
        }
      />

      <Card className="mb-8 overflow-hidden">
        <div className={cn("h-2 w-full bg-gradient-to-r", path.cover)} />
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
          <Meta
            label={tt("Target level", "ระดับเป้าหมาย")}
            value={level}
            icon={<Route size={14} />}
          />
          <Meta label={tt("Audience", "กลุ่มเป้าหมาย")} value={audience} />
          <Meta
            label={tt("Structure", "โครงสร้าง")}
            value={tt(
              `${path.courseIds.length} courses + 1 project`,
              `${path.courseIds.length} หลักสูตร + 1 โปรเจกต์`,
            )}
          />
          <div className="ml-auto">
            <Pill tone={complete ? "success" : "brand"}>
              {complete
                ? tt("Path complete", "จบเส้นทางแล้ว")
                : tt("In progress", "กำลังเรียน")}
            </Pill>
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------------ the journey */}
      <ol className="relative space-y-4">
        {steps.map((step, i) => {
          const last = i === steps.length - 1;
          return (
            <li key={step.kind === "course" ? step.course.id : "project"} className="relative flex gap-4">
              {/* rail */}
              <div className="flex w-10 shrink-0 flex-col items-center">
                <StepNode state={step.state} index={i} project={step.kind === "project"} />
                {!last ? (
                  <span
                    className={cn(
                      "mt-1 w-0.5 flex-1 rounded-full",
                      step.state === "complete" ? "bg-success" : "bg-line",
                    )}
                  />
                ) : null}
              </div>

              <div className="min-w-0 flex-1 pb-4">
                {step.kind === "course" ? (
                  <CourseStepCard
                    step={step}
                    lang={lang}
                    tt={tt}
                    onOpen={() => router.push(`/lms/${step.course.id}`)}
                  />
                ) : (
                  <Card className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-accent">
                          <Flag size={12} /> {tt("Final project", "โปรเจกต์สุดท้าย")}
                        </span>
                        <h3 className="mt-1 text-base font-bold text-ink">
                          {lang === "th" ? project.titleTh : project.title}
                        </h3>
                      </div>
                      <StepPill state={step.state} tt={tt} />
                    </div>

                    <p className="mt-2 text-sm font-light text-muted">
                      {lang === "th" ? project.briefTh : project.brief}
                    </p>
                    <p className="mt-2 rounded-lg bg-surface p-3 text-xs text-muted">
                      <span className="font-bold text-ink">
                        {tt("Deliverable", "สิ่งที่ต้องส่งมอบ")}:{" "}
                      </span>
                      {lang === "th" ? project.deliverableTh : project.deliverable}
                    </p>

                    {step.state === "complete" ? (
                      <div className="mt-4 rounded-lg border border-success/40 bg-success/5 p-4">
                        <p className="inline-flex items-center gap-1.5 text-sm font-bold text-success">
                          <Award size={15} />
                          {tt(
                            "Project submitted — path certificate issued",
                            "ส่งโปรเจกต์แล้ว ระบบออกใบรับรองเส้นทางให้แล้ว",
                          )}
                        </p>
                        {savedNote ? (
                          <p className="mt-2 whitespace-pre-wrap text-xs text-muted">
                            {savedNote}
                          </p>
                        ) : null}
                        <Link href="/achievements" className="mt-3 inline-block">
                          <Button variant="outline" size="sm">
                            <Award size={14} /> {tt("View certificate", "ดูใบรับรอง")}
                          </Button>
                        </Link>
                      </div>
                    ) : step.state === "locked" ? (
                      <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted">
                        <Lock size={13} />
                        {tt(
                          "Finish all five courses to unlock the final project.",
                          "เรียนให้จบทั้งห้าหลักสูตรเพื่อปลดล็อกโปรเจกต์สุดท้าย",
                        )}
                      </p>
                    ) : (
                      <div className="mt-4">
                        <Field
                          label={tt("Deliverable note", "บันทึกสิ่งที่ส่งมอบ")}
                          hint={tt(
                            "A few sentences is enough for the demo — it is stored with your submission.",
                            "เขียนสั้น ๆ ไม่กี่ประโยคก็พอสำหรับเวอร์ชันสาธิต ระบบจะเก็บไว้พร้อมการส่งงาน",
                          )}
                        >
                          <Textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder={
                              lang === "th"
                                ? project.deliverableTh
                                : project.deliverable
                            }
                          />
                        </Field>
                        <Button
                          className="mt-3"
                          onClick={submitProject}
                          disabled={!note.trim() || !person}
                        >
                          <Send size={16} />
                          {tt("Submit project", "ส่งโปรเจกต์")}
                        </Button>
                      </div>
                    )}
                  </Card>
                )}
              </div>
            </li>
          );
        })}
      </ol>
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
  lang,
  tt,
  onOpen,
}: {
  step: Extract<ReturnType<typeof pathCompletion>["steps"][number], { kind: "course" }>;
  lang: "en" | "th";
  tt: (en: string, th: string) => string;
  onOpen: () => void;
}) {
  const course = step.course;
  const locked = step.state === "locked";
  return (
    <Card className={cn("p-5", locked && "opacity-70")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[11px] uppercase tracking-wide text-muted">
            {tt("Step", "ขั้นที่")} {step.index + 1} · {course.category}
          </span>
          <h3 className="mt-0.5 text-base font-bold text-ink">
            {lang === "th" ? course.titleTh ?? course.title : course.title}
          </h3>
        </div>
        <StepPill state={step.state} tt={tt} />
      </div>

      <p className="mt-1.5 text-sm font-light text-muted">
        {lang === "th"
          ? course.descriptionTh ?? course.description
          : course.description}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {courseKinds(course).map((k) => (
          <KindBadge key={k} kind={k} />
        ))}
        <span className="text-[11px] text-muted">
          {course.hours} {tt("hours", "ชั่วโมง")} · {course.chapters.length}{" "}
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
        <Button
          size="sm"
          variant={step.state === "complete" ? "outline" : "primary"}
          disabled={locked}
          onClick={onOpen}
        >
          {step.state === "complete"
            ? tt("Review", "ทบทวน")
            : step.progress > 0
              ? tt("Continue", "เรียนต่อ")
              : tt("Start", "เริ่มเรียน")}
          <ArrowRight size={15} />
        </Button>
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
