"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Globe, LifeBuoy } from "lucide-react";
import { Card, EmptyState, PageHeading, Pill } from "@/components/ui";
import { timeAgo } from "@/components/announcements/format";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Gallery, STATUS_TONE } from "./ProblemsAdminScreen";
import { CATEGORY_LABEL, STATUS_LABEL, type MyProblemRow } from "./types";

/** The reports this person sent, and what became of each. */
export function MyProblemsScreen({ problems }: { problems: MyProblemRow[] }) {
  const { tt, lang } = useT();
  const focus = useSearchParams().get("id");
  const target = useRef<HTMLLIElement>(null);

  useEffect(() => {
    target.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focus]);

  return (
    <div className="mx-auto max-w-[900px] p-6 lg:p-10">
      <PageHeading
        title={tt("My problem reports", "รายงานปัญหาของฉัน")}
        subtitle={tt(
          "Everything you reported, and where each one stands. Send a new one with “Report a problem” at the bottom of the menu.",
          "ทุกเรื่องที่คุณแจ้งและสถานะล่าสุด แจ้งเรื่องใหม่ได้ที่ “รายงานปัญหา” ด้านล่างของเมนู",
        )}
      />

      {problems.length ? (
        <ul className="space-y-3">
          {problems.map((p) => (
            <li key={p.id} ref={p.id === focus ? target : undefined}>
              <Card className={cn("overflow-hidden p-5", p.id === focus && "ring-2 ring-brand/40")}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">
                      <span className="mr-1.5 font-mono text-xs font-normal text-muted">#{p.number}</span>
                      {p.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {tt(CATEGORY_LABEL[p.category].en, CATEGORY_LABEL[p.category].th)} · {timeAgo(p.createdAt, lang)}
                      {p.pageUrl ? (
                        <span className="ml-1 inline-flex items-center gap-0.5">
                          · <Globe size={11} /> {p.pageUrl}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <Pill tone={STATUS_TONE[p.status]} className="whitespace-nowrap">
                    {tt(STATUS_LABEL[p.status].en, STATUS_LABEL[p.status].th)}
                  </Pill>
                </div>

                <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm text-muted">{p.description}</p>

                {p.status === "IN_PROGRESS" && p.handlers.length ? (
                  <p className="mt-3 text-xs text-brand">
                    {tt("Being handled by", "กำลังดูแลโดย")} {p.handlers.join(", ")}
                  </p>
                ) : p.status === "OPEN" ? (
                  <p className="mt-3 text-xs text-muted">
                    {tt("Waiting for an admin to pick it up.", "รอผู้ดูแลระบบรับเรื่อง")}
                  </p>
                ) : null}

                {p.status === "FIXED" ? (
                  <div className="mt-4 rounded-xl border border-success/40 bg-success/5 p-4">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-success">
                      <CheckCircle2 size={16} /> {tt("Fixed", "แก้ไขแล้ว")}
                      {p.resolvedBy ? (
                        <span className="font-normal text-muted">
                          · {p.resolvedBy.name}
                          {p.resolvedAt ? ` · ${timeAgo(p.resolvedAt, lang)}` : ""}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{p.resolutionNote}</p>
                    {p.resolutionImages.length ? (
                      <div className="mt-3">
                        <Gallery title={tt("Evidence", "หลักฐาน")} urls={p.resolutionImages} />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {p.attachments.length ? (
                  <div className="mt-4">
                    <Gallery title={tt("Your screenshots", "ภาพหน้าจอที่คุณแนบ")} urls={p.attachments} />
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <div className="grid place-items-center pt-8 text-brand">
            <LifeBuoy size={28} />
          </div>
          <EmptyState
            title={tt("You haven't reported anything", "คุณยังไม่ได้แจ้งปัญหา")}
            hint={tt(
              "If something isn't working, use “Report a problem” at the bottom of the menu.",
              "หากมีอะไรใช้งานไม่ได้ ให้กด “รายงานปัญหา” ด้านล่างของเมนู",
            )}
          />
        </Card>
      )}
    </div>
  );
}
