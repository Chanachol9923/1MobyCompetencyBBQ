"use client";

import { Milestone } from "lucide-react";
import { Card, CardHeader, Pill } from "@/components/ui";
import { Note, TableWrap, Td, Th } from "@/components/admin/shared";
import { CAREER_LADDER, STAFF } from "@/data/people";
import { useT } from "@/lib/i18n";

/**
 * The 1Moby Careers grade chart from the requirement pack: each career level,
 * the roles that sit on it and the grade codes it spans. Headcount comes from
 * the real 22-person dataset.
 */
export function CareerPathCard() {
  const { t, tt } = useT();

  const headcountFor = (roles: string[]) =>
    STAFF.filter((p) => roles.includes(p.jobRole)).length;

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
          "1Moby Careers — level, roles and grade codes.",
          "เส้นทางอาชีพ 1Moby — ระดับ บทบาท และรหัสเกรด",
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
            {CAREER_LADDER.map((rung) => (
              <tr key={rung.level} className="border-b border-line/60 last:border-0">
                <Td className="whitespace-nowrap font-bold">{rung.level}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {rung.roles.map((r) => (
                      <Pill key={r} tone="brand">
                        {r}
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
                <Td className="text-right font-bold">{headcountFor(rung.roles)}</Td>
              </tr>
            ))}
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
