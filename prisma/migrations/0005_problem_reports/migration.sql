-- CreateEnum
CREATE TYPE "ProblemCategory" AS ENUM ('BUG', 'DATA', 'ACCESS', 'SUGGESTION', 'OTHER');

-- CreateEnum
CREATE TYPE "ProblemStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'FIXED');

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'PROBLEM';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "employeeId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ProblemReport" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "reporterId" TEXT NOT NULL,
    "category" "ProblemCategory" NOT NULL DEFAULT 'BUG',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pageUrl" TEXT,
    "userAgent" TEXT,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ProblemStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,
    "resolutionImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProblemReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemClaim" (
    "reportId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProblemClaim_pkey" PRIMARY KEY ("reportId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProblemReport_number_key" ON "ProblemReport"("number");

-- CreateIndex
CREATE INDEX "ProblemReport_status_createdAt_idx" ON "ProblemReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProblemReport_reporterId_createdAt_idx" ON "ProblemReport"("reporterId", "createdAt");

-- CreateIndex
CREATE INDEX "ProblemClaim_userId_idx" ON "ProblemClaim"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemReport" ADD CONSTRAINT "ProblemReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemReport" ADD CONSTRAINT "ProblemReport_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemClaim" ADD CONSTRAINT "ProblemClaim_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ProblemReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemClaim" ADD CONSTRAINT "ProblemClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ------------------------------------------------------------ checks
-- A notification has to reach someone: a staff record, an account, or both.
ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_has_recipient" CHECK ("employeeId" IS NOT NULL OR "userId" IS NOT NULL);

ALTER TABLE "ProblemReport"
  ADD CONSTRAINT "ProblemReport_title_present" CHECK (length(btrim("title")) > 0),
  ADD CONSTRAINT "ProblemReport_description_present" CHECK (length(btrim("description")) > 0),
  ADD CONSTRAINT "ProblemReport_attachments_max" CHECK (coalesce(array_length("attachments", 1), 0) <= 4),
  ADD CONSTRAINT "ProblemReport_evidence_max" CHECK (coalesce(array_length("resolutionImages", 1), 0) <= 4),
  -- fixed means someone said how, and when
  ADD CONSTRAINT "ProblemReport_fixed_is_explained" CHECK (
    "status" <> 'FIXED' OR ("resolvedAt" IS NOT NULL AND length(btrim(coalesce("resolutionNote", ''))) > 0)
  );

-- ------------------------------------------------------- the permission
-- Every holder of manage_problems sees and handles reports. Administrators
-- get it out of the box; the Roles page can hand it to anyone else.
INSERT INTO "Permission" ("id", "key", "nameEn", "nameTh", "category", "descEn", "descTh")
VALUES (
  'perm_manage_problems', 'manage_problems', 'Handle problem reports', 'จัดการปัญหาที่ผู้ใช้แจ้ง',
  'administration', 'See every report, claim it, and mark it fixed.', 'ดูรายงานปัญหาทั้งหมด รับเรื่อง และแจ้งว่าแก้ไขแล้ว'
)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r, "Permission" p
WHERE r."key" = 'admin' AND p."key" = 'manage_problems'
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------- row-level security
ALTER TABLE "ProblemReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProblemClaim" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON "ProblemReport", "ProblemClaim" FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON SEQUENCE "ProblemReport_number_seq" FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
