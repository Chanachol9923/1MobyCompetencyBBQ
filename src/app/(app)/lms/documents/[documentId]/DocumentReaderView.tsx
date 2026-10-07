"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, Sparkles } from "lucide-react";
import { Card, Pill, Progress } from "@/components/ui";
import { PdfReader } from "@/components/learning/PdfReader";
import { LMS_POINTS, pick } from "@/components/learning/model";
import { formatBytes, type DocumentCard } from "@/components/learning/media-types";
import { saveDocumentPage } from "@/server/learning-media";
import { useT } from "@/lib/i18n";
import { useUi } from "@/lib/ui-state";

/**
 * Reading a document. The page is saved a moment after you stop turning, so
 * coming back opens where you left off; reaching the last page finishes the
 * document and pays its points once.
 */
export function DocumentReaderView({ doc }: { doc: DocumentCard }) {
  const { tt, lang } = useT();
  const { notify } = useUi();
  const [page, setPage] = useState(doc.lastPage);
  const [pages, setPages] = useState(doc.pages);
  const [completed, setCompleted] = useState(doc.completed);
  const saved = useRef(doc.lastPage);
  const timer = useRef<number | null>(null);

  const title = pick(lang, doc.titleEn, doc.titleTh);
  const description = doc.descriptionEn ? pick(lang, doc.descriptionEn, doc.descriptionTh) : null;

  const save = (to: number, total: number) => {
    if (timer.current) window.clearTimeout(timer.current);
    const last = to >= total;
    // the last page is saved straight away; anything else waits for a pause
    timer.current = window.setTimeout(
      async () => {
        if (to === saved.current && !last) return;
        saved.current = to;
        try {
          const res = await saveDocumentPage({ documentId: doc.id, page: to });
          if (res.completed && !completed) {
            setCompleted(true);
            notify(
              res.points
                ? tt(`Document finished · +${res.points} points`, `อ่านเอกสารจบแล้ว · +${res.points} คะแนน`)
                : tt("Document finished", "อ่านเอกสารจบแล้ว"),
            );
          }
        } catch {
          /* progress is a convenience; reading goes on */
        }
      },
      last ? 0 : 900,
    );
  };

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const percent = completed ? 100 : Math.round((page / Math.max(1, pages)) * 100);

  return (
    <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-10">
      <Link
        href="/lms?view=documents"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand"
      >
        <ArrowLeft size={15} /> {tt("All documents", "เอกสารทั้งหมด")}
      </Link>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <h1 className="mb-3 text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h1>
          <PdfReader
            url={doc.fileUrl}
            initialPage={doc.lastPage}
            title={title}
            onPageCount={setPages}
            onPage={(p, total) => {
              setPage(p);
              save(p, total);
            }}
          />
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-lg bg-brand-tint text-brand">
                <FileText size={18} />
              </span>
              <div className="min-w-0 text-xs text-muted">
                <p>
                  {pages} {tt("pages", "หน้า")} · {formatBytes(doc.fileBytes)}
                </p>
                <p>PDF</p>
              </div>
              {completed ? (
                <Pill tone="success" className="ml-auto">
                  {tt("Finished", "อ่านจบแล้ว")}
                </Pill>
              ) : null}
            </div>

            <div className="mt-4">
              <div className="mb-1 flex justify-between text-[11px] text-muted">
                <span>
                  {tt("Page", "หน้า")} {page} {tt("of", "จาก")} {pages}
                </span>
                <span className="font-medium text-ink">{percent}%</span>
              </div>
              <Progress value={percent} tone={completed ? "success" : "brand"} />
            </div>

            {completed ? (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-success">
                <CheckCircle2 size={14} />
                {tt("You read this to the end.", "คุณอ่านเอกสารนี้จนจบแล้ว")}
              </p>
            ) : (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                <Sparkles size={14} className="text-amber" />
                {tt(
                  `Reach the last page to earn ${LMS_POINTS.document} points.`,
                  `อ่านถึงหน้าสุดท้ายเพื่อรับ ${LMS_POINTS.document} คะแนน`,
                )}
              </p>
            )}

            {description ? (
              <p className="mt-4 border-t border-line/70 pt-4 text-sm leading-relaxed text-muted">
                {description}
              </p>
            ) : null}

            {doc.competency ? (
              <div className="mt-4">
                <p className="mb-1 text-[11px] font-medium text-muted">
                  {tt("Builds the competency", "พัฒนาสมรรถนะ")}
                </p>
                <Pill tone="brand">{pick(lang, doc.competency.nameEn, doc.competency.nameTh)}</Pill>
              </div>
            ) : null}
          </Card>

          {doc.course ? (
            <Link href={`/lms/${doc.course.slug}`} className="block">
              <Card className="group p-4 transition hover:border-brand/40">
                <p className="text-[11px] font-medium text-muted">
                  {tt("Go deeper in the course", "เรียนต่อในหลักสูตร")}
                </p>
                <p className="mt-1 flex items-center gap-2 text-sm font-bold text-ink group-hover:text-brand">
                  <span className="min-w-0 flex-1">{pick(lang, doc.course.titleEn, doc.course.titleTh)}</span>
                  <ArrowRight size={16} className="shrink-0" />
                </p>
              </Card>
            </Link>
          ) : null}

          <p className="px-1 text-[11px] text-line-2">
            {tt(
              "Tip: use the ← → keys, or swipe on a phone, to turn pages.",
              "เคล็ดลับ: ใช้ปุ่ม ← → หรือปัดซ้าย-ขวาบนมือถือเพื่อเปลี่ยนหน้า",
            )}
          </p>
        </aside>
      </div>
    </div>
  );
}
