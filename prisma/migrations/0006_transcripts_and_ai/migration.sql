-- CreateEnum
CREATE TYPE "TranscriptStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "MediaTranscript" (
    "id" TEXT NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "status" "TranscriptStatus" NOT NULL DEFAULT 'PENDING',
    "language" TEXT NOT NULL DEFAULT 'th',
    "durationSec" DOUBLE PRECISION,
    "cursorSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "summaryTh" TEXT,
    "summaryEn" TEXT,
    "keyPointsTh" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keyPointsEn" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "summaryError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MediaTranscript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptCue" (
    "id" TEXT NOT NULL,
    "transcriptId" TEXT NOT NULL,
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "edited" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TranscriptCue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiQuestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaTranscript_mediaUrl_key" ON "MediaTranscript"("mediaUrl");

-- CreateIndex
CREATE INDEX "MediaTranscript_status_updatedAt_idx" ON "MediaTranscript"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "TranscriptCue_transcriptId_startMs_idx" ON "TranscriptCue"("transcriptId", "startMs");

-- CreateIndex
CREATE INDEX "AiQuestion_userId_createdAt_idx" ON "AiQuestion"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "TranscriptCue" ADD CONSTRAINT "TranscriptCue_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "MediaTranscript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiQuestion" ADD CONSTRAINT "AiQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ------------------------------------------------------------ checks
ALTER TABLE "TranscriptCue"
  ADD CONSTRAINT "TranscriptCue_time_order" CHECK ("startMs" >= 0 AND "endMs" >= "startMs");

ALTER TABLE "MediaTranscript"
  ADD CONSTRAINT "MediaTranscript_cursor_nonneg" CHECK ("cursorSec" >= 0),
  ADD CONSTRAINT "MediaTranscript_ready_has_date" CHECK ("status" <> 'READY' OR "completedAt" IS NOT NULL);

ALTER TABLE "AiQuestion"
  ADD CONSTRAINT "AiQuestion_question_present" CHECK (length(btrim("question")) > 0);

-- ----------------------------------------------------- row-level security
ALTER TABLE "MediaTranscript" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TranscriptCue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AiQuestion" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON "MediaTranscript", "TranscriptCue", "AiQuestion" FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
