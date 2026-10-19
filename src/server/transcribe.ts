import "server-only";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { db } from "@/lib/db";
import { transcribeClip, typhoonConfigured } from "@/server/typhoon";
import { correctTranscript, summarizeTranscript } from "@/server/study-ai";
import { runDocumentJobs } from "@/server/pdf-text";

/**
 * Turns a video's speech into timed subtitle lines, once per file.
 *
 * Typhoon's transcription API returns text without timestamps, so the timing
 * comes from here: ffmpeg pulls the audio a window at a time straight from the
 * file's URL, finds the pauses, and the speech between pauses — 8 to 18
 * seconds, a comfortable subtitle — is sent as its own clip. Each clip's text
 * keeps the clip's start and end.
 *
 * The cursor is saved after every window, so a long video is finished over as
 * many runs as it needs and a crash costs at most one window.
 */

const WINDOW_SEC = 300;
const MIN_CUE = 8;
const TARGET_CUE = 13;
const MAX_CUE = 18;
const RATE = 16_000; // Hz, mono, 16-bit
const PARALLEL = 4;
const LOCK_MS = 6 * 60_000;
const MAX_ATTEMPTS = 3;

/* ---------------------------------------------------------------- ffmpeg */

function run(args: string[]): Promise<{ out: Buffer; err: string; code: number }> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("ffmpeg is not available on this server."));
    const p = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let err = "";
    p.stdout.on("data", (d: Buffer) => out.push(d));
    p.stderr.on("data", (d: Buffer) => {
      err += d.toString();
      if (err.length > 200_000) err = err.slice(-100_000);
    });
    p.on("error", reject);
    p.on("close", (code) => resolve({ out: Buffer.concat(out), err, code: code ?? 0 }));
  });
}

/** Length of the media in seconds, read from ffmpeg's banner. */
async function probeDuration(url: string): Promise<number> {
  const { err } = await run(["-hide_banner", "-i", url]);
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(err);
  if (!m) throw new Error("Could not read the video's length.");
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

type Silence = { start: number; end: number };

/** Raw 16 kHz mono PCM for one window, and where it goes quiet. */
async function readWindow(url: string, start: number, length: number) {
  const { out, err } = await run([
    "-hide_banner",
    "-nostats",
    "-ss", String(start),
    "-t", String(length),
    "-i", url,
    "-vn",
    "-ac", "1",
    "-ar", String(RATE),
    "-af", "silencedetect=noise=-30dB:d=0.25",
    "-f", "s16le",
    "pipe:1",
  ]);
  const silences: Silence[] = [];
  let open: number | null = null;
  for (const line of err.split("\n")) {
    const s = /silence_start:\s*(-?[\d.]+)/.exec(line);
    if (s) open = Math.max(0, Number(s[1]));
    const e = /silence_end:\s*([\d.]+)/.exec(line);
    if (e) {
      silences.push({ start: open ?? 0, end: Number(e[1]) });
      open = null;
    }
  }
  if (open !== null) silences.push({ start: open, end: out.length / 2 / RATE });
  return { pcm: out, silences };
}

/**
 * The quietest 40 ms between two points — where to cut when there is no clear
 * pause (music under the voice, a fast speaker), so a word is not split.
 */
function quietestPoint(pcm: Buffer, from: number, to: number): number {
  const frame = Math.round(RATE * 0.04);
  let best = (from + to) / 2;
  let bestEnergy = Infinity;
  for (let start = Math.floor(from * RATE); start + frame < Math.floor(to * RATE); start += frame) {
    let e = 0;
    for (let i = start; i < start + frame; i++) {
      const at = i * 2;
      if (at + 1 >= pcm.length) break;
      const v = pcm.readInt16LE(at);
      e += v * v;
    }
    if (e < bestEnergy) {
      bestEnergy = e;
      best = (start + frame / 2) / RATE;
    }
  }
  return best;
}

/** Where to cut a window: in the middle of a pause, about every 13 seconds. */
function planCuts(length: number, silences: Silence[], pcm: Buffer): [number, number][] {
  const mids = silences.map((s) => (s.start + s.end) / 2);
  const cuts: [number, number][] = [];
  let at = 0;
  while (length - at > 0.5) {
    if (length - at <= MAX_CUE) {
      cuts.push([at, length]);
      break;
    }
    const candidates = mids.filter((m) => m >= at + MIN_CUE && m <= at + MAX_CUE);
    const next = candidates.length
      ? candidates.reduce((a, b) => (Math.abs(b - (at + TARGET_CUE)) < Math.abs(a - (at + TARGET_CUE)) ? b : a))
      : quietestPoint(pcm, at + MIN_CUE + 2, at + MAX_CUE);
    cuts.push([at, next]);
    at = next;
  }
  return cuts;
}

/** Is anyone speaking in this stretch at all? */
function hasSound(pcm: Buffer) {
  let sum = 0;
  const n = pcm.length / 2;
  for (let i = 0; i < pcm.length; i += 2) {
    const v = pcm.readInt16LE(i);
    sum += v * v;
  }
  return n > 0 && Math.sqrt(sum / n) > 300;
}

function wav(pcm: Buffer) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function inParallel<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

/* ------------------------------------------------------------------ jobs */

/** Ask for a file to be transcribed. A file that already has one is left be. */
export async function enqueueTranscript(mediaUrl: string) {
  await db.mediaTranscript.upsert({
    where: { mediaUrl },
    create: { mediaUrl },
    update: {},
  });
}

/** Start again from nothing — hand-corrected lines are lost too. */
export async function resetTranscript(mediaUrl: string) {
  await db.$transaction(async (tx) => {
    const t = await tx.mediaTranscript.upsert({ where: { mediaUrl }, create: { mediaUrl }, update: {} });
    await tx.transcriptCue.deleteMany({ where: { transcriptId: t.id } });
    await tx.mediaTranscript.update({
      where: { id: t.id },
      data: {
        status: "PENDING",
        cursorSec: 0,
        attempts: 0,
        error: null,
        lockedUntil: null,
        completedAt: null,
        summaryTh: null,
        summaryEn: null,
        keyPointsTh: [],
        keyPointsEn: [],
        summaryError: null,
        correctedAt: null,
        correctionError: null,
      },
    });
  });
}

/**
 * Check the subtitles again (the course glossary changed, say): the AI pass
 * re-runs from what was heard, then the summary is rewritten.
 */
export async function recheckTranscripts(urls: string[]) {
  if (!urls.length) return;
  await db.mediaTranscript.updateMany({
    where: { mediaUrl: { in: urls } },
    data: {
      correctedAt: null,
      correctionError: null,
      summaryTh: null,
      summaryEn: null,
      keyPointsTh: [],
      keyPointsEn: [],
      summaryError: null,
    },
  });
}

/** A file is gone: its transcript goes with it. */
export async function dropTranscripts(urls: string[]) {
  if (urls.length) await db.mediaTranscript.deleteMany({ where: { mediaUrl: { in: urls } } });
}

/** Take the next job no other runner holds. */
async function claim() {
  const now = new Date();
  const candidates = await db.mediaTranscript.findMany({
    where: {
      status: { in: ["PENDING", "PROCESSING"] },
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: 3,
    select: { id: true },
  });
  for (const c of candidates) {
    const got = await db.mediaTranscript.updateMany({
      where: { id: c.id, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
      data: { status: "PROCESSING", lockedUntil: new Date(Date.now() + LOCK_MS) },
    });
    if (got.count) return db.mediaTranscript.findUniqueOrThrow({ where: { id: c.id } });
  }
  return null;
}

/** Ready transcripts whose words have not been checked yet. */
async function claimCorrection() {
  return db.mediaTranscript.findFirst({
    where: { status: "READY", correctedAt: null, correctionError: null },
    orderBy: { completedAt: "asc" },
    select: { id: true },
  });
}

/**
 * Ready transcripts that still have no summary (the summary step failed or
 * never ran). The summary waits for the correction pass, so it is written
 * from the fixed words.
 */
async function claimSummary() {
  return db.mediaTranscript.findFirst({
    where: {
      status: "READY",
      summaryTh: null,
      summaryError: null,
      OR: [{ correctedAt: { not: null } }, { correctionError: { not: null } }],
    },
    orderBy: { completedAt: "asc" },
    select: { id: true },
  });
}

/**
 * Work through the queue until the time budget runs out. Returns whether work
 * is left, so the caller can hand over to a fresh run.
 */
export async function runTranscriptJobs(budgetMs: number): Promise<{ remaining: boolean; done: number }> {
  if (!typhoonConfigured()) return { remaining: false, done: 0 };
  const stopAt = Date.now() + budgetMs;
  let done = 0;

  while (Date.now() < stopAt - 45_000) {
    const job = await claim();
    if (!job) break;
    try {
      const duration = job.durationSec ?? (await probeDuration(job.mediaUrl));
      if (job.durationSec == null) {
        await db.mediaTranscript.update({ where: { id: job.id }, data: { durationSec: duration } });
      }
      let cursor = job.cursorSec;

      while (cursor < duration - 0.5 && Date.now() < stopAt - 45_000) {
        const length = Math.min(WINDOW_SEC, duration - cursor);
        const { pcm, silences } = await readWindow(job.mediaUrl, cursor, length);
        const realLength = pcm.length / 2 / RATE;
        const clips = planCuts(realLength, silences, pcm).map(([a, b]) => ({
          a,
          b,
          pcm: pcm.subarray(Math.floor(a * RATE) * 2, Math.floor(b * RATE) * 2),
        }));
        const texts = await inParallel(clips, PARALLEL, (c) =>
          hasSound(c.pcm) ? transcribeClip(wav(c.pcm)) : Promise.resolve(""),
        );
        const cues = clips
          .map((c, i) => ({
            transcriptId: job.id,
            startMs: Math.round((cursor + c.a) * 1000),
            endMs: Math.round((cursor + c.b) * 1000),
            text: texts[i] ?? "",
          }))
          .filter((c) => c.text);

        const from = Math.round(cursor * 1000);
        const nextCursor = realLength > 0 ? cursor + Math.min(length, realLength) : duration;
        await db.$transaction([
          // a window that was half-written by a run that died is replaced, never doubled
          db.transcriptCue.deleteMany({
            where: { transcriptId: job.id, edited: false, startMs: { gte: from, lt: Math.round(nextCursor * 1000) } },
          }),
          db.transcriptCue.createMany({ data: cues }),
          db.mediaTranscript.update({
            where: { id: job.id },
            data: { cursorSec: nextCursor, lockedUntil: new Date(Date.now() + LOCK_MS) },
          }),
        ]);
        cursor = nextCursor;
      }

      if (cursor >= duration - 0.5) {
        await db.mediaTranscript.update({
          where: { id: job.id },
          data: { status: "READY", completedAt: new Date(), lockedUntil: null, error: null },
        });
        done++;
        await correctTranscript(job.id).catch(() => {});
        await summarizeTranscript(job.id).catch(() => {});
      } else {
        // out of time mid-video: release it for the next run
        await db.mediaTranscript.update({ where: { id: job.id }, data: { lockedUntil: null } });
        return { remaining: true, done };
      }
    } catch (err) {
      const attempts = job.attempts + 1;
      await db.mediaTranscript.update({
        where: { id: job.id },
        data: {
          attempts,
          status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
          error: err instanceof Error ? err.message.slice(0, 500) : "Transcription failed.",
          lockedUntil: null,
        },
      });
    }
  }

  // PDFs waiting to be read
  const documentsLeft = await runDocumentJobs(stopAt).catch((err) => {
    console.error("document jobs failed", err);
    return false;
  });

  // corrections, then summaries, that are still missing
  while (Date.now() < stopAt - 30_000) {
    const c = await claimCorrection();
    if (!c) break;
    await correctTranscript(c.id).catch(() => {});
  }
  while (Date.now() < stopAt - 30_000) {
    const s = await claimSummary();
    if (!s) break;
    await summarizeTranscript(s.id).catch(() => {});
  }

  const left = await db.mediaTranscript.count({
    where: {
      OR: [
        { status: { in: ["PENDING", "PROCESSING"] }, attempts: { lt: MAX_ATTEMPTS } },
        { status: "READY", correctedAt: null, correctionError: null },
        { status: "READY", summaryTh: null, summaryError: null },
      ],
    },
  });
  return { remaining: left > 0 || documentsLeft, done };
}
