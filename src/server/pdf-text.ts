import "server-only";
import { db } from "@/lib/db";
import { ocrPage, typhoonConfigured } from "@/server/typhoon";

/**
 * Reads PDFs into text, once per file, for the study assistant.
 *
 * Every page is rendered to an image and read by Typhoon OCR, which keeps
 * tables, reads scanned pages and describes charts and pictures in Thai. The
 * PDF's own text layer is the fallback for a page OCR could not read. The
 * cursor is saved after every page, so a long document is finished over as many
 * runs as it needs.
 */

const LOCK_MS = 6 * 60_000;
const MAX_ATTEMPTS = 3;
const PARALLEL = 2;
/** Rendered page width: enough for small print, small enough to send quickly. */
const RENDER_WIDTH = 1400;

export async function enqueueDocumentText(fileUrl: string) {
  await db.documentText.upsert({ where: { fileUrl }, create: { fileUrl }, update: {} });
}

/** Read the file again from scratch. */
export async function resetDocumentText(fileUrl: string) {
  await db.documentText.upsert({
    where: { fileUrl },
    create: { fileUrl },
    update: {
      status: "PENDING",
      cursorPage: 0,
      attempts: 0,
      error: null,
      lockedUntil: null,
      completedAt: null,
      pages: { deleteMany: {} },
    },
  });
}

/** Take the next job no other runner holds. */
async function claim() {
  const now = new Date();
  const candidates = await db.documentText.findMany({
    where: {
      status: { in: ["PENDING", "PROCESSING"] },
      attempts: { lt: MAX_ATTEMPTS },
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: 3,
    select: { id: true },
  });
  for (const c of candidates) {
    const got = await db.documentText.updateMany({
      where: { id: c.id, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
      data: { status: "PROCESSING", lockedUntil: new Date(Date.now() + LOCK_MS) },
    });
    if (got.count) return db.documentText.findUniqueOrThrow({ where: { id: c.id } });
  }
  return null;
}

/** OCR's Markdown, minus what only matters on paper. */
function tidy(markdown: string) {
  return markdown
    .replace(/<page_number>[\s\S]*?<\/page_number>/g, "")
    .replace(/<\/?figure>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Work through PDF jobs until `stopAt`. Returns whether a job was left
 * unfinished, so the caller can hand over to a fresh run.
 */
export async function runDocumentJobs(stopAt: number): Promise<boolean> {
  if (!typhoonConfigured()) return false;
  // pdf.js is heavy: loaded only when there is a PDF to read
  const { getDocumentProxy, extractText, renderPageAsImage } = await import("unpdf");

  while (Date.now() < stopAt - 40_000) {
    const job = await claim();
    if (!job) return false;
    try {
      const res = await fetch(job.fileUrl);
      if (!res.ok) throw new Error(`The file could not be downloaded (${res.status}).`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      // pdf.js takes ownership of the buffer it is given: each use gets a copy
      const pdf = await getDocumentProxy(bytes.slice());
      const { totalPages, text: layer } = await extractText(pdf, { mergePages: false });
      if (job.pageCount !== totalPages) {
        await db.documentText.update({ where: { id: job.id }, data: { pageCount: totalPages } });
      }

      let page = job.cursorPage;
      while (page < totalPages && Date.now() < stopAt - 40_000) {
        const batch = Array.from({ length: Math.min(PARALLEL, totalPages - page) }, (_, i) => page + i + 1);
        const read = await Promise.all(
          batch.map(async (n) => {
            const fallback = (layer[n - 1] ?? "").replace(/[ \t]+/g, " ").trim();
            try {
              const png = await renderPageAsImage(bytes.slice(), n, {
                canvasImport: () => import("@napi-rs/canvas"),
                width: RENDER_WIDTH,
              });
              const text = tidy(await ocrPage(new Uint8Array(png)));
              if (text) return { page: n, text, source: "ocr" };
            } catch (err) {
              console.error(`OCR failed on page ${n} of ${job.fileUrl}`, err);
            }
            return { page: n, text: fallback, source: "text" };
          }),
        );
        const next = batch.at(-1)!;
        await db.$transaction([
          ...read.map((r) =>
            db.documentPageText.upsert({
              where: { documentTextId_page: { documentTextId: job.id, page: r.page } },
              create: { documentTextId: job.id, ...r },
              update: { text: r.text, source: r.source },
            }),
          ),
          db.documentText.update({
            where: { id: job.id },
            data: { cursorPage: next, lockedUntil: new Date(Date.now() + LOCK_MS) },
          }),
        ]);
        page = next;
      }

      if (page >= totalPages) {
        await db.documentText.update({
          where: { id: job.id },
          data: { status: "READY", completedAt: new Date(), lockedUntil: null, error: null },
        });
      } else {
        // out of time mid-document: release it for the next run
        await db.documentText.update({ where: { id: job.id }, data: { lockedUntil: null } });
        return true;
      }
    } catch (err) {
      const attempts = job.attempts + 1;
      await db.documentText.update({
        where: { id: job.id },
        data: {
          attempts,
          status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
          error: err instanceof Error ? err.message.slice(0, 500) : "Reading the PDF failed.",
          lockedUntil: null,
        },
      });
    }
  }
  return db.documentText
    .count({ where: { status: { in: ["PENDING", "PROCESSING"] }, attempts: { lt: MAX_ATTEMPTS } } })
    .then((n) => n > 0);
}
