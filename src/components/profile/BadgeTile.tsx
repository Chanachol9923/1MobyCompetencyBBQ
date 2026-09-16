"use client";

import type { ReactNode } from "react";
import { GraduationCap, HeartHandshake, Trophy, Users, Zap } from "lucide-react";
import { useT } from "@/lib/i18n";
import { pick } from "./gap";

const ICONS: Record<string, ReactNode> = {
  "code-master": <Trophy size={26} />,
  "speed-demon": <Zap size={26} />,
  "team-player": <Users size={26} />,
  "learning-champion": <GraduationCap size={26} />,
  mentor: <HeartHandshake size={26} />,
};

/** A badge row as it comes out of `EmployeeBadge` → `Badge`. */
export type EarnedBadge = {
  key: string;
  nameEn: string;
  nameTh: string | null;
  points: number;
  tone: string | null;
  earnedAt: Date | string;
};

const FALLBACK_TONE = "from-brand to-brand-dark";

export function BadgeTile({ badge }: { badge: EarnedBadge }) {
  const { tt, lang } = useT();
  return (
    <div className="text-center">
      <div
        className={`grid h-28 place-items-center rounded-xl bg-gradient-to-br ${badge.tone ?? FALLBACK_TONE}`}
      >
        <span className="grid size-14 place-items-center rounded-full bg-white/30 text-white">
          {ICONS[badge.key] ?? <Trophy size={26} />}
        </span>
      </div>
      <p className="mt-3 text-sm font-bold text-ink">
        {pick(lang, badge.nameEn, badge.nameTh)}
      </p>
      <p className="text-xs font-light text-muted">
        {tt(`+${badge.points} points`, `+${badge.points} แต้ม`)}
      </p>
    </div>
  );
}
