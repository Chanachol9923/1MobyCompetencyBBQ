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
export function MissingCard({ kind }: { kind: "course" | "path" | "document" }) {
  const { t, tt } = useT();
  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading title={t("nav.lms")} />
      <Card>
        <EmptyState
          title={
            kind === "document"
              ? tt("Document not found", "ไม่พบเอกสารนี้")
              : kind === "course"
              ? tt("Course not found", "ไม่พบหลักสูตรนี้")
              : tt("Learning path not found", "ไม่พบเส้นทางการเรียนรู้นี้")
          }
          hint={
            kind === "document"
              ? tt("It may have been unpublished or removed.", "เอกสารนี้อาจถูกซ่อนหรือลบไปแล้ว")
              : kind === "course"
              ? tt("It may have been removed from the course list.",
                  "หลักสูตรนี้อาจถูกนำออกจากรายการแล้ว",
                )
              : tt(
                  "Pick a path from the training journey tab.",
                  "กรุณาเลือกเส้นทางจากแท็บเส้นทางการฝึกอบรม",
                )
          }
        />
        <div className="grid place-items-center pb-8">
          <Link href={kind === "document" ? "/lms?view=documents" : "/lms"}>
            <Button variant="outline">
              {kind === "document"
                ? tt("Back to documents", "กลับไปหน้าเอกสาร")
                : tt("Back to courses", "กลับไปหน้าหลักสูตร")}
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
