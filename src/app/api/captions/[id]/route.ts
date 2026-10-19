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
    t.cues.map((c, i) => `${i + 1}\n${ts(c.startMs)} --> ${ts(c.endMs)}\n${c.text.replace(/-->/g, "→")}\n`).join("\n");
  return new Response(body, {
    headers: { "content-type": "text/vtt; charset=utf-8", "cache-control": "private, max-age=300" },
  });
}
