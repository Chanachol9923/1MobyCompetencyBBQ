-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "glossary" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "MediaTranscript" ADD COLUMN     "correctedAt" TIMESTAMP(3),
ADD COLUMN     "correctionError" TEXT;

-- AlterTable
ALTER TABLE "TranscriptCue" ADD COLUMN     "rawText" TEXT;

