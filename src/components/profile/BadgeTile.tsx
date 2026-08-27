"use client";

import type { Badge } from "@/data/learning";
import { GraduationCap, HeartHandshake, Trophy, Users, Zap } from "lucide-react";
import type { ReactNode } from "react";

const ICONS: Record<string, ReactNode> = {
  "code-master": <Trophy size={26} />,
  "speed-demon": <Zap size={26} />,
  "team-player": <Users size={26} />,
  "learning-champion": <GraduationCap size={26} />,
  mentor: <HeartHandshake size={26} />,
};

export function BadgeTile({ badge }: { badge: Badge }) {
  return (
    <div className="text-center">
      <div
        className={`grid h-28 place-items-center rounded-xl bg-gradient-to-br ${badge.tone}`}
      >
        <span className="grid size-14 place-items-center rounded-full bg-white/30 text-white">
          {ICONS[badge.id] ?? <Trophy size={26} />}
        </span>
      </div>
      <p className="mt-3 text-sm font-bold text-ink">{badge.name}</p>
      <p className="text-xs font-light text-muted">{badge.requirement}</p>
    </div>
  );
}
