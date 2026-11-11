-- Career path as on the 1Moby Careers chart in the requirement brief.

-- Level 6 "Vision (C Level)": the C Suite career role, grade G11. The brief's
-- "Level ที่ถูกประเมิน" table has no C Suite column, so it is not assessed on
-- any competency: every expected level is NULL (the app's "not assessed").
INSERT INTO "JobRole" ("id", "key", "name", "level", "levelRank", "gradeFrom", "gradeTo", "sortOrder")
VALUES ('jobrole_c_suite', 'c-suite', 'C Suite', 'Level 6: Vision', 6, 'G11', 'G11', 8)
ON CONFLICT DO NOTHING;

INSERT INTO "ExpectedLevel" ("jobRoleId", "competencyId", "level")
SELECT j."id", c."id", NULL
FROM "JobRole" j, "Competency" c
WHERE j."key" = 'c-suite'
ON CONFLICT DO NOTHING;

-- Expertise spans levels 4-5 on the chart (grades EP1-EP4, set in 0011). It
-- keeps levelRank 5, so ordering and comparisons do not change.
UPDATE "JobRole" SET "level" = 'Level 4-5: Management / Strategy' WHERE "key" = 'expertise';
