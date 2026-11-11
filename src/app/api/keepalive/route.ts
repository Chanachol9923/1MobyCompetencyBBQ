import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendDeadlineReminders } from "@/server/deadline-reminders";

/**
 * Keeps the Supabase project awake.
 *
 * Supabase pauses a free-plan project after a week without activity, and a
 * paused project takes the whole site down. Vercel Cron calls this once a day
 * (vercel.json): one small read through the database pooler and, when the
 * project URL and publishable key are configured, one request to Supabase's
 * own API — both count as activity.
 *
 * It also sends the day's in-app deadline reminders (IDP goals and assigned
 * courses, 7 days and 1 day before): the free plan's two crons are both in
 * use, so the daily job rides on this one. A failure there is reported but
 * does not fail the keep-alive.
 *
 * Vercel signs cron calls with `Authorization: Bearer $CRON_SECRET`; anything
 * without it is refused, so the route cannot be used to hammer the database.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const started = Date.now();
  const result: Record<string, unknown> = {};

  try {
    const rows = await db.$queryRaw<{ n: number }[]>`select count(*)::int as n from "Role"`;
    result.database = { ok: true, roles: rows[0]?.n ?? 0 };
  } catch (err) {
    result.database = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (url && key) {
    try {
      const res = await fetch(`${url.replace(/\/+$/, "")}/auth/v1/health`, {
        headers: { apikey: key },
        cache: "no-store",
      });
      result.api = { ok: res.ok, status: res.status };
    } catch (err) {
      result.api = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  try {
    result.reminders = { ok: true, ...(await sendDeadlineReminders()) };
  } catch (err) {
    result.reminders = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const ok = (result.database as { ok: boolean }).ok;
  return NextResponse.json({ ok, ms: Date.now() - started, ...result }, { status: ok ? 200 : 503 });
}
