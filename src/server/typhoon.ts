import "server-only";
import OpenAI, { toFile } from "openai";

/**
 * Typhoon (SCB 10X), the Thai models behind subtitles and the study
 * assistant. Its API speaks the OpenAI wire format, so the OpenAI SDK is only
 * the transport here — every request goes to api.opentyphoon.ai.
 *
 * The free tier allows 100 transcriptions and 200 chat requests a minute; the
 * limiter below keeps transcription under that so a long video never trips
 * a wave of 429s.
 */

export const TYPHOON_CHAT_MODEL = process.env.TYPHOON_CHAT_MODEL || "typhoon-v2.5-30b-a3b-instruct";
export const TYPHOON_ASR_MODEL = process.env.TYPHOON_ASR_MODEL || "typhoon-asr-realtime";

export const typhoonConfigured = () => Boolean(process.env.TYPHOON_API_KEY);

let client: OpenAI | null = null;
export function typhoon() {
  const apiKey = process.env.TYPHOON_API_KEY;
  if (!apiKey) throw new Error("TYPHOON_API_KEY is not set.");
  client ??= new OpenAI({
    apiKey,
    baseURL: process.env.TYPHOON_BASE_URL || "https://api.opentyphoon.ai/v1",
    maxRetries: 4,
    timeout: 60_000,
  });
  return client;
}

/* ---------------------------------------------------------- rate limiter */

const ASR_PER_MINUTE = 90; // a margin under the published 100
const recent: number[] = [];

async function asrSlot() {
  for (;;) {
    const now = Date.now();
    while (recent.length && now - recent[0]! > 60_000) recent.shift();
    if (recent.length < ASR_PER_MINUTE) {
      recent.push(now);
      return;
    }
    await new Promise((r) => setTimeout(r, 60_000 - (now - recent[0]!) + 50));
  }
}

/** Speech in one short WAV clip → its text. */
export async function transcribeClip(wav: Buffer): Promise<string> {
  await asrSlot();
  const res = await typhoon().audio.transcriptions.create({
    file: await toFile(wav, "clip.wav", { type: "audio/wav" }),
    model: TYPHOON_ASR_MODEL,
  });
  return (res.text ?? "").replace(/\s+/g, " ").trim();
}
