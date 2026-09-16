"use client";

import Link from "next/link";
import { Button, Card, PageHeading } from "@/components/ui";
import { useT } from "@/lib/i18n";

/**
 * Shown when there is no cycle to write into — a real state of the database
 * rather than an error, so it says what is missing and who fixes it.
 */
export function NoCycleNotice({ showLink = true }: { showLink?: boolean }) {
  const { t, tt } = useT();
  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading title={t("nav.assessment")} />
      <Card className="grid place-items-center gap-3 px-6 py-16 text-center">
        <h2 className="text-xl font-bold text-ink">
          {tt("No assessment cycle is open", "ยังไม่มีรอบการประเมินที่เปิดอยู่")}
        </h2>
        <p className="max-w-lg break-words text-sm leading-relaxed text-muted">
          {tt(
            "There is nothing to assess until an administrator opens a cycle.",
            "ยังไม่มีแบบประเมินให้ทำ จนกว่าผู้ดูแลระบบจะเปิดรอบการประเมิน",
          )}
        </p>
        {showLink ? (
          <Link href="/assessment">
            <Button className="mt-2">
              {tt("Back to assessment hub", "กลับไปหน้าการประเมิน")}
            </Button>
          </Link>
        ) : null}
      </Card>
    </div>
  );
}
