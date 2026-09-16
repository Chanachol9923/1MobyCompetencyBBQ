"use client";

import { useMemo } from "react";
import { Milestone } from "lucide-react";
import { Card, CardHeader, Pill } from "@/components/ui";
import { Note, TableWrap, Td, Th } from "@/components/admin/shared";
import type { JobRoleRow } from "@/components/admin/content-types";
import { useT } from "@/lib/i18n";

/**
 * The 1Moby career ladder, folded out of the real `JobRole` rows: each level,
 * the roles that sit on it, the grade codes they span and how many people are
 * actually on that rung right now.
 */
export function CareerPathCard({ jobRoles }: { jobRoles: JobRoleRow[] }) {
  const { t, tt } = useT();

  const ladder = useMemo(() => {
    const byLevel = new Map<string, JobRoleRow[]>();
    for (const role of jobRoles) {
      byLevel.set(role.level, [...(byLevel.get(role.level) ?? []), role]);
    }
    return [...byLevel.entries()]
      .map(([level, roles]) => ({
        level,
        roles,
        rank: Math.min(...roles.map((r) => r.levelRank)),
        grades: [...new Set(roles.flatMap((r) => [r.gradeFrom, r.gradeTo]))].filter(
          (g) => g && g !== "—",
        ),
        headcount: roles.reduce((a, r) => a + r.employeeCount, 0),
      }))
      .sort((a, b) => a.rank - b.rank);
  }, [jobRoles]);

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Milestone size={18} className="text-brand" />
            {t("label.careerPath")}
          </span>
        }
        subtitle={tt(
          "1Moby Careers — level, roles and grade codes, with live headcount.",
          "เส้นทางอาชีพ 1Moby — ระดับ บทบาท และรหัสเกรด พร้อมจำนวนพนักงานจริง",
        )}
      />
      <TableWrap>
        <table className="w-full min-w-[620px] border-collapse">
          <thead>
            <tr className="border-y border-line/70 bg-surface/60">
              <Th className="w-56">{t("label.level")}</Th>
              <Th>{t("label.role")}</Th>
              <Th className="w-40">{t("label.grade")}</Th>
              <Th className="w-32 text-right">{t("label.headcount")}</Th>
            </tr>
          </thead>
          <tbody>
            {ladder.map((rung) => (
              <tr key={rung.level} className="border-b border-line/60 last:border-0">
                <Td className="whitespace-nowrap font-bold">{rung.level}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {rung.roles.map((r) => (
                      <Pill key={r.id} tone="brand">
                        {r.name}
                      </Pill>
                    ))}
                  </div>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {rung.grades.map((g) => (
                      <Pill key={g}>{g}</Pill>
                    ))}
                  </div>
                </Td>
                <Td className="text-right font-bold">{rung.headcount}</Td>
              </tr>
            ))}
            {ladder.length === 0 ? (
              <tr>
                <Td colSpan={4} className="py-8 text-center text-muted">
                  {tt("No career roles yet.", "ยังไม่มีบทบาทสายอาชีพ")}
                </Td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </TableWrap>
      <div className="p-5 pt-4">
        <Note>
          {tt(
            "A promotion moves the employee up one rung, which switches the expected-level column applied to their competency assessment.",
            "การเลื่อนระดับจะทำให้พนักงานขยับขึ้นหนึ่งขั้น และเปลี่ยนคอลัมน์ระดับที่คาดหวังที่ใช้ประเมินสมรรถนะของเขา",
          )}
        </Note>
      </div>
    </Card>
  );
}
