import "server-only";
import { after } from "next/server";
import { headers } from "next/headers";

/**
 * Start the transcription runner in its own function call, after the current
 * response has gone out — so saving a chapter never waits on transcription.
 * The runner answers at once and works in the background of that call.
 */
export async function kickTranscription() {
  const secret = process.env.CRON_SECRET;
  if (!secret || !process.env.TYPHOON_API_KEY) return;
  const origin = process.env.APP_URL || (await originFromRequest());
  if (!origin) return;
  after(async () => {
    await fetch(`${origin}/api/transcripts/run`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    }).catch(() => {});
  });
}

async function originFromRequest() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return null;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
