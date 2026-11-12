-- Course prerequisites ("take the earlier course first"): a course stays
-- locked for a learner until every course it requires is completed. Someone
-- who already has progress in a course keeps access (enforced in the app).
--   - no self-links (CHECK below);
--   - no cycles: a CHECK cannot see other rows, so the admin save checks it
--     (src/server/course-prerequisites.ts) and the seed below has none.

CREATE TABLE "CoursePrerequisite" (
    "courseId" TEXT NOT NULL,
    "requiresCourseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoursePrerequisite_pkey" PRIMARY KEY ("courseId", "requiresCourseId"),
    CONSTRAINT "CoursePrerequisite_not_self" CHECK ("courseId" <> "requiresCourseId")
);

CREATE INDEX "CoursePrerequisite_requiresCourseId_idx" ON "CoursePrerequisite"("requiresCourseId");

ALTER TABLE "CoursePrerequisite" ADD CONSTRAINT "CoursePrerequisite_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoursePrerequisite" ADD CONSTRAINT "CoursePrerequisite_requiresCourseId_fkey" FOREIGN KEY ("requiresCourseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- the app reaches it through the server only
ALTER TABLE "CoursePrerequisite" ENABLE ROW LEVEL SECURITY;

-- Starting chains for the existing catalogue, by slug (a slug that is not
-- there is simply skipped). Within each competency the level-2 course comes
-- before the level-3 one, which comes before the level-4 one. The test course
-- "how-to-be-funny" and the misfiled "network-security" (both DRAFT) are left
-- out. Plus the product owner's example: talk with people first, then project
-- management - "Working Across Teams" before "Project Management Essentials".
INSERT INTO "CoursePrerequisite" ("courseId", "requiresCourseId")
SELECT c."id", r."id"
FROM (VALUES
  -- Create Impact
  ('impact-prioritisation',             'measuring-your-work'),
  ('impact-case-dashboard',             'impact-prioritisation'),
  -- Take Ownership
  ('ownership-clinic-status',           'end-to-end-ownership'),
  ('blameless-problem-solving',         'ownership-clinic-status'),
  -- Adaptive
  ('staying-steady-under-pressure',     'learning-agility'),
  ('adaptive-change-workshop',          'staying-steady-under-pressure'),
  -- Collaboration
  ('team-charter-workshop',             'cross-team-collaboration'),
  -- Process
  ('process-improvement',               'leadership-team-dynamics'),
  ('process-case-eleven-approvals',     'process-improvement'),
  -- Purpose
  ('delegation-and-decisions',          'strategy-to-daily-work'),
  ('purpose-mandate-workshop',          'delegation-and-decisions'),
  -- People (and the product owner's example)
  ('project-management-essentials',     'cross-team-collaboration'),
  ('coaching-and-feedback',             'project-management-essentials'),
  ('people-clinic-first-thirty-days',   'coaching-and-feedback'),
  -- Result
  ('delivery-cadence',                  'goal-setting-and-kpis'),
  ('result-case-green-dashboard',       'delivery-cadence'),
  -- Programming & Code Quality (two level-3 courses, both before level 4)
  ('testing-fundamentals',              'programming101'),
  ('refactoring-lab',                   'programming101'),
  ('nodejs-expert',                     'testing-fundamentals'),
  ('nodejs-expert',                     'refactoring-lab'),
  -- Software Architecture and Design
  ('architecture-decision-lab',         'design-system'),
  ('advanced-aws',                      'architecture-decision-lab'),
  -- Databases & Data Management
  ('query-tuning-lab',                  'data-modelling-essentials'),
  -- Code Version Control
  ('clean-code-and-reviews',            'git-in-practice'),
  ('repo-rescue-lab',                   'clean-code-and-reviews'),
  -- Analytical Thinking & Time Management
  ('root-cause-analysis',               'prioritisation-and-time'),
  ('analytical-case-three-problems',    'root-cause-analysis')
) AS p(course_slug, requires_slug)
JOIN "Course" c ON c."slug" = p.course_slug
JOIN "Course" r ON r."slug" = p.requires_slug
ON CONFLICT DO NOTHING;
