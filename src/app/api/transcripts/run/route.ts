import { after, NextResponse } from "next/server";
import { runTranscriptJobs } from "@/server/transcribe";

/**
 * The transcription runner. It answers straight away and does the work in the
 * background of this same call (up to `maxDuration`). When a long video needs
 * more time it hands over to a fresh call of itself, so any length finishes.
 *
 * Only the app itself (after an upload) and Vercel Cron (the daily safety
 * net) may call it: both sign with `Authorization: Bearer $CRON_SECRET`.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const self = new URL("/api/transcripts/run", process.env.APP_URL || request.url).toString();
  after(async () => {
    const { remaining } = await runTranscriptJobs(250_000);
    if (remaining) {
      await fetch(self, { method: "POST", headers: { authorization: `Bearer ${secret}` } }).catch(() => {});
    }
  });
  return NextResponse.json({ ok: true, started: true }, { status: 202 });
}

export const POST = handle;
// Vercel Cron calls with GET
export const GET = handle;
