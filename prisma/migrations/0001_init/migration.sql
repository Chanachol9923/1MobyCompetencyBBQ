-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AccessTokenPurpose" AS ENUM ('ACTIVATE', 'RESET');

-- CreateEnum
CREATE TYPE "CompetencyGroup" AS ENUM ('CORE', 'FUNCTIONAL', 'MANAGERIAL');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('DRAFT', 'OPEN', 'REVIEW', 'CLOSED');

-- CreateEnum
CREATE TYPE "AssessmentMode" AS ENUM ('SELF', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "DevelopmentActivity" AS ENUM ('ONLINE_COURSE', 'COACHING', 'ON_THE_JOB');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('CERTIFICATE', 'LINK', 'NOTE');

-- CreateEnum
CREATE TYPE "CourseCategory" AS ENUM ('CORE', 'FUNCTIONAL', 'MANAGERIAL');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ChapterKind" AS ENUM ('VIDEO', 'PDF', 'ARTICLE');

-- CreateEnum
CREATE TYPE "TestKind" AS ENUM ('PRE', 'POST');

-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('PREPARING', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AnnouncementAudience" AS ENUM ('ALL', 'DEPARTMENT', 'DIVISION', 'JOB_ROLE', 'PERSON');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'BOTH');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('ASSESSMENT', 'IDP', 'LMS', 'REWARD', 'ANNOUNCEMENT', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "roleId" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "passwordHash" TEXT,
    "passwordSetAt" TIMESTAMP(3),
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "AccessTokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "descEn" TEXT,
    "descTh" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Division" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "Division_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRole" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "levelRank" INTEGER NOT NULL,
    "gradeFrom" TEXT NOT NULL,
    "gradeTo" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "JobRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "nameTh" TEXT,
    "nickname" TEXT,
    "email" TEXT NOT NULL,
    "grade" TEXT,
    "businessUnit" TEXT,
    "remark" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT,
    "jobRoleId" TEXT NOT NULL,
    "departmentId" TEXT,
    "divisionId" TEXT,
    "positionId" TEXT,
    "managerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competency" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "group" "CompetencyGroup" NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameTh" TEXT,
    "definitionEn" TEXT,
    "definitionTh" TEXT,
    "subTh" TEXT,
    "indicatorsEn" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Competency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetencyLevel" (
    "id" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "labelEn" TEXT NOT NULL,
    "labelTh" TEXT NOT NULL,
    "descTh" TEXT,
    "descEn" TEXT,
    "behaviorTh" TEXT,
    "behaviorEn" TEXT,

    CONSTRAINT "CompetencyLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpectedLevel" (
    "jobRoleId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "level" INTEGER,

    CONSTRAINT "ExpectedLevel_pkey" PRIMARY KEY ("jobRoleId","competencyId")
);

-- CreateTable
CREATE TABLE "AssessmentCycle" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "CycleStatus" NOT NULL DEFAULT 'OPEN',
    "weightKpi" INTEGER NOT NULL DEFAULT 40,
    "weightCore" INTEGER NOT NULL DEFAULT 20,
    "weightFunctional" INTEGER NOT NULL DEFAULT 25,
    "weightManagerial" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "mode" "AssessmentMode" NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentScore" (
    "assessmentId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,

    CONSTRAINT "AssessmentScore_pkey" PRIMARY KEY ("assessmentId","competencyId")
);

-- CreateTable
CREATE TABLE "KpiItem" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "score" INTEGER,

    CONSTRAINT "KpiItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdpGoal" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "courseId" TEXT,
    "fromLevel" INTEGER NOT NULL,
    "toLevel" INTEGER NOT NULL,
    "activity" "DevelopmentActivity" NOT NULL DEFAULT 'ONLINE_COURSE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "remark" TEXT,
    "manualProgress" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdpGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalEvidence" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "kind" "EvidenceKind" NOT NULL,
    "label" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachingNote" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachingNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleTh" TEXT,
    "descriptionEn" TEXT,
    "descriptionTh" TEXT,
    "category" "CourseCategory" NOT NULL,
    "competencyId" TEXT,
    "hours" INTEGER NOT NULL DEFAULT 0,
    "cover" TEXT,
    "status" "PublishStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "kind" "ChapterKind" NOT NULL DEFAULT 'VIDEO',
    "titleEn" TEXT NOT NULL,
    "titleTh" TEXT,
    "summaryEn" TEXT,
    "summaryTh" TEXT,
    "bulletsEn" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bulletsTh" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bodyEn" TEXT,
    "bodyTh" TEXT,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "pages" INTEGER,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChapterProgress" (
    "enrollmentId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChapterProgress_pkey" PRIMARY KEY ("enrollmentId","chapterId")
);

-- CreateTable
CREATE TABLE "TestResult" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "kind" "TestKind" NOT NULL,
    "score" INTEGER NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningPath" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleTh" TEXT,
    "descriptionEn" TEXT,
    "descriptionTh" TEXT,
    "targetLevel" TEXT,
    "audience" TEXT,
    "cover" TEXT,
    "status" "PublishStatus" NOT NULL DEFAULT 'PUBLISHED',
    "projectTitleEn" TEXT,
    "projectTitleTh" TEXT,
    "projectBriefEn" TEXT,
    "projectBriefTh" TEXT,
    "projectDeliverableEn" TEXT,
    "projectDeliverableTh" TEXT,
    "projectPoints" INTEGER NOT NULL DEFAULT 150,

    CONSTRAINT "LearningPath_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningPathStep" (
    "id" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "LearningPathStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PathCompletion" (
    "id" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "deliverable" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PathCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "courseId" TEXT,
    "pathId" TEXT,
    "titleEn" TEXT NOT NULL,
    "titleTh" TEXT,
    "score" INTEGER,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "code" TEXT NOT NULL,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameTh" TEXT,
    "requirementEn" TEXT,
    "requirementTh" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "tone" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "target" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeBadge" (
    "employeeId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeBadge_pkey" PRIMARY KEY ("employeeId","badgeId")
);

-- CreateTable
CREATE TABLE "PointLedger" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameTh" TEXT,
    "points" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "image" TEXT,
    "tone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Redemption" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'PREPARING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Redemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleTh" TEXT,
    "bodyEn" TEXT NOT NULL,
    "bodyTh" TEXT,
    "audience" "AnnouncementAudience" NOT NULL DEFAULT 'ALL',
    "audienceRef" TEXT,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "publishAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementRead" (
    "announcementId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementRead_pkey" PRIMARY KEY ("announcementId","employeeId")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL DEFAULT 'SYSTEM',
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "titleEn" TEXT NOT NULL,
    "titleTh" TEXT,
    "bodyEn" TEXT,
    "bodyTh" TEXT,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRule" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorLabel" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "targetLabel" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AccessToken_tokenHash_key" ON "AccessToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AccessToken_userId_purpose_idx" ON "AccessToken"("userId", "purpose");

-- CreateIndex
CREATE INDEX "AccessToken_expiresAt_idx" ON "AccessToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE INDEX "Division_departmentId_idx" ON "Division"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Division_departmentId_name_key" ON "Division"("departmentId", "name");

-- CreateIndex
CREATE INDEX "Position_departmentId_idx" ON "Position"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Position_name_departmentId_key" ON "Position"("name", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "JobRole_key_key" ON "JobRole"("key");

-- CreateIndex
CREATE UNIQUE INDEX "JobRole_name_key" ON "JobRole"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE INDEX "Employee_managerId_idx" ON "Employee"("managerId");

-- CreateIndex
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");

-- CreateIndex
CREATE INDEX "Employee_divisionId_idx" ON "Employee"("divisionId");

-- CreateIndex
CREATE INDEX "Employee_jobRoleId_idx" ON "Employee"("jobRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "Competency_key_key" ON "Competency"("key");

-- CreateIndex
CREATE INDEX "Competency_group_idx" ON "Competency"("group");

-- CreateIndex
CREATE UNIQUE INDEX "CompetencyLevel_competencyId_score_key" ON "CompetencyLevel"("competencyId", "score");

-- CreateIndex
CREATE INDEX "ExpectedLevel_competencyId_idx" ON "ExpectedLevel"("competencyId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentCycle_key_key" ON "AssessmentCycle"("key");

-- CreateIndex
CREATE INDEX "Assessment_subjectId_mode_idx" ON "Assessment"("subjectId", "mode");

-- CreateIndex
CREATE INDEX "Assessment_reviewerId_idx" ON "Assessment"("reviewerId");

-- CreateIndex
CREATE INDEX "Assessment_cycleId_submittedAt_idx" ON "Assessment"("cycleId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_cycleId_subjectId_reviewerId_mode_key" ON "Assessment"("cycleId", "subjectId", "reviewerId", "mode");

-- CreateIndex
CREATE INDEX "AssessmentScore_competencyId_idx" ON "AssessmentScore"("competencyId");

-- CreateIndex
CREATE INDEX "KpiItem_cycleId_employeeId_idx" ON "KpiItem"("cycleId", "employeeId");

-- CreateIndex
CREATE INDEX "IdpGoal_employeeId_idx" ON "IdpGoal"("employeeId");

-- CreateIndex
CREATE INDEX "IdpGoal_competencyId_idx" ON "IdpGoal"("competencyId");

-- CreateIndex
CREATE INDEX "IdpGoal_courseId_idx" ON "IdpGoal"("courseId");

-- CreateIndex
CREATE INDEX "GoalEvidence_goalId_idx" ON "GoalEvidence"("goalId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachingNote_subjectId_authorId_key" ON "CoachingNote"("subjectId", "authorId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");

-- CreateIndex
CREATE INDEX "Course_competencyId_idx" ON "Course"("competencyId");

-- CreateIndex
CREATE INDEX "Course_status_idx" ON "Course"("status");

-- CreateIndex
CREATE INDEX "Chapter_courseId_idx" ON "Chapter"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_courseId_sortOrder_key" ON "Chapter"("courseId", "sortOrder");

-- CreateIndex
CREATE INDEX "Enrollment_courseId_idx" ON "Enrollment"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_employeeId_courseId_key" ON "Enrollment"("employeeId", "courseId");

-- CreateIndex
CREATE INDEX "ChapterProgress_chapterId_idx" ON "ChapterProgress"("chapterId");

-- CreateIndex
CREATE INDEX "TestResult_courseId_idx" ON "TestResult"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "TestResult_employeeId_courseId_kind_key" ON "TestResult"("employeeId", "courseId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "LearningPath_slug_key" ON "LearningPath"("slug");

-- CreateIndex
CREATE INDEX "LearningPathStep_courseId_idx" ON "LearningPathStep"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningPathStep_pathId_sortOrder_key" ON "LearningPathStep"("pathId", "sortOrder");

-- CreateIndex
CREATE INDEX "PathCompletion_employeeId_idx" ON "PathCompletion"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PathCompletion_pathId_employeeId_key" ON "PathCompletion"("pathId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_code_key" ON "Certificate"("code");

-- CreateIndex
CREATE INDEX "Certificate_employeeId_idx" ON "Certificate"("employeeId");

-- CreateIndex
CREATE INDEX "Certificate_courseId_idx" ON "Certificate"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_key_key" ON "Badge"("key");

-- CreateIndex
CREATE INDEX "EmployeeBadge_badgeId_idx" ON "EmployeeBadge"("badgeId");

-- CreateIndex
CREATE INDEX "PointLedger_employeeId_createdAt_idx" ON "PointLedger"("employeeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Reward_key_key" ON "Reward"("key");

-- CreateIndex
CREATE INDEX "Redemption_employeeId_createdAt_idx" ON "Redemption"("employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "Redemption_rewardId_idx" ON "Redemption"("rewardId");

-- CreateIndex
CREATE INDEX "Announcement_status_publishedAt_idx" ON "Announcement"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "AnnouncementRead_employeeId_idx" ON "AnnouncementRead"("employeeId");

-- CreateIndex
CREATE INDEX "Notification_employeeId_readAt_idx" ON "Notification"("employeeId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRule_key_key" ON "NotificationRule"("key");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_actorId_idx" ON "ActivityLog"("actorId");

-- CreateIndex
CREATE INDEX "ActivityLog_action_idx" ON "ActivityLog"("action");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessToken" ADD CONSTRAINT "AccessToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Division" ADD CONSTRAINT "Division_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "JobRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyLevel" ADD CONSTRAINT "CompetencyLevel_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpectedLevel" ADD CONSTRAINT "ExpectedLevel_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "JobRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpectedLevel" ADD CONSTRAINT "ExpectedLevel_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "AssessmentCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentScore" ADD CONSTRAINT "AssessmentScore_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentScore" ADD CONSTRAINT "AssessmentScore_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiItem" ADD CONSTRAINT "KpiItem_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "AssessmentCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiItem" ADD CONSTRAINT "KpiItem_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdpGoal" ADD CONSTRAINT "IdpGoal_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdpGoal" ADD CONSTRAINT "IdpGoal_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdpGoal" ADD CONSTRAINT "IdpGoal_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdpGoal" ADD CONSTRAINT "IdpGoal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalEvidence" ADD CONSTRAINT "GoalEvidence_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "IdpGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingNote" ADD CONSTRAINT "CoachingNote_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingNote" ADD CONSTRAINT "CoachingNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterProgress" ADD CONSTRAINT "ChapterProgress_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterProgress" ADD CONSTRAINT "ChapterProgress_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPathStep" ADD CONSTRAINT "LearningPathStep_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPathStep" ADD CONSTRAINT "LearningPathStep_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathCompletion" ADD CONSTRAINT "PathCompletion_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "LearningPath"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeBadge" ADD CONSTRAINT "EmployeeBadge_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeBadge" ADD CONSTRAINT "EmployeeBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointLedger" ADD CONSTRAINT "PointLedger_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ===========================================================================
-- Hardening. Everything below is hand-written: Prisma's schema language cannot
-- express CHECK constraints, partial unique indexes or row-level security.
-- ===========================================================================

-- ---------------------------------------------------------------- identity
ALTER TABLE "User"
  ADD CONSTRAINT "User_email_lowercase" CHECK ("email" = lower("email")),
  ADD CONSTRAINT "User_failedLoginCount_nonneg" CHECK ("failedLoginCount" >= 0);

-- --------------------------------------------------------------------- org
-- Employee_ID in the requirement pack's data set: 3 to 4 characters.
ALTER TABLE "Employee"
  ADD CONSTRAINT "Employee_employeeCode_format" CHECK ("employeeCode" ~ '^[A-Za-z0-9]{3,4}$'),
  ADD CONSTRAINT "Employee_not_own_manager" CHECK ("managerId" IS NULL OR "managerId" <> "id"),
  ADD CONSTRAINT "Employee_email_lowercase" CHECK ("email" = lower("email"));

-- ---------------------------------------------------- competency framework
-- The client's rating scale is 1 to 4 with no half points.
ALTER TABLE "CompetencyLevel"
  ADD CONSTRAINT "CompetencyLevel_score_range" CHECK ("score" BETWEEN 1 AND 4);

-- A null expected level means "not assessed for this career role".
ALTER TABLE "ExpectedLevel"
  ADD CONSTRAINT "ExpectedLevel_level_range" CHECK ("level" IS NULL OR "level" BETWEEN 1 AND 4);

-- ---------------------------------------------------------------- cycles
ALTER TABLE "AssessmentCycle"
  ADD CONSTRAINT "AssessmentCycle_dates" CHECK ("endsAt" > "startsAt"),
  ADD CONSTRAINT "AssessmentCycle_weights_range" CHECK (
    "weightKpi" BETWEEN 0 AND 100 AND "weightCore" BETWEEN 0 AND 100
    AND "weightFunctional" BETWEEN 0 AND 100 AND "weightManagerial" BETWEEN 0 AND 100),
  ADD CONSTRAINT "AssessmentCycle_weights_total" CHECK (
    "weightKpi" + "weightCore" + "weightFunctional" + "weightManagerial" = 100);

ALTER TABLE "AssessmentScore"
  ADD CONSTRAINT "AssessmentScore_score_range" CHECK ("score" BETWEEN 1 AND 4);

ALTER TABLE "KpiItem"
  ADD CONSTRAINT "KpiItem_score_range" CHECK ("score" IS NULL OR "score" BETWEEN 1 AND 4),
  ADD CONSTRAINT "KpiItem_weight_range" CHECK ("weight" BETWEEN 0 AND 100);

-- Self assessment: the reviewer is the subject. Supervisor: someone else.
ALTER TABLE "Assessment"
  ADD CONSTRAINT "Assessment_reviewer_matches_mode" CHECK (
    ("mode" = 'SELF' AND "reviewerId" = "subjectId")
    OR ("mode" = 'SUPERVISOR' AND "reviewerId" <> "subjectId"));

-- ------------------------------------------------------------------- idp
-- "Raise X from level A to level B": B must be above A. A is 0 when unscored.
ALTER TABLE "IdpGoal"
  ADD CONSTRAINT "IdpGoal_levels" CHECK (
    "fromLevel" BETWEEN 0 AND 4 AND "toLevel" BETWEEN 1 AND 4 AND "toLevel" > "fromLevel"),
  ADD CONSTRAINT "IdpGoal_dates" CHECK ("dueDate" > "startDate"),
  ADD CONSTRAINT "IdpGoal_manualProgress_range" CHECK ("manualProgress" BETWEEN 0 AND 100);

-- ------------------------------------------------------------------- lms
ALTER TABLE "Course"
  ADD CONSTRAINT "Course_hours_nonneg" CHECK ("hours" >= 0);

ALTER TABLE "Chapter"
  ADD CONSTRAINT "Chapter_minutes_nonneg" CHECK ("minutes" >= 0),
  ADD CONSTRAINT "Chapter_pages_positive" CHECK ("pages" IS NULL OR "pages" > 0);

ALTER TABLE "TestResult"
  ADD CONSTRAINT "TestResult_score_range" CHECK ("score" BETWEEN 0 AND 100);

ALTER TABLE "Certificate"
  ADD CONSTRAINT "Certificate_score_range" CHECK ("score" IS NULL OR "score" BETWEEN 0 AND 100),
  ADD CONSTRAINT "Certificate_has_source" CHECK ("courseId" IS NOT NULL OR "pathId" IS NOT NULL);

-- one certificate per person per course, and per person per learning path
CREATE UNIQUE INDEX "Certificate_one_per_course"
  ON "Certificate" ("employeeId", "courseId") WHERE "courseId" IS NOT NULL AND "pathId" IS NULL;
CREATE UNIQUE INDEX "Certificate_one_per_path"
  ON "Certificate" ("employeeId", "pathId") WHERE "pathId" IS NOT NULL;

ALTER TABLE "LearningPath"
  ADD CONSTRAINT "LearningPath_projectPoints_nonneg" CHECK ("projectPoints" >= 0);

-- ------------------------------------------------------------ engagement
-- A one-off award can be paid once per thing it is for, even if two requests
-- race. Badge grants/revokes and redemptions/refunds legitimately repeat a
-- reference with opposite signs, so they are left out on purpose.
CREATE UNIQUE INDEX "PointLedger_award_once"
  ON "PointLedger" ("employeeId", "refType", "refId")
  WHERE "refType" IN ('Assessment', 'Course', 'CourseCertificate', 'LearningPath');

ALTER TABLE "Reward"
  ADD CONSTRAINT "Reward_points_nonneg" CHECK ("points" >= 0),
  ADD CONSTRAINT "Reward_stock_nonneg" CHECK ("stock" >= 0);

ALTER TABLE "Redemption"
  ADD CONSTRAINT "Redemption_points_nonneg" CHECK ("points" >= 0);

ALTER TABLE "Badge"
  ADD CONSTRAINT "Badge_points_nonneg" CHECK ("points" >= 0),
  ADD CONSTRAINT "Badge_target_positive" CHECK ("target" IS NULL OR "target" > 0);

-- ======================================================= row-level security
-- Supabase publishes every table in `public` through its REST API, reachable
-- with the project's publishable key — which is public by design. Without this
-- block, anyone holding that key could read employee records and password
-- hashes straight from https://<project>.supabase.co/rest/v1/.
--
-- The application connects as the table owner, which bypasses RLS, so enabling
-- it with no policies closes the REST door without affecting the app. On a
-- plain Postgres (the local dev database) the Supabase roles do not exist and
-- the revokes are skipped.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', role_name);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', role_name);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', role_name);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
