"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Award,
  Crown,
  Lock,
  Medal,
  Route,
  Star,
  Trophy,
  User,
  Zap,
} from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeading,
  Pill,
  Progress,
} from "@/components/ui";
import { Certificate } from "@/components/learning/Certificate";
import { libraryCourses } from "@/components/learning/courseLibrary";
import { pathsCompleted } from "@/components/learning/pathProgress";
import { BADGES, LEARNING_PATHS, findCourse, findPath } from "@/data/learning";
import { PEOPLE, findPerson } from "@/data/people";
import { useT } from "@/lib/i18n";
import { useDemo } from "@/lib/store";
import { cn, formatNumber, initials } from "@/lib/utils";

const BADGE_ICON: Record<string, typeof Trophy> = {
  "code-master": Trophy,
  "speed-demon": Zap,
  "team-player": Award,
  "learning-champion": Star,
  mentor: Medal,
  "innovation-leader": Crown,
  "problem-solver": User,
  architect: Award,
  certified: Award,
  "path-finisher": Route,
  "self-aware": Star,
};

/** how many rows the leaderboard shows before it needs "see all" */
const BOARD_SIZE = 10;

export default function AchievementsPage() {
  const { state, person, notify } = useDemo();
  const { t, tt, lang } = useT();
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [showTeamCerts, setShowTeamCerts] = useState(false);
  const [showFullBoard, setShowFullBoard] = useState(false);

  /* ------------------------------------------------------------- ranking */

  const ranked = useMemo(
    () =>
      PEOPLE.filter((p) => p.id !== "neo")
        .map((p) => ({ person: p, points: state.points[p.id] ?? p.points }))
        .sort((a, b) => b.points - a.points),
    [state.points],
  );

  const podium = ranked.slice(0, 3);
  const board = showFullBoard ? ranked : ranked.slice(0, BOARD_SIZE);
  const myRank = ranked.findIndex((r) => r.person.id === person?.id);
  const myRowOutside = myRank >= board.length;

  /* -------------------------------------------------------- certificates */

  const myCertificates = useMemo(
    () =>
      state.certificates
        .filter((c) => c.personId === person?.id)
        .slice()
        .sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1)),
    [state.certificates, person?.id],
  );

  const certificates = showTeamCerts ? state.certificates : myCertificates;

  /* --------------------------------------------------------------- badges */

  const coursesCompleted = libraryCourses(state).filter(
    (c) => (state.courseProgress[c.id] ?? 0) >= 100,
  ).length;
  const certificatesEarned = myCertificates.length;
  const assessmentsSubmitted =
    person && state.selfAssessment[person.id]?.submittedAt ? 1 : 0;
  const pathsDone = pathsCompleted(state);

  const badges = useMemo(
    () =>
      // badges whose progress comes from live state lead the collection
      [...BADGES]
        .sort((a, b) => Number(Boolean(b.source)) - Number(Boolean(a.source)))
        .map((b) => {
          const live =
            b.source === "courses"
              ? coursesCompleted
              : b.source === "certificates"
                ? certificatesEarned
                : b.source === "assessments"
                  ? assessmentsSubmitted
                  : b.source === "paths"
                    ? pathsDone
                    : null;
          if (live === null || b.target === undefined) {
            return {
              badge: b,
              earned: b.earned,
              current: b.progress?.current,
              target: b.progress?.target,
            };
          }
          return {
            badge: b,
            earned: live >= b.target,
            current: Math.min(live, b.target),
            target: b.target,
          };
        }),
    [coursesCompleted, certificatesEarned, assessmentsSubmitted, pathsDone],
  );

  const earned = badges.filter((b) => b.earned).length;
  const completion = Math.round((earned / Math.max(1, badges.length)) * 100);
  const visibleBadges = showAllBadges ? badges : badges.slice(0, 4);

  /* --------------------------------------------------------------- render */

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading
        title={t("nav.achievements")}
        subtitle={tt(
          "Ranking, certificates and badges across the team",
          "อันดับคะแนน ใบรับรอง และเหรียญตราของทั้งทีม",
        )}
      />

      {/* ----------------------------------------------------------- podium */}
      <div className="mb-10 flex items-end justify-center gap-3 sm:gap-6">
        {[podium[1], podium[0], podium[2]].map((entry, slot) => {
          if (!entry) return null;
          const rank = slot === 1 ? 1 : slot === 0 ? 2 : 3;
          return (
            <PodiumCard
              key={entry.person.id}
              rank={rank}
              name={entry.person.name}
              points={entry.points}
              isYou={entry.person.id === person?.id}
              youLabel={tt("You", "คุณ")}
              ptsLabel={tt("pts", "คะแนน")}
            />
          );
        })}
      </div>

      {/* ------------------------------------------------------ leaderboard */}
      <Card className="mb-10">
        <CardHeader
          title={tt("Leaderboard", "ตารางอันดับ")}
          subtitle={tt(
            `Top ${Math.min(BOARD_SIZE, ranked.length)} of ${ranked.length} employees this quarter`,
            `อันดับ ${Math.min(BOARD_SIZE, ranked.length)} จากพนักงาน ${ranked.length} คนในไตรมาสนี้`,
          )}
          right={
            ranked.length > BOARD_SIZE ? (
              <button
                type="button"
                onClick={() => setShowFullBoard((v) => !v)}
                className="text-sm text-muted transition-colors hover:text-brand"
              >
                {showFullBoard ? tt("Show less", "แสดงน้อยลง") : t("action.seeAll")}
              </button>
            ) : null
          }
        />
        <ul className="space-y-2 px-5 pb-5">
          {board.map((row, i) => (
            <LeaderRow
              key={row.person.id}
              rank={i}
              name={row.person.name}
              points={row.points}
              you={row.person.id === person?.id}
              youLabel={tt("You", "คุณ")}
              pointsLabel={t("label.points")}
            />
          ))}
          {myRowOutside && myRank >= 0 ? (
            <>
              <li className="py-1 text-center text-xs text-line-2">···</li>
              <LeaderRow
                rank={myRank}
                name={ranked[myRank]!.person.name}
                points={ranked[myRank]!.points}
                you
                youLabel={tt("You", "คุณ")}
                pointsLabel={t("label.points")}
              />
            </>
          ) : null}
        </ul>
      </Card>

      {/* ------------------------------------------------------ certificate */}
      <section className="mb-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-ink">
              {tt("Certificate", "ใบรับรอง")}
            </h2>
            <p className="text-xs text-muted">
              {tt(
                `${myCertificates.length} issued to you · ${state.certificates.length} issued across the team`,
                `ออกให้คุณแล้ว ${myCertificates.length} ใบ · ออกทั้งองค์กรแล้ว ${state.certificates.length} ใบ`,
              )}
            </p>
          </div>
          {state.certificates.length > myCertificates.length ? (
            <button
              type="button"
              onClick={() => setShowTeamCerts((v) => !v)}
              className="text-sm text-muted transition-colors hover:text-brand"
            >
              {showTeamCerts
                ? tt("Show mine only", "แสดงเฉพาะของฉัน")
                : tt("Show team certificates", "แสดงใบรับรองของทั้งทีม")}
            </button>
          ) : null}
        </div>

        {certificates.length ? (
          <div className="scroll-thin flex gap-5 overflow-x-auto pb-3">
            {certificates.map((c) => {
              const holder = findPerson(c.personId);
              const course = findCourse(c.courseId);
              const path = findPath(c.courseId);
              const subject =
                lang === "th"
                  ? course?.titleTh ?? path?.titleTh ?? c.courseTitle
                  : course?.title ?? path?.title ?? c.courseTitle;
              return (
                <Certificate
                  key={c.id}
                  recipient={holder.name}
                  subject={subject}
                  score={c.score}
                  kind={
                    path
                      ? tt("Learning path", "เส้นทางการเรียนรู้")
                      : tt("Course completion", "สำเร็จหลักสูตร")
                  }
                  date={c.issuedAt}
                  onDownload={() =>
                    notify(
                      tt(
                        "Certificate download is disabled in the demo",
                        "การดาวน์โหลดใบรับรองถูกปิดไว้ในเวอร์ชันสาธิต",
                      ),
                    )
                  }
                />
              );
            })}
          </div>
        ) : (
          <Card>
            <EmptyState
              title={tt("No certificates yet", "ยังไม่มีใบรับรอง")}
              hint={tt(
                "Certificates are issued automatically when you pass a course post-test or finish a learning path.",
                "ระบบจะออกใบรับรองอัตโนมัติเมื่อคุณผ่านแบบทดสอบหลังเรียน หรือเรียนจบเส้นทางการเรียนรู้",
              )}
            />
            <div className="grid place-items-center pb-8">
              <Link href="/lms">
                <Button variant="outline">
                  {tt("Go to the LMS", "ไปที่ระบบการเรียนรู้")}
                </Button>
              </Link>
            </div>
          </Card>
        )}
      </section>

      {/* ------------------------------------------------------------ badges */}
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-ink">
              {tt("Badge Collection", "คลังเหรียญตรา")}
            </h2>
            <p className="text-xs text-muted">
              {tt(
                `${earned} of ${badges.length} badges earned`,
                `ได้รับแล้ว ${earned} จาก ${badges.length} เหรียญ`,
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">{tt("Completion", "ความคืบหน้า")}</p>
            <p className="text-2xl font-bold text-brand">{completion}%</p>
          </div>
        </div>

        <Card className="p-5">
          <p className="mb-4 text-xs text-muted">
            {tt(
              `Live counters: ${coursesCompleted} courses completed · ${certificatesEarned} certificates · ${assessmentsSubmitted} self assessment submitted · ${pathsDone} of ${LEARNING_PATHS.length} learning paths finished.`,
              `ตัวเลขจริงจากระบบ: เรียนจบ ${coursesCompleted} หลักสูตร · ใบรับรอง ${certificatesEarned} ใบ · ส่งแบบประเมินตนเอง ${assessmentsSubmitted} ครั้ง · จบเส้นทางการเรียนรู้ ${pathsDone} จาก ${LEARNING_PATHS.length} เส้นทาง`,
            )}
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {visibleBadges.map(({ badge: b, earned: isEarned, current, target }) => {
              const Icon = BADGE_ICON[b.id] ?? Award;
              const pct =
                current !== undefined && target
                  ? Math.round((current / target) * 100)
                  : 0;
              return (
                <div key={b.id} className="flex flex-col">
                  <div
                    className={cn(
                      "relative grid h-24 place-items-center rounded-xl bg-gradient-to-br",
                      b.tone,
                      !isEarned && "grayscale",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-12 place-items-center rounded-full",
                        isEarned ? "bg-white/25 text-white" : "bg-white/60 text-line-2",
                      )}
                    >
                      <Icon size={24} />
                    </span>
                    {!isEarned ? (
                      <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-white/80 text-muted">
                        <Lock size={11} />
                      </span>
                    ) : null}
                    {b.source ? (
                      <span className="absolute left-2 top-2 rounded-full bg-white/85 px-1.5 py-0.5 text-[9px] font-bold text-brand">
                        {tt("LIVE", "เรียลไทม์")}
                      </span>
                    ) : null}
                  </div>
                  <p
                    className={cn(
                      "mt-2 text-center text-sm font-bold",
                      isEarned ? "text-ink" : "text-muted",
                    )}
                  >
                    {lang === "th" ? b.nameTh ?? b.name : b.name}
                  </p>
                  <p className="text-center text-xs text-muted">
                    {lang === "th" ? b.requirementTh ?? b.requirement : b.requirement}
                  </p>
                  {!isEarned && current !== undefined && target ? (
                    <div className="mt-2">
                      <div className="mb-1 flex justify-between text-[11px] text-muted">
                        <span>{t("label.progress")}</span>
                        <span>
                          {current}/{target}
                        </span>
                      </div>
                      <Progress value={pct} />
                    </div>
                  ) : isEarned ? (
                    <p className="mt-2 text-center text-[11px] font-medium text-success">
                      {tt("Earned", "ได้รับแล้ว")}
                    </p>
                  ) : (
                    <p className="mt-2 text-center text-[11px] font-medium text-muted">
                      {tt("Not earned yet", "ยังไม่ได้รับ")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => setShowAllBadges((v) => !v)}
              className="text-sm text-muted transition-colors hover:text-brand"
            >
              {showAllBadges ? tt("Show less", "แสดงน้อยลง") : t("action.seeAll")}
            </button>
          </div>
        </Card>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------ leaderboard */

function LeaderRow({
  rank,
  name,
  points,
  you,
  youLabel,
  pointsLabel,
}: {
  rank: number;
  name: string;
  points: number;
  you: boolean;
  youLabel: string;
  pointsLabel: string;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl px-4 py-3",
        you
          ? "border border-amber/50 bg-gradient-to-r from-brand-tint via-white to-amber/20"
          : "bg-surface/60",
      )}
    >
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold",
          rank === 0 && "bg-amber text-white",
          rank === 1 && "bg-line-2 text-white",
          rank === 2 && "bg-[#c98a53] text-white",
          rank > 2 && "bg-white text-muted",
        )}
      >
        {rank === 0 ? <Crown size={14} /> : rank + 1}
      </span>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-line-2/50 text-xs font-bold text-white">
        {initials(name)}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{name}</span>
      {you ? <Pill tone="brand">{youLabel}</Pill> : null}
      <span className="shrink-0 text-right">
        <span className="block text-lg font-bold leading-none text-ink">
          {formatNumber(points)}
        </span>
        <span className="text-[11px] text-muted">{pointsLabel}</span>
      </span>
    </li>
  );
}

/* ------------------------------------------------------------------ podium */

function PodiumCard({
  rank,
  name,
  points,
  isYou,
  youLabel,
  ptsLabel,
}: {
  rank: 1 | 2 | 3;
  name: string;
  points: number;
  isYou: boolean;
  youLabel: string;
  ptsLabel: string;
}) {
  const styles = {
    1: {
      card: "bg-gradient-to-b from-[#fbc25b] to-[#faa21b] h-[190px] sm:h-[210px]",
      badge: "bg-white text-amber border-amber",
      chip: "bg-[#e08d0c] text-white",
      glow: "shadow-[0_0_40px_rgba(250,162,27,.45)]",
    },
    2: {
      card: "bg-gradient-to-b from-[#d9dcdf] to-[#b9bec4] h-[150px] sm:h-[170px]",
      badge: "bg-white text-muted border-line-2",
      chip: "bg-[#9aa0a6] text-white",
      glow: "",
    },
    3: {
      card: "bg-gradient-to-b from-[#d6a071] to-[#b8763f] h-[150px] sm:h-[170px]",
      badge: "bg-white text-[#b8763f] border-[#b8763f]",
      chip: "bg-[#a0642f] text-white",
      glow: "",
    },
  }[rank];

  return (
    <div className="flex w-[110px] flex-col items-center sm:w-[150px]">
      <span
        className={cn(
          "z-10 mb-[-16px] grid size-8 place-items-center rounded-full border-2 text-sm font-bold sm:size-10 sm:text-lg",
          styles.badge,
        )}
      >
        {rank}
      </span>
      <div
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-xl px-3 pb-3 pt-6",
          styles.card,
          styles.glow,
        )}
      >
        <span className="grid size-12 place-items-center rounded-full bg-white/25 sm:size-16">
          <User size={30} className="text-white" fill="currentColor" />
        </span>
        <span className="w-full truncate text-center text-[11px] font-bold text-white sm:text-sm">
          {name}
          {isYou ? ` (${youLabel})` : ""}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium sm:text-xs",
            styles.chip,
          )}
        >
          <Trophy size={11} /> {formatNumber(points)} {ptsLabel}
        </span>
      </div>
    </div>
  );
}
