"use client";

import Link from "next/link";
import { Button, Card, EmptyState, PageHeading } from "@/components/ui";
import { useT } from "@/lib/i18n";

export function ShortsEmpty() {
  const { tt } = useT();
  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading title="Shorts" />
      <Card>
        <EmptyState
          title={tt("No shorts yet", "ยังไม่มีคลิปสั้น")}
          hint={tt(
            "Short learning videos appear here once the learning team publishes them.",
            "คลิปการเรียนรู้สั้น ๆ จะแสดงที่นี่เมื่อทีมดูแลการเรียนรู้เผยแพร่",
          )}
        />
        <div className="grid place-items-center pb-8">
          <Link href="/lms">
            <Button variant="outline">{tt("Back to learning", "กลับไปหน้าการเรียนรู้")}</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
