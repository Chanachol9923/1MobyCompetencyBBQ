import { db } from "@/lib/db";
async function main() {
  const [c, s, ce, se, fixed] = await Promise.all([
    db.mediaTranscript.count({ where: { status: "READY", correctedAt: { not: null } } }),
    db.mediaTranscript.count({ where: { status: "READY", summaryTh: { not: null } } }),
    db.mediaTranscript.count({ where: { correctionError: { not: null } } }),
    db.mediaTranscript.count({ where: { summaryError: { not: null } } }),
    db.transcriptCue.count({ where: { rawText: { not: null } } }),
  ]);
  console.log(`corrected ${c}/35 summarized ${s}/35 corrErr ${ce} sumErr ${se} fixedLines ${fixed}`);
}
main().finally(() => process.exit(0));
