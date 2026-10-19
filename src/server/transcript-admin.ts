"use server";

/**
 * Administering subtitles: where each video's transcript stands, starting it
 * again, and correcting what the speech recognition misheard.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { assertPermission, recordActivity } from "@/server/session";
import { BLOB_URL } from "@/server/blob";
import { enqueueTranscript, resetTranscript } from "@/server/transcribe";
import { kickTranscription } from "@/server/transcript-kick";
import type { TranscriptAdminCue, TranscriptState } from "@/components/admin/transcript-types";

const url = z.string().max(600).regex(BLOB_URL);

export async function getTranscriptStates(input: { urls: string[] }): Promise<Record<string, TranscriptState>> {
  await assertPermission(PERMISSIONS.MANAGE_LMS);
  const urls = z.array(url).max(200).safeParse(input?.urls);
  if (!urls.success || !urls.data.length) return {};
  const rows = await db.mediaTranscript.findMany({
    where: { mediaUrl: { in: urls.data } },
    select: {
      mediaUrl: true,
      status: true,
      durationSec: true,
      cursorSec: true,
      error: true,
      summaryTh: true,
      summaryError: true,
      _count: { select: { cues: true } },
    },
  });
  return Object.fromEntries(
    rows.map((r) => [
      r.mediaUrl,
      {
        status: r.status,
        percent:
          r.status === "READY" ? 100 : r.durationSec ? Math.min(99, Math.round((r.cursorSec / r.durationSec) * 100)) : 0,
        cues: r._count.cues,
        error: r.error,
        hasSummary: Boolean(r.summaryTh),
        summaryError: r.summaryError,
        enabled: Boolean(process.env.TYPHOON_API_KEY),
      } satisfies TranscriptState,
    ]),
  );
}

/** Make (or remake) the subtitles for a video. */
export async function retranscribe(input: { url: string; fresh?: boolean }) {
  const viewer = await assertPermission(PERMISSIONS.MANAGE_LMS);
  const parsed = url.safeParse(input?.url);
  if (!parsed.success) return { ok: false as const };
  if (input.fresh) await resetTranscript(parsed.data);
  else await enqueueTranscript(parsed.data);
  await kickTranscription();
  await recordActivity({
    viewer,
    action: "Requested subtitles",
    targetType: "media",
    targetLabel: parsed.data.split("/").pop(),
  });
  return { ok: true as const };
}

export async function getTranscriptCues(input: { url: string }): Promise<TranscriptAdminCue[]> {
  await assertPermission(PERMISSIONS.MANAGE_LMS);
  const parsed = url.safeParse(input?.url);
  if (!parsed.success) return [];
  const t = await db.mediaTranscript.findUnique({
    where: { mediaUrl: parsed.data },
    select: { cues: { orderBy: { startMs: "asc" }, select: { id: true, startMs: true, endMs: true, text: true, edited: true } } },
  });
  return t?.cues ?? [];
}

const edits = z.object({
  url,
  lines: z.array(z.object({ id: z.string().min(1).max(64), text: z.string().trim().max(1000) })).max(2000),
});

/** Save corrected lines; the summary is written again from the corrected text. */
export async function saveTranscriptEdits(input: z.input<typeof edits>) {
  const viewer = await assertPermission(PERMISSIONS.MANAGE_LMS);
  const parsed = edits.safeParse(input);
  if (!parsed.success) return { ok: false as const };
  const t = await db.mediaTranscript.findUnique({ where: { mediaUrl: parsed.data.url }, select: { id: true } });
  if (!t) return { ok: false as const };
  await db.$transaction([
    ...parsed.data.lines.map((l) =>
      l.text
        ? db.transcriptCue.updateMany({ where: { id: l.id, transcriptId: t.id }, data: { text: l.text, edited: true } })
        : db.transcriptCue.deleteMany({ where: { id: l.id, transcriptId: t.id } }),
    ),
    // the stored summary was written from the old text
    db.mediaTranscript.update({
      where: { id: t.id },
      data: { summaryTh: null, summaryEn: null, keyPointsTh: [], keyPointsEn: [], summaryError: null },
    }),
  ]);
  await kickTranscription();
  await recordActivity({
    viewer,
    action: "Corrected subtitles",
    targetType: "media",
    targetLabel: parsed.data.url.split("/").pop(),
    detail: `${parsed.data.lines.length} line(s)`,
  });
  revalidatePath("/lms", "layout");
  return { ok: true as const };
}
