import { db } from "@/lib/db";
import { assertViewer } from "@/server/session";

/** A transcript as WebVTT, for the <track> under a video. Signed-in people only. */
export const dynamic = "force-dynamic";

const ts = (ms: number) => {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const r = ms % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)}.${p(r, 3)}`;
};

/** About one line of subtitle on a phone. */
const MAX_CHARS = 42;
/** A space this far into a piece is a good place to end it. */
const MIN_CHARS = 18;
const words = new Intl.Segmenter("th", { granularity: "word" });

/**
 * Split a line of speech into pieces short enough to read at a glance.
 * Thai has no spaces between words, so the breaks come from the word
 * segmenter; a space (a pause in Thai writing) is preferred once a piece is
 * long enough.
 */
function pieces(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (const { segment } of words.segment(text.trim())) {
    if (/^\s+$/.test(segment)) {
      if (cur.length >= MIN_CHARS) {
        out.push(cur);
        cur = "";
      } else if (cur) cur += " ";
      continue;
    }
    if (cur && cur.length + segment.length > MAX_CHARS) {
      // "ความ" and "การ" belong to the word after them: carry them over
      const prefix = /(ความ|การ)$/.exec(cur)?.[0] ?? "";
      out.push(cur.slice(0, cur.length - prefix.length).trim() || cur.trim());
      cur = cur.length > prefix.length ? prefix : "";
    }
    cur += segment;
  }
  if (cur.trim()) out.push(cur.trim());
  // a scrap at the end joins the piece before it
  const last = out.at(-1);
  if (out.length > 1 && last && last.length < 10 && out.at(-2)!.length + last.length < MAX_CHARS + 8) {
    out.splice(-2, 2, `${out.at(-2)} ${last}`);
  }
  return out;
}

/** One stored cue as display cues, its time shared out by length. */
function split(c: { startMs: number; endMs: number; text: string }) {
  const parts = pieces(c.text.replace(/-->/g, "→"));
  const total = parts.reduce((a, p) => a + p.length, 0) || 1;
  let at = c.startMs;
  return parts.map((text, i) => {
    const end = i === parts.length - 1 ? c.endMs : Math.round(at + ((c.endMs - c.startMs) * text.length) / total);
    const cue = { startMs: at, endMs: end, text };
    at = end;
    return cue;
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertViewer();
  } catch {
    return new Response("Sign in first.", { status: 401 });
  }
  const { id } = await params;
  const t = await db.mediaTranscript.findUnique({
    where: { id },
    select: { status: true, cues: { orderBy: { startMs: "asc" }, select: { startMs: true, endMs: true, text: true } } },
  });
  if (!t || t.status !== "READY") return new Response("Not found", { status: 404 });
  const body =
    "WEBVTT\n\n" +
    t.cues
      .flatMap(split)
      .map((c, i) => `${i + 1}\n${ts(c.startMs)} --> ${ts(c.endMs)}\n${c.text}\n`)
      .join("\n");
  return new Response(body, {
    headers: { "content-type": "text/vtt; charset=utf-8", "cache-control": "private, max-age=300" },
  });
}
