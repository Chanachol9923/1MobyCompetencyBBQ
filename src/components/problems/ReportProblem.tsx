"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle2, LifeBuoy } from "lucide-react";
import { Button, Field, Input, Modal, Textarea } from "@/components/ui";
import { submitProblem, discardReportImage } from "@/server/problems";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ImagePicker } from "./ImagePicker";
import { CATEGORY_LABEL, PROBLEM_CATEGORIES, type ProblemCategoryValue } from "./types";

/**
 * The small "Report a problem" link under Log out, and the form behind it.
 * The page the person was on and their browser go along automatically, so
 * nobody has to describe where they were.
 */
export function ReportProblemButton({ drawer, onOpen }: { drawer?: boolean; onOpen?: () => void }) {
  const { tt } = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ProblemCategoryValue>("BUG");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  const [page, setPage] = useState("");
  const [busy, startTransition] = useTransition();
  const box = useRef<HTMLDivElement>(null);

  function start() {
    onOpen?.();
    setCategory("BUG");
    setTitle("");
    setDescription("");
    setImages([]);
    setError(null);
    setSent(null);
    setPage(pathname);
    setOpen(true);
  }

  function close() {
    // pictures picked for a report that was never sent are not kept
    if (sent === null) for (const url of images) void discardReportImage({ url }).catch(() => {});
    setOpen(false);
  }

  function send() {
    setError(null);
    startTransition(async () => {
      const res = await submitProblem({
        category,
        title,
        description,
        pageUrl: page,
        userAgent: navigator.userAgent,
        attachments: images,
      });
      if (res.ok) setSent(res.number ?? 0);
      else setError(tt(res.error.en, res.error.th));
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={start}
        className={cn(
          "flex h-8 items-center gap-2 rounded-lg px-2 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-white",
          drawer && "h-11 text-sm",
        )}
      >
        <LifeBuoy size={14} />
        {tt("Report a problem", "รายงานปัญหา")}
      </button>

      <Modal
        open={open}
        onClose={close}
        title={tt("Report a problem", "รายงานปัญหา")}
        subtitle={
          sent === null
            ? tt(
                "Tell the admin team what went wrong. Everyone who handles reports is notified.",
                "แจ้งทีมผู้ดูแลระบบว่าเกิดอะไรขึ้น ผู้ดูแลทุกคนจะได้รับการแจ้งเตือน",
              )
            : undefined
        }
        width="max-w-xl"
        footer={
          sent === null ? (
            <>
              <Link
                href="/problems"
                onClick={close}
                className="mr-auto self-center text-xs font-medium text-brand hover:underline"
              >
                {tt("My reports", "รายงานของฉัน")}
              </Link>
              <Button variant="outline" onClick={close}>
                {tt("Cancel", "ยกเลิก")}
              </Button>
              <Button onClick={send} disabled={busy || uploading}>
                {uploading ? tt("Uploading…", "กำลังอัปโหลด…") : tt("Send report", "ส่งรายงาน")}
              </Button>
            </>
          ) : (
            <>
              <Link href="/problems" onClick={() => setOpen(false)}>
                <Button variant="outline">{tt("See my reports", "ดูรายงานของฉัน")}</Button>
              </Link>
              <Button onClick={() => setOpen(false)}>{tt("Done", "เสร็จสิ้น")}</Button>
            </>
          )
        }
      >
        {sent !== null ? (
          <div className="py-6 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-success/10 text-success">
              <CheckCircle2 size={28} />
            </span>
            <p className="mt-3 text-lg font-bold text-ink">
              {tt(`Report #${sent} sent`, `ส่งรายงาน #${sent} แล้ว`)}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              {tt(
                "The admin team has been notified. You'll get a notification when someone picks it up and when it's fixed.",
                "ทีมผู้ดูแลระบบได้รับแจ้งแล้ว คุณจะได้รับการแจ้งเตือนเมื่อมีผู้รับเรื่องและเมื่อแก้ไขเสร็จ",
              )}
            </p>
          </div>
        ) : (
          <div ref={box} className="space-y-4">
            {error ? (
              <p role="alert" className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-ink">
                {error}
              </p>
            ) : null}

            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">{tt("What kind of problem?", "ปัญหาประเภทใด")}</p>
              <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
                {PROBLEM_CATEGORIES.map((c) => {
                  const l = CATEGORY_LABEL[c];
                  const on = category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setCategory(c)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left transition",
                        on ? "border-brand bg-brand-tint/60" : "border-line hover:border-line-2",
                      )}
                    >
                      <span className={cn("block text-sm font-bold", on ? "text-brand" : "text-ink")}>
                        {tt(l.en, l.th)}
                      </span>
                      <span className="block text-[11px] leading-snug text-muted">{tt(l.hintEn, l.hintTh)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Field label={`${tt("Short title", "หัวข้อสั้น ๆ")} *`}>
              <Input
                value={title}
                maxLength={140}
                placeholder={tt("e.g. The Save button on my development plan does nothing", "เช่น กดปุ่มบันทึกในแผนพัฒนาแล้วไม่มีอะไรเกิดขึ้น")}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label={`${tt("What happened?", "เกิดอะไรขึ้น")} *`}>
              <Textarea
                rows={5}
                value={description}
                maxLength={4000}
                placeholder={tt(
                  "What you did, what you expected, and what happened instead.",
                  "คุณทำอะไร คาดว่าจะเกิดอะไร และสิ่งที่เกิดขึ้นจริง",
                )}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>

            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">{tt("Screenshots", "ภาพหน้าจอ")}</p>
              <ImagePicker
                folder="screenshots"
                value={images}
                onChange={setImages}
                onBusyChange={setUploading}
                pasteTarget={box}
              />
            </div>

            <p className="rounded-lg bg-surface px-3 py-2 text-[11px] text-muted">
              {tt("Sent along automatically: the page you were on", "ระบบแนบให้อัตโนมัติ: หน้าที่คุณเปิดอยู่")}{" "}
              <span className="font-medium text-ink">{page || "/"}</span>{" "}
              {tt("and your browser version.", "และเวอร์ชันเบราว์เซอร์ของคุณ")}
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
