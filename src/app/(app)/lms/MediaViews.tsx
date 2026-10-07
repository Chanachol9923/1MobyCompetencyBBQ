"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText, Play, Search } from "lucide-react";
import { Button, Card, EmptyState, Input, Pill, Progress, Tabs } from "@/components/ui";
import { LMS_POINTS, pick } from "@/components/learning/model";
import {
  formatBytes,
  formatDuration,
  type DocumentCard,
  type ShortCard,
} from "@/components/learning/media-types";
import { PdfThumb } from "@/components/learning/PdfReader";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/* ================================================================= shorts */

/** The Shorts tab: a wall of covers; any of them opens the feed on itself. */
export function ShortsGrid({ shorts }: { shorts: ShortCard[] }) {
  const { tt, lang } = useT();
  const watched = shorts.filter((s) => s.completed).length;

  if (!shorts.length) {
    return (
      <Card>
        <EmptyState
          title={tt("No shorts yet", "ยังไม่มีคลิปสั้น")}
          hint={tt(
            "Short learning videos appear here once the learning team publishes them.",
            "คลิปการเรียนรู้สั้น ๆ จะแสดงที่นี่เมื่อทีมดูแลการเรียนรู้เผยแพร่",
          )}
        />
      </Card>
    );
  }

  const next = shorts.find((s) => !s.completed) ?? shorts[0];

  return (
    <>
      <Card className="mb-6 flex flex-wrap items-center gap-4 overflow-hidden bg-gradient-to-r from-ink to-[#2b2350] p-5 text-white">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold">{tt("Learn in a minute", "เรียนรู้ใน 1 นาที")}</p>
          <p className="mt-1 text-sm text-white/75">
            {tt(
              `Short vertical videos — scroll for the next one. Each one you finish earns ${LMS_POINTS.short} points.`,
              `วิดีโอแนวตั้งสั้น ๆ เลื่อนขึ้นเพื่อดูคลิปถัดไป ดูจบแต่ละคลิปรับ ${LMS_POINTS.short} คะแนน`,
            )}
          </p>
          <div className="mt-3 flex max-w-xs items-center gap-2 text-xs text-white/75">
            <Progress value={Math.round((watched / shorts.length) * 100)} tone="amber" className="flex-1" />
            <span>
              {watched}/{shorts.length} {tt("watched", "ดูแล้ว")}
            </span>
          </div>
        </div>
        <Link href={`/lms/shorts?s=${next.id}`}>
          <Button className="bg-white text-ink hover:bg-white/90">
            <Play size={16} fill="currentColor" />
            {watched === shorts.length
              ? tt("Watch again", "ดูอีกครั้ง")
              : watched
                ? tt("Keep watching", "ดูต่อ")
                : tt("Start watching", "เริ่มดู")}
          </Button>
        </Link>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {shorts.map((s) => (
          <Link
            key={s.id}
            href={`/lms/shorts?s=${s.id}`}
            className="group relative block aspect-[9/16] overflow-hidden rounded-xl bg-ink"
          >
            {s.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.posterUrl}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-brand to-accent">
                <Play size={32} className="text-white/80" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            <span className="absolute right-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white">
              {formatDuration(s.durationSec)}
            </span>
            {s.completed ? (
              <span className="absolute left-2 top-2 grid size-6 place-items-center rounded-full bg-success text-white">
                <CheckCircle2 size={14} />
              </span>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 p-2.5 text-white">
              {s.competency ? (
                <p className="truncate text-[10px] font-medium uppercase tracking-wide text-white/70">
                  {pick(lang, s.competency.nameEn, s.competency.nameTh)}
                </p>
              ) : null}
              <p className="line-clamp-2 text-[13px] font-bold leading-snug">
                {pick(lang, s.titleEn, s.titleTh)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

/* ============================================================== documents */

type DocFilter = "all" | "todo" | "done";

/** The Documents tab: a library you can search, with your reading progress. */
export function DocumentsGrid({ documents }: { documents: DocumentCard[] }) {
  const { tt, lang } = useT();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<DocFilter>("all");

  const inProgress = documents.filter((d) => !d.completed && d.lastPage > 1);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return documents.filter((d) => {
      if (filter === "todo" && d.completed) return false;
      if (filter === "done" && !d.completed) return false;
      if (!needle) return true;
      return [d.titleEn, d.titleTh, d.descriptionEn, d.descriptionTh, d.competency?.nameEn, d.competency?.nameTh]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(needle));
    });
  }, [documents, q, filter]);

  if (!documents.length) {
    return (
      <Card>
        <EmptyState
          title={tt("No documents yet", "ยังไม่มีเอกสาร")}
          hint={tt(
            "Handbooks, guides and slides appear here once the learning team publishes them.",
            "คู่มือ เอกสารแนะนำ และสไลด์จะแสดงที่นี่เมื่อทีมดูแลการเรียนรู้เผยแพร่",
          )}
        />
      </Card>
    );
  }

  return (
    <>
      {inProgress.length ? (
        <div className="mb-6">
          <p className="mb-2 text-sm font-bold text-ink">{tt("Continue reading", "อ่านต่อ")}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {inProgress.slice(0, 3).map((d) => (
              <Link key={d.id} href={`/lms/documents/${d.id}`} className="block">
                <Card className="group flex items-center gap-3 p-3 transition hover:border-brand/40">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-tint text-brand">
                    <FileText size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink group-hover:text-brand">
                      {pick(lang, d.titleEn, d.titleTh)}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <Progress value={Math.round((d.lastPage / d.pages) * 100)} className="flex-1" />
                      <span className="shrink-0 text-[11px] text-muted">
                        {tt("p.", "หน้า")} {d.lastPage}/{d.pages}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tt("Search documents", "ค้นหาเอกสาร")}
            aria-label={tt("Search documents", "ค้นหาเอกสาร")}
            className="pl-9"
          />
        </div>
        <Tabs
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all" as const, label: tt("All", "ทั้งหมด") },
            { value: "todo" as const, label: tt("Not finished", "ยังอ่านไม่จบ") },
            { value: "done" as const, label: tt("Finished", "อ่านจบแล้ว") },
          ]}
        />
      </div>

      {shown.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((d) => (
            <DocumentTile key={d.id} doc={d} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            title={tt("No documents match", "ไม่พบเอกสารที่ตรงกัน")}
            hint={tt("Try another word or filter.", "ลองใช้คำค้นหรือตัวกรองอื่น")}
          />
        </Card>
      )}
    </>
  );
}

function DocumentTile({ doc }: { doc: DocumentCard }) {
  const { tt, lang } = useT();
  const started = doc.lastPage > 1;
  const percent = doc.completed ? 100 : Math.round(((doc.lastPage - (started ? 0 : 1)) / doc.pages) * 100);
  const description = doc.descriptionEn ? pick(lang, doc.descriptionEn, doc.descriptionTh) : null;

  return (
    <Card className="group flex flex-col overflow-hidden">
      <Link
        href={`/lms/documents/${doc.id}`}
        className="relative block h-40 overflow-hidden bg-gradient-to-br from-brand-tint via-surface to-surface"
        aria-hidden
        tabIndex={-1}
      >
        {/* the first page, peeking out like a sheet on a desk */}
        <span className="absolute inset-x-0 top-5 mx-auto block min-h-[220px] w-[58%] overflow-hidden rounded-sm bg-white shadow-[0_6px_24px_rgba(16,24,40,.14)] transition-transform duration-300 group-hover:-translate-y-1">
          <span className="absolute inset-x-0 top-12 grid place-items-center">
            <FileText size={28} className="text-brand/40" />
          </span>
          <PdfThumb url={doc.fileUrl} className="relative" />
        </span>
        <span className="absolute bottom-2.5 left-3 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">
          PDF · {doc.pages} {tt("pages", "หน้า")}
        </span>
        {doc.completed ? (
          <span className="absolute right-3 top-3">
            <Pill tone="success">{tt("Finished", "อ่านจบแล้ว")}</Pill>
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        {doc.competency ? (
          <p className="truncate text-[11px] font-bold uppercase tracking-wide text-brand">
            {pick(lang, doc.competency.nameEn, doc.competency.nameTh)}
          </p>
        ) : null}
        <h3 className="mt-0.5 text-[15px] font-bold leading-snug text-ink">
          {pick(lang, doc.titleEn, doc.titleTh)}
        </h3>
        {description ? <p className="mt-1 line-clamp-2 text-xs text-muted">{description}</p> : null}
        <p className="mt-2 text-[11px] text-muted">
          {formatBytes(doc.fileBytes)}
          {!doc.completed ? ` · +${LMS_POINTS.document} ${tt("points", "คะแนน")}` : ""}
        </p>
        {started && !doc.completed ? (
          <div className="mt-3">
            <Progress value={percent} />
          </div>
        ) : null}
        <div className="mt-4 flex-1" />
        <Link href={`/lms/documents/${doc.id}`} className="block">
          <Button className={cn("w-full")} variant={doc.completed ? "outline" : "primary"}>
            {doc.completed
              ? tt("Read again", "อ่านอีกครั้ง")
              : started
                ? tt(`Continue from page ${doc.lastPage}`, `อ่านต่อจากหน้า ${doc.lastPage}`)
                : tt("Read", "อ่าน")}
            <ArrowRight size={16} />
          </Button>
        </Link>
      </div>
    </Card>
  );
}
