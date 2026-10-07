-- Shorts (vertical video feed), a PDF library, and real media on course chapters.

ALTER TABLE "Chapter" ADD COLUMN     "mediaBytes" INTEGER,
ADD COLUMN     "mediaUrl" TEXT;

CREATE TABLE "ShortVideo" (
    "id" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleTh" TEXT,
    "captionEn" TEXT,
    "captionTh" TEXT,
    "videoUrl" TEXT NOT NULL,
    "posterUrl" TEXT,
    "videoBytes" INTEGER NOT NULL DEFAULT 0,
    "durationSec" INTEGER NOT NULL,
    "competencyId" TEXT,
    "courseId" TEXT,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShortVideo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShortView" (
    "id" TEXT NOT NULL,
    "shortId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "liked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ShortView_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LearningDocument" (
    "id" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleTh" TEXT,
    "descriptionEn" TEXT,
    "descriptionTh" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileBytes" INTEGER NOT NULL DEFAULT 0,
    "pages" INTEGER NOT NULL,
    "competencyId" TEXT,
    "courseId" TEXT,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentRead" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "lastPage" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentRead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShortVideo_status_publishedAt_idx" ON "ShortVideo"("status", "publishedAt");

CREATE INDEX "ShortVideo_competencyId_idx" ON "ShortVideo"("competencyId");

CREATE INDEX "ShortView_employeeId_idx" ON "ShortView"("employeeId");

CREATE UNIQUE INDEX "ShortView_shortId_employeeId_key" ON "ShortView"("shortId", "employeeId");

CREATE INDEX "LearningDocument_status_publishedAt_idx" ON "LearningDocument"("status", "publishedAt");

CREATE INDEX "LearningDocument_competencyId_idx" ON "LearningDocument"("competencyId");

CREATE INDEX "DocumentRead_employeeId_idx" ON "DocumentRead"("employeeId");

CREATE UNIQUE INDEX "DocumentRead_documentId_employeeId_key" ON "DocumentRead"("documentId", "employeeId");

ALTER TABLE "ShortVideo" ADD CONSTRAINT "ShortVideo_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShortVideo" ADD CONSTRAINT "ShortVideo_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShortView" ADD CONSTRAINT "ShortView_shortId_fkey" FOREIGN KEY ("shortId") REFERENCES "ShortVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShortView" ADD CONSTRAINT "ShortView_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LearningDocument" ADD CONSTRAINT "LearningDocument_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LearningDocument" ADD CONSTRAINT "LearningDocument_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DocumentRead" ADD CONSTRAINT "DocumentRead_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LearningDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentRead" ADD CONSTRAINT "DocumentRead_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ------------------------------------------------------------------ checks
ALTER TABLE "ShortVideo"
  ADD CONSTRAINT "ShortVideo_duration_range" CHECK ("durationSec" BETWEEN 1 AND 600),
  ADD CONSTRAINT "ShortVideo_bytes_nonneg" CHECK ("videoBytes" >= 0),
  ADD CONSTRAINT "ShortVideo_published_has_date" CHECK ("status" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL);

ALTER TABLE "LearningDocument"
  ADD CONSTRAINT "LearningDocument_pages_positive" CHECK ("pages" > 0),
  ADD CONSTRAINT "LearningDocument_bytes_nonneg" CHECK ("fileBytes" >= 0),
  ADD CONSTRAINT "LearningDocument_published_has_date" CHECK ("status" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL);

ALTER TABLE "DocumentRead"
  ADD CONSTRAINT "DocumentRead_lastPage_positive" CHECK ("lastPage" > 0);

ALTER TABLE "Chapter"
  ADD CONSTRAINT "Chapter_mediaBytes_nonneg" CHECK ("mediaBytes" IS NULL OR "mediaBytes" >= 0);

-- --------------------------------------------------------- one-off points
-- Finishing a short or a document pays out once, even if two requests race.
DROP INDEX IF EXISTS "PointLedger_award_once";
CREATE UNIQUE INDEX "PointLedger_award_once"
  ON "PointLedger" ("employeeId", "refType", "refId")
  WHERE "refType" IN ('Assessment', 'Course', 'CourseCertificate', 'LearningPath', 'Short', 'Document');

-- ----------------------------------------------------- row-level security
-- Same as every other table: closed to Supabase's public REST API.
ALTER TABLE "ShortVideo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShortView" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LearningDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentRead" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON "ShortVideo", "ShortView", "LearningDocument", "DocumentRead" FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
