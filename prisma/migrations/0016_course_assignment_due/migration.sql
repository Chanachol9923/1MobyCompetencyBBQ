-- A due date on courses assigned from the assessment (handoff task 9, in-app
-- part only). 30 days after the assignment; the database sets it, so the app
-- never has to (and keeps working before this runs). Existing assignments get
-- the same rule from their own creation date, not from today.

ALTER TABLE "CourseAssignment" ADD COLUMN "dueAt" TIMESTAMP(3);

UPDATE "CourseAssignment" SET "dueAt" = "createdAt" + interval '30 days' WHERE "dueAt" IS NULL;

ALTER TABLE "CourseAssignment"
  ALTER COLUMN "dueAt" SET DEFAULT (CURRENT_TIMESTAMP + '30 days'::interval),
  ALTER COLUMN "dueAt" SET NOT NULL;

-- a course cannot be due before it was assigned
ALTER TABLE "CourseAssignment"
  ADD CONSTRAINT "CourseAssignment_due_after_assigned" CHECK ("dueAt" >= "createdAt");

-- the daily reminder job reads assignments by due date
CREATE INDEX "CourseAssignment_dueAt_idx" ON "CourseAssignment"("dueAt");
