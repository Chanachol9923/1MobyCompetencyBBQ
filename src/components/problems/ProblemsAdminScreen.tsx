"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Globe,
  Hand,
  ImageIcon,
  LogOut as Release,
  Monitor,
  RotateCcw,
  User,
  Wrench,
} from "lucide-react";
import { Button, Card, EmptyState, Field, Modal, PageHeading, Pill, Tabs, Textarea } from "@/components/ui";
import { CountTile, SearchInput } from "@/components/admin/shared";
import { ResultBanner } from "@/components/admin/rbac-shared";
import { timeAgo } from "@/components/announcements/format";
import {
  claimProblem,
  discardReportImage,
  releaseProblem,
  reopenProblem,
  resolveProblem,
} from "@/server/problems";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ImagePicker } from "./ImagePicker";
import {
  CATEGORY_LABEL,
  STATUS_LABEL,
  type ProblemClaimRow,
  type ProblemResult,
  type ProblemRow,
  type ProblemStatusValue,
  type ProblemsAdminData,
} from "./types";

type Filter = "ALL" | ProblemStatusValue | "MINE";

export const STATUS_TONE: Record<ProblemStatusValue, "warn" | "brand" | "success"> = {
  OPEN: "warn",
  IN_PROGRESS: "brand",
  FIXED: "success",
};

const AVATAR_TONES = ["bg-brand", "bg-accent", "bg-success", "bg-amber", "bg-ink", "bg-[#7c3aed]"];
const toneFor = (id: string) => AVATAR_TONES[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length];
const initials = (name: string) =>
  name
    .split(/[\s.@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

/** A browser user-agent, shortened to what a person can read. */
function shortAgent(ua: string | null) {
  if (!ua) return null;
  const browser =
    /Edg\/([\d]+)/.exec(ua)?.[0].replace("Edg", "Edge") ??
    /Chrome\/([\d]+)/.exec(ua)?.[0] ??
    /Firefox\/([\d]+)/.exec(ua)?.[0] ??
    (/Safari\//.test(ua) ? `Safari ${/Version\/([\d.]+)/.exec(ua)?.[1] ?? ""}` : "Browser");
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad/.test(ua)
        ? "iOS"
        : /Mac OS/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return [browser.replace("/", " "), os].filter(Boolean).join(" · ");
}

/* ---------------------------------------------------------------- avatars */

/** Who has claimed a report: a stack of initials, each with a hover bubble. */
export function Claimers({ claims, size = 28 }: { claims: ProblemClaimRow[]; size?: number }) {
  const { tt, lang } = useT();
  if (!claims.length) {
    return <span className="text-[11px] text-line-2">{tt("Nobody yet", "ยังไม่มีผู้รับเรื่อง")}</span>;
  }
  return (
    <span className="flex items-center">
      {claims.map((c, i) => (
        <span key={c.userId} className={cn("group relative", i > 0 && "-ml-2")}>
          <span
            tabIndex={0}
            aria-label={c.name}
            className={cn(
              "grid place-items-center rounded-full font-bold text-white ring-2 ring-white outline-none focus-visible:ring-brand",
              toneFor(c.userId),
            )}
            style={{ width: size, height: size, fontSize: size * 0.38 }}
          >
            {initials(c.name)}
          </span>
          {/* the bubble */}
          <span
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-max max-w-[220px] -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-left text-[11px] leading-snug text-white shadow-lg group-hover:block group-focus-within:block"
          >
            <span className="block font-bold">{c.name}</span>
            <span className="block text-white/70">{c.email}</span>
            <span className="mt-0.5 block text-white/70">
              {tt("Claimed", "รับเรื่องเมื่อ")} {timeAgo(c.claimedAt, lang)}
            </span>
            <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-ink" />
          </span>
        </span>
      ))}
    </span>
  );
}

/* ----------------------------------------------------------------- screen */

export function ProblemsAdminScreen({ data }: { data: ProblemsAdminData }) {
  const { tt, lang } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ProblemResult | null>(null);
  const [busy, startTransition] = useTransition();
  const openId = params.get("id");
  const current = data.problems.find((p) => p.id === openId) ?? null;

  const mine = (p: ProblemRow) => p.claims.some((c) => c.userId === data.me);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.problems.filter((p) => {
      if (filter === "MINE" ? !mine(p) : filter !== "ALL" && p.status !== filter) return false;
      if (!q) return true;
      return `#${p.number} ${p.title} ${p.description} ${p.reporter.name} ${p.reporter.email}`
        .toLowerCase()
        .includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.problems, filter, query]);

  const open = (id: string | null) =>
    router.replace(id ? `${pathname}?id=${id}` : pathname, { scroll: false });

  const run = (fn: () => Promise<ProblemResult>) =>
    startTransition(async () => {
      const res = await fn();
      setResult(res);
      router.refresh();
    });

  const myCount = data.problems.filter(mine).length;
  const total = data.counts.OPEN + data.counts.IN_PROGRESS + data.counts.FIXED;

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading
        title={tt("Problem reports", "ปัญหาที่ได้รับแจ้ง")}
        subtitle={tt(
          "What people reported with “Report a problem”. Claim one to show you're on it — several admins can share a report.",
          "เรื่องที่ผู้ใช้แจ้งผ่าน “รายงานปัญหา” กดรับเรื่องเพื่อบอกว่าคุณกำลังดูแล ผู้ดูแลหลายคนรับเรื่องเดียวกันได้",
        )}
      />
      <ResultBanner result={result} onDismiss={() => setResult(null)} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <CountTile value={data.counts.OPEN} label={tt("Unclaimed", "ยังไม่มีผู้รับเรื่อง")} tone="amber" icon={<Hand size={20} />} />
        <CountTile value={data.counts.IN_PROGRESS} label={tt("In progress", "กำลังดำเนินการ")} icon={<Wrench size={20} />} />
        <CountTile value={data.counts.FIXED} label={tt("Fixed", "แก้ไขแล้ว")} tone="success" icon={<CheckCircle2 size={20} />} />
        <CountTile value={myCount} label={tt("Claimed by me", "เรื่องที่ฉันรับ")} tone="ink" icon={<User size={20} />} />
      </div>

      <Card className="mt-5">
        <div className="flex flex-wrap items-center gap-3 p-5">
          <Tabs
            value={filter}
            onChange={setFilter}
            className="max-w-full overflow-x-auto"
            options={[
              { value: "ALL" as const, label: `${tt("All", "ทั้งหมด")} ${total}` },
              { value: "OPEN" as const, label: `${tt(STATUS_LABEL.OPEN.en, "ยังไม่รับเรื่อง")} ${data.counts.OPEN}` },
              { value: "IN_PROGRESS" as const, label: `${tt(STATUS_LABEL.IN_PROGRESS.en, STATUS_LABEL.IN_PROGRESS.th)} ${data.counts.IN_PROGRESS}` },
              { value: "FIXED" as const, label: `${tt(STATUS_LABEL.FIXED.en, STATUS_LABEL.FIXED.th)} ${data.counts.FIXED}` },
              { value: "MINE" as const, label: `${tt("Mine", "ของฉัน")} ${myCount}` },
            ]}
          />
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={tt("Search reports...", "ค้นหารายงาน...")}
            className="w-full sm:ml-auto sm:w-64"
          />
        </div>

        {visible.length ? (
          <ul className="divide-y divide-line/70 border-t border-line/70">
            {visible.map((p) => {
              const claimed = mine(p);
              return (
                <li key={p.id} className="relative flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition hover:bg-surface/50">
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-y-0 left-0 w-1",
                      p.status === "OPEN" && "bg-amber",
                      p.status === "IN_PROGRESS" && "bg-brand",
                      p.status === "FIXED" && "bg-success",
                    )}
                  />
                  <button type="button" onClick={() => open(p.id)} className="min-w-0 flex-1 basis-72 text-left">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted">#{p.number}</span>
                      <span className="truncate text-sm font-bold text-ink hover:text-brand">{p.title}</span>
                      {p.attachments.length ? (
                        <span className="inline-flex items-center gap-0.5 text-[11px] text-muted">
                          <ImageIcon size={12} /> {p.attachments.length}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {tt(CATEGORY_LABEL[p.category].en, CATEGORY_LABEL[p.category].th)} · {p.reporter.name} ·{" "}
                      {timeAgo(p.createdAt, lang)}
                      {p.pageUrl ? ` · ${p.pageUrl}` : ""}
                    </span>
                  </button>
                  <Claimers claims={p.claims} />
                  <Pill tone={STATUS_TONE[p.status]} className="whitespace-nowrap">
                    {tt(STATUS_LABEL[p.status].en, STATUS_LABEL[p.status].th)}
                  </Pill>
                  <div className="flex gap-2">
                    {p.status !== "FIXED" ? (
                      claimed ? (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => releaseProblem({ id: p.id }))}>
                          <Release size={14} /> {tt("Release", "ถอนตัว")}
                        </Button>
                      ) : (
                        <Button size="sm" disabled={busy} onClick={() => run(() => claimProblem({ id: p.id }))}>
                          <Hand size={14} /> {tt("Claim", "รับเรื่อง")}
                        </Button>
                      )
                    ) : null}
                    <Button size="sm" variant="secondary" onClick={() => open(p.id)}>
                      {tt("Open", "เปิด")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="border-t border-line/70">
            <EmptyState
              title={
                data.problems.length
                  ? tt("No reports match", "ไม่พบรายงานที่ตรงกัน")
                  : tt("No problems reported yet", "ยังไม่มีการแจ้งปัญหา")
              }
              hint={
                data.problems.length
                  ? tt("Try another filter or search.", "ลองเปลี่ยนตัวกรองหรือคำค้น")
                  : tt(
                      "Reports from the “Report a problem” link appear here, and every admin is notified.",
                      "รายงานจากลิงก์ “รายงานปัญหา” จะแสดงที่นี่ และผู้ดูแลทุกคนจะได้รับการแจ้งเตือน",
                    )
              }
            />
          </div>
        )}
      </Card>

      <ProblemDetail
        problem={current}
        me={data.me}
        busy={busy}
        onClose={() => open(null)}
        run={run}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- detail */

function ProblemDetail({
  problem: p,
  me,
  busy,
  onClose,
  run,
}: {
  problem: ProblemRow | null;
  me: string;
  busy: boolean;
  onClose: () => void;
  run: (fn: () => Promise<ProblemResult>) => void;
}) {
  const { tt, lang } = useT();
  const [fixing, setFixing] = useState(false);
  const [note, setNote] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const saved = useRef(false);

  // a fresh form for every report opened
  useEffect(() => {
    setFixing(false);
    setNote("");
    setImages([]);
    setError(null);
    saved.current = false;
  }, [p?.id]);

  const close = () => {
    if (!saved.current) for (const url of images) void discardReportImage({ url }).catch(() => {});
    onClose();
  };

  const claimed = p ? p.claims.some((c) => c.userId === me) : false;

  return (
    <Modal
      open={Boolean(p)}
      onClose={close}
      title={p ? `#${p.number} · ${p.title}` : ""}
      subtitle={
        p ? (
          <span className="inline-flex flex-wrap items-center gap-2">
            <Pill tone={STATUS_TONE[p.status]}>{tt(STATUS_LABEL[p.status].en, STATUS_LABEL[p.status].th)}</Pill>
            <span>{tt(CATEGORY_LABEL[p.category].en, CATEGORY_LABEL[p.category].th)}</span>
          </span>
        ) : undefined
      }
      width="max-w-2xl"
      footer={
        !p ? null : fixing ? (
          <>
            <Button variant="outline" onClick={() => setFixing(false)}>
              {tt("Back", "ย้อนกลับ")}
            </Button>
            <Button
              disabled={busy || uploading}
              onClick={() => {
                if (note.trim().length < 3) {
                  setError(tt("Write what was fixed, so the reporter knows.", "กรุณาเขียนว่าแก้ไขอะไรไป เพื่อให้ผู้แจ้งทราบ"));
                  return;
                }
                saved.current = true;
                run(() => resolveProblem({ id: p.id, note, images }));
                setFixing(false);
              }}
            >
              <CheckCircle2 size={15} /> {tt("Confirm fixed", "ยืนยันว่าแก้ไขแล้ว")}
            </Button>
          </>
        ) : (
          <>
            {p.status === "FIXED" ? (
              <Button variant="outline" disabled={busy} onClick={() => run(() => reopenProblem({ id: p.id }))}>
                <RotateCcw size={14} /> {tt("Reopen", "เปิดเรื่องใหม่")}
              </Button>
            ) : claimed ? (
              <Button variant="outline" disabled={busy} onClick={() => run(() => releaseProblem({ id: p.id }))}>
                <Release size={14} /> {tt("Release", "ถอนตัว")}
              </Button>
            ) : (
              <Button variant="outline" disabled={busy} onClick={() => run(() => claimProblem({ id: p.id }))}>
                <Hand size={14} /> {tt("Claim", "รับเรื่อง")}
              </Button>
            )}
            {p.status !== "FIXED" ? (
              <Button onClick={() => setFixing(true)}>
                <CheckCircle2 size={15} /> {tt("Mark as fixed", "แจ้งว่าแก้ไขแล้ว")}
              </Button>
            ) : (
              <Button onClick={close}>{tt("Close", "ปิด")}</Button>
            )}
          </>
        )
      }
    >
      {p ? (
        fixing ? (
          <div ref={box} className="space-y-4">
            {error ? (
              <p role="alert" className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-ink">
                {error}
              </p>
            ) : null}
            <p className="text-sm text-muted">
              {tt(
                `${p.reporter.name} will be notified with your note and evidence.`,
                `${p.reporter.name} จะได้รับการแจ้งเตือนพร้อมบันทึกและหลักฐานของคุณ`,
              )}
            </p>
            <Field label={`${tt("What was fixed?", "แก้ไขอะไรไปบ้าง")} *`}>
              <Textarea
                rows={5}
                value={note}
                maxLength={4000}
                placeholder={tt(
                  "e.g. The Save button now works on phones. The cause was…",
                  "เช่น ตอนนี้ปุ่มบันทึกใช้งานบนมือถือได้แล้ว สาเหตุเกิดจาก…",
                )}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">{tt("Evidence (optional)", "หลักฐาน (ไม่บังคับ)")}</p>
              <ImagePicker folder="evidence" value={images} onChange={setImages} onBusyChange={setUploading} pasteTarget={box} />
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <User size={13} /> <span className="font-medium text-ink">{p.reporter.name}</span> ({p.reporter.email})
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock size={13} /> {new Date(p.createdAt).toLocaleString(lang === "th" ? "th-TH" : "en-GB")}
              </span>
            </div>

            <p className="whitespace-pre-wrap rounded-lg bg-surface/70 p-4 text-sm leading-relaxed text-ink">
              {p.description}
            </p>

            {p.attachments.length ? (
              <Gallery title={tt("Screenshots", "ภาพหน้าจอ")} urls={p.attachments} />
            ) : null}

            <div className="grid gap-2 text-xs sm:grid-cols-2">
              <span className="inline-flex items-center gap-1.5 text-muted">
                <Globe size={13} /> {tt("Page", "หน้า")}:{" "}
                {p.pageUrl ? (
                  <a href={p.pageUrl} className="font-medium text-brand hover:underline">
                    {p.pageUrl}
                  </a>
                ) : (
                  "—"
                )}
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted">
                <Monitor size={13} /> {shortAgent(p.userAgent) ?? "—"}
              </span>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-ink">{tt("Handled by", "ผู้รับเรื่อง")}</p>
              {p.claims.length ? (
                <ul className="space-y-1.5">
                  {p.claims.map((c) => (
                    <li key={c.userId} className="flex items-center gap-2 text-sm">
                      <Claimers claims={[c]} size={24} />
                      <span className="font-medium text-ink">{c.name}</span>
                      {c.userId === me ? <Pill tone="brand">{tt("You", "คุณ")}</Pill> : null}
                      <span className="text-xs text-muted">· {timeAgo(c.claimedAt, lang)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">{tt("Nobody has claimed this yet.", "ยังไม่มีผู้รับเรื่องนี้")}</p>
              )}
            </div>

            {p.status === "FIXED" ? (
              <div className="rounded-xl border border-success/40 bg-success/5 p-4">
                <p className="flex items-center gap-1.5 text-sm font-bold text-success">
                  <CheckCircle2 size={16} />
                  {tt("Fixed", "แก้ไขแล้ว")}
                  {p.resolvedBy ? (
                    <span className="font-normal text-muted">
                      · {p.resolvedBy.name} · {p.resolvedAt ? timeAgo(p.resolvedAt, lang) : ""}
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
          </div>
        )
      ) : null}
    </Modal>
  );
}

export function Gallery({ title, urls }: { title: string; urls: string[] }) {
  return (
    <div>
      <p className="mb-2 text-sm font-bold text-ink">{title}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {urls.map((u) => (
          <a
            key={u}
            href={u}
            target="_blank"
            rel="noopener noreferrer"
            className="block aspect-video overflow-hidden rounded-lg border border-line bg-surface transition hover:border-brand/50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className="h-full w-full object-cover" />
          </a>
        ))}
      </div>
    </div>
  );
}
