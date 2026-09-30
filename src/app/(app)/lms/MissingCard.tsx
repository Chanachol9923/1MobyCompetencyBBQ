"use client";

import Link from "next/link";
import { Button, Card, EmptyState, PageHeading } from "@/components/ui";
import { useT } from "@/lib/i18n";

/**
 * What a course or a path id that does not resolve looks like.
 *
 * A server component cannot call `useT()`, so the empty state for a missing row
 * lives here rather than being hard-coded in one language on the page.
 */
export function MissingCard({ kind }: { kind: "course" | "path" }) {
  const { t, tt } = useT();
  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading title={t("nav.lms")} />
      <Card>
        <EmptyState
          title={
            kind === "course"
              ? tt("Course not found", "ไม่พบหลักสูตรนี้")
              : tt("Learning path not found", "ไม่พบเส้นทางการเรียนรู้นี้")
          }
          hint={
            kind === "course"
              ? tt(
                  "It may have been removed from the catalogue.",
                  "หลักสูตรนี้อาจถูกนำออกจากแคตตาล็อกแล้ว",
                )
              : tt(
                  "Pick a path from the training journey tab.",
                  "กรุณาเลือกเส้นทางจากแท็บเส้นทางการฝึกอบรม",
                )
          }
        />
        <div className="grid place-items-center pb-8">
          <Link href="/lms">
            <Button variant="outline">
              {tt("Back to courses", "กลับไปหน้าหลักสูตร")}
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
