"use client";

import { useState } from "react";
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
import { useT } from "@/lib/i18n";
import { cn, formatNumber, initials } from "@/lib/utils";
import type { AchievementsScreenData, BadgeCard, LeaderRow } from "./types";

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

/**
 * Ranking, certificates and badges — all three from the database.
 *
 * The ranking is `SUM(PointLedger.delta)` per person, the certificates are rows
 * of the `Certificate` table scoped to what this viewer may see, and a badge is
 * "earned" either because somebody granted it or because the live counter its
 * `source` names has reached its `target`. Nothing here carries a cached flag.
 */
export function AchievementsScreen({ data }: { data: AchievementsScreenData }) {
  const { t, tt, lang } = useT();
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [showTeamCerts, setShowTeamCerts] = useState(false);
  const [showFullBoard, setShowFullBoard] = useState(false);

  const {
    board,
    viewerRow,
    certificates,
    myCertificateCount,
    visibleCertificateCount,
    canSeeTeamCertificates,
    badges,
    counters,
  } = data;

  const podium = board.slice(0, 3);
  const visibleBoard = showFullBoard ? board : board.slice(0, BOARD_SIZE);
  const viewerOutsideBoard =
    viewerRow !== null && !visibleBoard.some((r) => r.isViewer);

  const shownCertificates = showTeamCerts
    ? certificates
    : certificates.filter((c) => c.isMine);

  const earned = badges.filter((b) => b.earned).length;
  const completion = Math.round((earned / Math.max(1, badges.length)) * 100);
  const visibleBadges = showAllBadges ? badges : badges.slice(0, 4);

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
      {podium.length ? (
        <div className="mb-10 flex items-end justify-center gap-3 sm:gap-6">
          {[podium[1], podium[0], podium[2]].map((entry, slot) => {
            if (!entry) return null;
            const rank = slot === 1 ? 1 : slot === 0 ? 2 : 3;
            return (
              <PodiumCard
                key={entry.employeeId}
                rank={rank as 1 | 2 | 3}
                name={entry.name}
                points={entry.points}
                isYou={entry.isViewer}
                youLabel={tt("You", "คุณ")}
                ptsLabel={tt("pts", "คะแนน")}
              />
            );
          })}
        </div>
      ) : null}

      {/* ------------------------------------------------------ leaderboard */}
      <Card className="mb-10">
        <CardHeader
          title={tt("Leaderboard", "ตารางอันดับ")}
          subtitle={tt(
            `Top ${Math.min(BOARD_SIZE, board.length)} of ${board.length} employees, by points balance`,
            `อันดับ ${Math.min(BOARD_SIZE, board.length)} จากพนักงาน ${board.length} คน จัดตามยอดคะแนนคงเหลือ`,
          )}
          right={
            board.length > BOARD_SIZE ? (
              <button
                type="button"
                onClick={() => setShowFullBoard((v) => !v)}
                className="text-sm text-muted transition-colors hover:text-brand max-lg:min-h-11"
              >
                {showFullBoard ? tt("Show less", "แสดงน้อยลง") : t("action.seeAll")}
              </button>
            ) : null
          }
        />
        <ul className="space-y-2 px-5 pb-5">
          {visibleBoard.map((row) => (
            <LeaderRowItem
              key={row.employeeId}
              row={row}
              youLabel={tt("You", "คุณ")}
              pointsLabel={t("label.points")}
            />
          ))}
          {viewerOutsideBoard && viewerRow ? (
            <>
              <li className="py-1 text-center text-xs text-line-2">···</li>
              <LeaderRowItem
                row={viewerRow}
                youLabel={tt("You", "คุณ")}
                pointsLabel={t("label.points")}
              />
            </>
          ) : null}
          {board.length === 0 ? (
            <li className="py-8 text-center text-sm text-muted">
              {tt("Nobody has earned points yet.", "ยังไม่มีใครได้รับคะแนน")}
            </li>
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
              {canSeeTeamCertificates
                ? tt(
                    `${myCertificateCount} issued to you · ${visibleCertificateCount} across you and your direct reports`,
                    `ออกให้คุณแล้ว ${myCertificateCount} ใบ · รวมทีมของคุณ ${visibleCertificateCount} ใบ`,
                  )
                : tt(
                    `${myCertificateCount} issued to you`,
                    `ออกให้คุณแล้ว ${myCertificateCount} ใบ`,
                  )}
            </p>
          </div>
          {canSeeTeamCertificates ? (
            <button
              type="button"
              onClick={() => setShowTeamCerts((v) => !v)}
              className="text-sm text-muted transition-colors hover:text-brand max-lg:min-h-11"
            >
              {showTeamCerts
                ? tt("Show mine only", "แสดงเฉพาะของฉัน")
                : tt("Show my team's certificates", "แสดงใบรับรองของทีม")}
            </button>
          ) : null}
        </div>

        {shownCertificates.length ? (
          <div className="scroll-thin flex gap-5 overflow-x-auto pb-3">
            {shownCertificates.map((c) => (
              <Certificate
                key={c.id}
                recipient={c.holderName}
                subject={lang === "th" ? (c.titleTh ?? c.titleEn) : c.titleEn}
                score={c.score ?? undefined}
                kind={
                  c.kind === "PATH"
                    ? tt("Learning path", "เส้นทางการเรียนรู้")
                    : tt("Course completion", "สำเร็จหลักสูตร")
                }
                date={c.issuedAt.slice(0, 10)}
                onDownload={() => window.print()}
              />
            ))}
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
              {tt("Badge collection", "คลังเหรียญตรา")}
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
            {tt(`Your progress: ${counters.coursesCompleted} courses completed · ${counters.certificatesEarned} certificates · ${counters.assessmentsSubmitted} self-assessments submitted · ${counters.pathsFinished} of ${counters.pathsAvailable} learning paths finished.`,
              `ความคืบหน้าของคุณ: เรียนจบ ${counters.coursesCompleted} หลักสูตร · ใบรับรอง ${counters.certificatesEarned} ใบ · ส่งแบบประเมินตนเอง ${counters.assessmentsSubmitted} ครั้ง · จบเส้นทางการเรียนรู้ ${counters.pathsFinished} จาก ${counters.pathsAvailable} เส้นทาง`,
            )}
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {visibleBadges.map((b) => (
              <BadgeTile key={b.id} badge={b} />
            ))}
          </div>

          {badges.length > 4 ? (
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAllBadges((v) => !v)}
                className="text-sm text-muted transition-colors hover:text-brand max-lg:min-h-11"
              >
                {showAllBadges ? tt("Show less", "แสดงน้อยลง") : t("action.seeAll")}
              </button>
            </div>
          ) : null}
        </Card>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- badges */

function BadgeTile({ badge: b }: { badge: BadgeCard }) {
  const { t, tt, lang } = useT();
  const Icon = BADGE_ICON[b.key] ?? Award;
  const showProgress = !b.earned && b.current !== null && b.target !== null;
  const pct = showProgress ? Math.round((b.current! / b.target!) * 100) : 0;

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          "relative grid h-24 place-items-center rounded-xl bg-gradient-to-br",
          b.tone ?? "from-[#e6e6e6] to-[#f2f2f2]",
          !b.earned && "grayscale",
        )}
      >
        <span
          className={cn(
            "grid size-12 place-items-center rounded-full",
            b.earned ? "bg-white/25 text-white" : "bg-white/60 text-line-2",
          )}
        >
          <Icon size={24} />
        </span>
        {!b.earned ? (
          <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-white/80 text-muted">
            <Lock size={11} />
          </span>
        ) : null}
        {b.source !== "manual" ? (
          <span className="absolute left-2 top-2 rounded-full bg-white/85 px-1.5 py-0.5 text-[9px] font-bold text-brand">
            {tt("Live", "ล่าสุด")}
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-2 text-center text-sm font-bold",
          b.earned ? "text-ink" : "text-muted",
        )}
      >
        {lang === "th" ? (b.nameTh ?? b.nameEn) : b.nameEn}
      </p>
      <p className="text-center text-xs text-muted">
        {(lang === "th" ? (b.requirementTh ?? b.requirementEn) : b.requirementEn) ?? ""}
      </p>
      {showProgress ? (
        <div className="mt-2">
          <div className="mb-1 flex justify-between text-[11px] text-muted">
            <span>{t("label.progress")}</span>
            <span>
              {b.current}/{b.target}
            </span>
          </div>
          <Progress value={pct} />
        </div>
      ) : b.earned ? (
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
}

/* ------------------------------------------------------------ leaderboard */

function LeaderRowItem({
  row,
  youLabel,
  pointsLabel,
}: {
  row: LeaderRow;
  youLabel: string;
  pointsLabel: string;
}) {
  const place = row.rank - 1;
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl px-4 py-3",
        row.isViewer
          ? "border border-amber/50 bg-gradient-to-r from-brand-tint via-white to-amber/20"
          : "bg-surface/60",
      )}
    >
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold",
          place === 0 && "bg-amber text-white",
          place === 1 && "bg-line-2 text-white",
          place === 2 && "bg-[#c98a53] text-white",
          place > 2 && "bg-white text-muted",
        )}
      >
        {place === 0 ? <Crown size={14} /> : row.rank}
      </span>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-line-2/50 text-xs font-bold text-white">
        {initials(row.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-ink">{row.name}</span>
        {row.position ? (
          <span className="block truncate text-[10px] text-muted">{row.position}</span>
        ) : null}
      </span>
      {row.isViewer ? <Pill tone="brand">{youLabel}</Pill> : null}
      <span className="shrink-0 text-right">
        <span className="block text-lg font-bold leading-none text-ink">
          {formatNumber(row.points)}
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
