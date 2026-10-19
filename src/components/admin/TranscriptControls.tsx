"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Captions, Loader2, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { useUi } from "@/lib/ui-state";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  getTranscriptCues,
  getTranscriptStates,
  retranscribe,
  saveTranscriptEdits,
} from "@/server/transcript-admin";
import type { TranscriptAdminCue, TranscriptState } from "./transcript-types";

/**
 * Where each video's subtitles stand, refreshed every few seconds while any
 * of them is still being made.
 */
export function useTranscriptStates(urls: string[]) {
  const [states, setStates] = useState<Record<string, TranscriptState>>({});
  const key = useMemo(() => [...new Set(urls)].sort().join("|"), [urls]);
  const list = useMemo(() => (key ? key.split("|") : []), [key]);

  const refresh = useCallback(async () => {
    if (!list.length) return;
    try {
      setStates(await getTranscriptStates({ urls: list }));
    } catch {
      /* the badges just stay as they were */
    }
  }, [list]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const busy = Object.values(states).some((s) => s.status === "PENDING" || s.status === "PROCESSING");
  useEffect(() => {
    if (!busy) return;
    const id = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(id);
  }, [busy, refresh]);

  return { states, refresh };
}

/** A small chip for one video, with "view / correct" and "make again". */
export function TranscriptBadge({
  url,
  state,
  onChanged,
}: {
  url: string;
  state: TranscriptState | undefined;
  onChanged: () => void;
}) {
  const { tt } = useT();
  const { notify } = useUi();
  const [editing, setEditing] = useState(false);
  const [working, setWorking] = useState(false);

  const start = async (fresh: boolean) => {
    setWorking(true);
    try {
      await retranscribe({ url, fresh });
      notify(tt("Subtitles are being made.", "เริ่มสร้างคำบรรยายแล้ว"));
      onChanged();
    } finally {
      setWorking(false);
    }
  };

  const label = !state
    ? tt("No subtitles", "ยังไม่มีคำบรรยาย")
    : state.status === "READY"
      ? state.corrected
        ? tt(
            `Subtitles · ${state.cues} lines · AI fixed ${state.corrected}`,
            `คำบรรยาย · ${state.cues} ท่อน · AI แก้คำ ${state.corrected}`,
          )
        : tt(`Subtitles · ${state.cues} lines`, `คำบรรยาย · ${state.cues} ท่อน`)
      : state.status === "FAILED"
        ? tt("Subtitles failed", "สร้างคำบรรยายไม่สำเร็จ")
        : state.status === "PROCESSING"
          ? tt(`Making subtitles ${state.percent}%`, `กำลังถอดเสียง ${state.percent}%`)
          : tt("Queued for subtitles", "รอคิวถอดเสียง");

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span
        title={state?.error ?? undefined}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
          !state && "bg-surface text-muted",
          state?.status === "READY" && "bg-success/10 text-success",
          state?.status === "FAILED" && "bg-accent/10 text-accent",
          (state?.status === "PENDING" || state?.status === "PROCESSING") && "bg-brand-tint text-brand",
        )}
      >
        {state?.status === "PROCESSING" || state?.status === "PENDING" ? (
          <Loader2 size={11} className="animate-spin" />
        ) : state?.status === "FAILED" ? (
          <TriangleAlert size={11} />
        ) : (
          <Captions size={11} />
        )}
        {label}
      </span>
      {state?.status === "READY" ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded px-1 text-[11px] font-medium text-brand hover:underline"
        >
          {tt("View / correct", "ดู/แก้")}
        </button>
      ) : null}
      {!state || state.status === "FAILED" || state.status === "READY" ? (
        <button
          type="button"
          disabled={working}
          onClick={() => void start(Boolean(state))}
          className="inline-flex items-center gap-0.5 rounded px-1 text-[11px] font-medium text-muted hover:text-ink disabled:opacity-40"
        >
          <RefreshCw size={10} /> {state ? tt("Redo", "ถอดใหม่") : tt("Make", "สร้าง")}
        </button>
      ) : null}
      {state && !state.enabled ? (
        <span className="text-[10px] text-amber">{tt("(AI key not set)", "(ยังไม่ได้ตั้งค่า AI key)")}</span>
      ) : null}
      {editing ? <TranscriptEditor url={url} onClose={() => setEditing(false)} onSaved={onChanged} /> : null}
    </span>
  );
}

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Every subtitle line, editable; an emptied line is removed. */
function TranscriptEditor({ url, onClose, onSaved }: { url: string; onClose: () => void; onSaved: () => void }) {
  const { tt } = useT();
  const { notify } = useUi();
  const [cues, setCues] = useState<TranscriptAdminCue[] | null>(null);
  const [changed, setChanged] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    void getTranscriptCues({ url }).then(setCues);
  }, [url]);

  const count = Object.keys(changed).length;

  const save = async () => {
    setSaving(true);
    try {
      const res = await saveTranscriptEdits({
        url,
        lines: Object.entries(changed).map(([id, text]) => ({ id, text })),
      });
      if (res.ok) {
        notify(tt("Corrections saved. The summary is being rewritten.", "บันทึกการแก้ไขแล้ว กำลังเขียนสรุปใหม่"));
        onSaved();
        onClose();
      } else notify(tt("Could not save.", "บันทึกไม่สำเร็จ"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={tt("Subtitles", "คำบรรยาย (Transcript)")}
      subtitle={tt(
        "Correct what was misheard. Lines the AI already fixed show what was heard underneath. Your corrections are kept even if the video is transcribed again; empty a line to remove it.",
        "แก้คำที่ถอดผิด บรรทัดที่ AI แก้ให้แล้วจะแสดงคำที่ได้ยินจริงไว้ด้านล่าง บรรทัดที่คุณแก้จะไม่ถูกเขียนทับเมื่อถอดเสียงใหม่ ลบข้อความทั้งบรรทัดเพื่อเอาท่อนนั้นออก",
      )}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {tt("Cancel", "ยกเลิก")}
          </Button>
          <Button onClick={() => void save()} disabled={!count || saving}>
            {count ? tt(`Save ${count} change(s)`, `บันทึก ${count} รายการ`) : tt("Save", "บันทึก")}
          </Button>
        </>
      }
    >
      {!cues ? (
        <p className="flex items-center gap-2 py-8 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" /> {tt("Loading…", "กำลังโหลด…")}
        </p>
      ) : cues.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">{tt("No speech was found.", "ไม่พบเสียงพูดในวิดีโอนี้")}</p>
      ) : (
        <ol className="space-y-2">
          {cues.map((c) => (
            <li key={c.id} className="flex gap-3">
              <span className="w-12 shrink-0 pt-2 font-mono text-xs text-brand">{clock(c.startMs)}</span>
              <div className="min-w-0 flex-1">
                <textarea
                  rows={2}
                  defaultValue={c.text}
                  onChange={(e) => setChanged((m) => ({ ...m, [c.id]: e.target.value }))}
                  className={cn(
                    "min-h-[52px] w-full resize-y rounded-lg border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20",
                    changed[c.id] !== undefined ? "border-amber" : c.edited ? "border-success/50" : "border-line",
                  )}
                />
                {c.rawText && !c.edited ? (
                  <p className="mt-1 flex items-start gap-1 text-[11px] leading-snug text-muted">
                    <Sparkles size={11} className="mt-0.5 shrink-0 text-brand" />
                    <span>
                      {tt("AI fixed · heard: ", "AI แก้แล้ว · ได้ยินว่า: ")}
                      <span className="line-through decoration-muted/60">{c.rawText}</span>
                    </span>
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
