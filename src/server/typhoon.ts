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

/** Requests per rolling minute, waited for rather than refused. */
function limiter(perMinute: number) {
  const recent: number[] = [];
  return async function slot() {
    for (;;) {
      const now = Date.now();
      while (recent.length && now - recent[0]! > 60_000) recent.shift();
      if (recent.length < perMinute) {
        recent.push(now);
        return;
      }
      await new Promise((r) => setTimeout(r, 60_000 - (now - recent[0]!) + 50));
    }
  };
}

const asrSlot = limiter(90); // a margin under the published 100
// OCR has no published figure on the free tier: stay well clear
const ocrSlot = limiter(Number(process.env.TYPHOON_OCR_PER_MINUTE || 20));

/** Speech in one short WAV clip → its text. */
export async function transcribeClip(wav: Buffer): Promise<string> {
  await asrSlot();
  const res = await typhoon().audio.transcriptions.create({
    file: await toFile(wav, "clip.wav", { type: "audio/wav" }),
    model: TYPHOON_ASR_MODEL,
  });
  return (res.text ?? "").replace(/\s+/g, " ").trim();
}

export const TYPHOON_OCR_MODEL = process.env.TYPHOON_OCR_MODEL || "typhoon-ocr-v1.5";

/** The prompt Typhoon OCR v1.5 is trained on; it is meant to be used as is. */
const OCR_PROMPT = `Extract all text from the image.


Instructions:
- Only return the clean Markdown.
- Do not include any explanation or extra text.
- You must include all information on the page.


Formatting Rules:
- Tables: Render tables using <table>...</table> in clean HTML format.
- Equations: Render equations using LaTeX syntax with inline ($...$) and block ($$...$$).
- Images/Charts/Diagrams: Wrap any clearly defined visual areas (e.g. charts, diagrams, pictures) in:


<figure>
Describe the image's main elements (people, objects, text), note any contextual clues (place, event, culture), mention visible text and its meaning, provide deeper analysis when relevant (especially for financial charts, graphs, or documents), comment on style or architecture if relevant, then give a concise overall summary. Describe in Thai.
</figure>


- Page Numbers: Wrap page numbers in <page_number>...</page_number> (e.g., <page_number>14</page_number>).
- Checkboxes: Use ☐ for unchecked and ☑ for checked boxes.
    `;

/** One page image (PNG) → its text as Markdown, pictures described in Thai. */
export async function ocrPage(png: Uint8Array): Promise<string> {
  await ocrSlot();
  const res = await typhoon().chat.completions.create(
    {
      model: TYPHOON_OCR_MODEL,
      max_tokens: 8000,
      temperature: 0.1,
      top_p: 0.6,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: OCR_PROMPT },
            { type: "image_url", image_url: { url: `data:image/png;base64,${Buffer.from(png).toString("base64")}` } },
          ],
        },
      ],
      // @ts-expect-error -- a Typhoon (vLLM) sampling option the OpenAI types do not list
      repetition_penalty: 1.1,
    },
    { timeout: 90_000 },
  );
  return res.choices[0]?.message?.content ?? "";
}
