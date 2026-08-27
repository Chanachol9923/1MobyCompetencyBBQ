"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, Card, PageHeading } from "@/components/ui";
import { AssessmentWizard } from "@/components/assessment/AssessmentWizard";
import { isMode } from "@/components/assessment/lib";
import { PEOPLE } from "@/data/people";
import { useT } from "@/lib/i18n";

export default function AssessmentRunPage() {
  const params = useParams<{ mode: string; target: string }>();
  const { t, tt } = useT();

  const mode = Array.isArray(params?.mode) ? params.mode[0] : params?.mode;
  const target = Array.isArray(params?.target) ? params.target[0] : params?.target;
  const known = Boolean(target && PEOPLE.some((p) => p.id === target));

  if (!mode || !target || !isMode(mode) || !known) {
    return (
      <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
        <PageHeading title={t("nav.assessment")} />
        <Card className="grid place-items-center gap-3 px-6 py-16 text-center">
          <h2 className="text-xl font-bold text-ink">
            {tt("Assessment not found", "ไม่พบแบบประเมินนี้")}
          </h2>
          <p className="max-w-lg break-words text-sm leading-relaxed text-muted">
            {tt(
              "That assessment link is not valid. Pick a self or supervisor assessment from the hub.",
              "ลิงก์แบบประเมินนี้ไม่ถูกต้อง กรุณาเลือกแบบประเมินตนเอง หรือแบบประเมินโดยหัวหน้า จากหน้าการประเมิน",
            )}
          </p>
          <Link href="/assessment">
            <Button className="mt-2">
              {tt("Back to assessment hub", "กลับไปหน้าการประเมิน")}
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return <AssessmentWizard mode={mode} targetId={target} />;
}
