-- Courses are assigned from the assessment: each course carries the
-- competency level (1-4) it brings a learner up to.

ALTER TABLE "Course" ADD COLUMN "level" INTEGER;
ALTER TABLE "Course"
  ADD CONSTRAINT "Course_level_range" CHECK ("level" IS NULL OR "level" BETWEEN 1 AND 4);

CREATE TABLE "CourseAssignment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "expected" INTEGER NOT NULL,
    "cycleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseAssignment_employeeId_courseId_key" ON "CourseAssignment"("employeeId", "courseId");
CREATE INDEX "CourseAssignment_courseId_idx" ON "CourseAssignment"("courseId");

ALTER TABLE "CourseAssignment" ADD CONSTRAINT "CourseAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseAssignment" ADD CONSTRAINT "CourseAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseAssignment" ADD CONSTRAINT "CourseAssignment_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- an assignment only exists for a real gap
ALTER TABLE "CourseAssignment"
  ADD CONSTRAINT "CourseAssignment_is_a_gap" CHECK ("score" BETWEEN 1 AND 4 AND "expected" BETWEEN 1 AND 4 AND "score" < "expected");

-- the app reaches it through the server only
ALTER TABLE "CourseAssignment" ENABLE ROW LEVEL SECURITY;

-- levels for the existing catalogue: per competency, a foundation course (2),
-- the standard one (3) and an advanced one (4)
UPDATE "Course" SET "level" = v.level FROM (VALUES
  ('learning-agility', 2), ('staying-steady-under-pressure', 3), ('adaptive-change-workshop', 4),
  ('end-to-end-ownership', 2), ('ownership-clinic-status', 3), ('blameless-problem-solving', 4),
  ('how-to-be-funny', 2), ('cross-team-collaboration', 3), ('team-charter-workshop', 4),
  ('measuring-your-work', 2), ('impact-prioritisation', 3), ('impact-case-dashboard', 4),
  ('design-system', 2), ('architecture-decision-lab', 3), ('advanced-aws', 4),
  ('prioritisation-and-time', 2), ('root-cause-analysis', 3), ('analytical-case-three-problems', 4),
  ('git-in-practice', 2), ('clean-code-and-reviews', 3), ('repo-rescue-lab', 4),
  ('network-security', 2), ('data-modelling-essentials', 3), ('query-tuning-lab', 4),
  ('programming101', 2), ('testing-fundamentals', 3), ('refactoring-lab', 3), ('nodejs-expert', 4),
  ('project-management-essentials', 2), ('coaching-and-feedback', 3), ('people-clinic-first-thirty-days', 4),
  ('strategy-to-daily-work', 2), ('delegation-and-decisions', 3), ('purpose-mandate-workshop', 4),
  ('goal-setting-and-kpis', 2), ('delivery-cadence', 3), ('result-case-green-dashboard', 4),
  ('leadership-team-dynamics', 2), ('process-improvement', 3), ('process-case-eleven-approvals', 4)
) AS v(slug, level)
WHERE "Course".slug = v.slug;
