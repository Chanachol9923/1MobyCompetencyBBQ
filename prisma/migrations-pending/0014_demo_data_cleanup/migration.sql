-- Demo data cleanup approved by the user (handoff task 4, "make it make
-- sense"). Written against stable keys only: employeeCode, Course.slug,
-- Reward.key. Safe to run twice.

-- ------------------------------------------------- a. opening balances
-- The seed gave everyone a random 2,100-8,000 point "Opening balance" while
-- real activities earn 5-50 points. The ledger is append-only, so instead of
-- deleting those rows each person gets ONE offsetting row and their balance
-- becomes what they actually earned. The offset is capped so no balance goes
-- below zero (nobody has redeemed anything, so the cap does not bite today).
-- refType/refId identify the reset, which keeps a second run from adding it
-- again.
INSERT INTO "PointLedger" ("id", "employeeId", "delta", "reason", "refType", "refId", "createdAt")
SELECT 'reset_' || o."employeeId",
       o."employeeId",
       -LEAST(o.opening, b.balance),
       'Opening balance reset',
       'OpeningBalanceReset',
       o."employeeId",
       now()
FROM (
  SELECT "employeeId", SUM("delta") AS opening
  FROM "PointLedger"
  WHERE "reason" = 'Opening balance'
  GROUP BY "employeeId"
) o
JOIN (
  SELECT "employeeId", SUM("delta") AS balance
  FROM "PointLedger"
  GROUP BY "employeeId"
) b ON b."employeeId" = o."employeeId"
WHERE LEAST(o.opening, b.balance) > 0
  AND NOT EXISTS (
    SELECT 1 FROM "PointLedger" r
    WHERE r."employeeId" = o."employeeId" AND r."refType" = 'OpeningBalanceReset'
  );

-- ------------------------------------------------------ b. reward prices
-- Priced against what activities actually earn (a course is 50 points).
UPDATE "Reward" SET "points" = 150 WHERE "key" = 'starbucks';
UPDATE "Reward" SET "points" = 300 WHERE "key" = 'tshirt';
UPDATE "Reward" SET "points" = 500 WHERE "key" = 'tumbler';
-- out of reach at any sensible price: withdrawn, not deleted
UPDATE "Reward" SET "active" = false WHERE "key" = 'gold';

-- ------------------------------------------------------- c. test courses
-- "BOTNoi" and "SCG" are test uploads with no competency; "How To Be Funny"
-- is a placeholder. Back to DRAFT so learners no longer see them.
UPDATE "Course" SET "status" = 'DRAFT' WHERE "slug" IN ('scg', 'scg-2', 'how-to-be-funny');

-- The one DELETE in this file. It removes DERIVED rows only: automatic course
-- assignments (rebuilt from assessment results by the app) for those three
-- courses, and only where the person has not started the course (no chapter
-- done, not completed). Nobody's own progress, enrolment or ledger is touched.
DELETE FROM "CourseAssignment" a
USING "Course" c
WHERE a."courseId" = c."id"
  AND c."slug" IN ('scg', 'scg-2', 'how-to-be-funny')
  AND NOT EXISTS (
    SELECT 1 FROM "Enrollment" e
    WHERE e."employeeId" = a."employeeId"
      AND e."courseId" = a."courseId"
      AND (e."completedAt" IS NOT NULL
           OR EXISTS (SELECT 1 FROM "ChapterProgress" p WHERE p."enrollmentId" = e."id"))
  );

-- ----------------------------------------------------- d. staff records
-- Chanachol Polketkit (9923) had no supervisor; reports to Vichai Somsak (405).
UPDATE "Employee" e
SET "managerId" = m."id"
FROM "Employee" m
WHERE e."employeeCode" = '9923' AND m."employeeCode" = '405' AND e."managerId" IS NULL;

-- A grade of "3" is not a grade code; use the first grade of the person's
-- career role (Director: G09).
UPDATE "Employee" e
SET "grade" = j."gradeFrom"
FROM "JobRole" j
WHERE e."jobRoleId" = j."id" AND e."grade" = '3';
