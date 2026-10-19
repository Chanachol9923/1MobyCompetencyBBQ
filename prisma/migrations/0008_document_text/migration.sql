-- CreateTable
CREATE TABLE "DocumentText" (
    "id" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "status" "TranscriptStatus" NOT NULL DEFAULT 'PENDING',
    "pageCount" INTEGER,
    "cursorPage" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DocumentText_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentPageText" (
    "id" TEXT NOT NULL,
    "documentTextId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "source" TEXT NOT NULL,

    CONSTRAINT "DocumentPageText_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentText_fileUrl_key" ON "DocumentText"("fileUrl");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentPageText_documentTextId_page_key" ON "DocumentPageText"("documentTextId", "page");

-- AddForeignKey
ALTER TABLE "DocumentPageText" ADD CONSTRAINT "DocumentPageText_documentTextId_fkey" FOREIGN KEY ("documentTextId") REFERENCES "DocumentText"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- integrity the schema language cannot express
ALTER TABLE "DocumentText"
  ADD CONSTRAINT "DocumentText_cursor_nonneg" CHECK ("cursorPage" >= 0),
  ADD CONSTRAINT "DocumentText_ready_has_date" CHECK ("status" <> 'READY' OR "completedAt" IS NOT NULL);
ALTER TABLE "DocumentPageText"
  ADD CONSTRAINT "DocumentPageText_page_positive" CHECK ("page" >= 1),
  ADD CONSTRAINT "DocumentPageText_source_known" CHECK ("source" IN ('ocr', 'text'));

-- the app reaches these through the server only
ALTER TABLE "DocumentText" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentPageText" ENABLE ROW LEVEL SECURITY;
