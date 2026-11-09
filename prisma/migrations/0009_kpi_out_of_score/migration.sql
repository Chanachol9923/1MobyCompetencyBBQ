-- KPIs are run outside this system: the score is competencies only.
-- Nothing is deleted here: the KPI weight becomes 0 and its share goes to the
-- competency groups in proportion. "weightKpi" and "KpiItem" stay, unused.

ALTER TABLE "AssessmentCycle"
  DROP CONSTRAINT "AssessmentCycle_weights_range",
  DROP CONSTRAINT "AssessmentCycle_weights_total";

UPDATE "AssessmentCycle" c
SET "weightCore"       = CASE WHEN r.rest = 0 THEN 35 ELSE ROUND(c."weightCore" * 100.0 / r.rest) END,
    "weightFunctional" = CASE WHEN r.rest = 0 THEN 40 ELSE ROUND(c."weightFunctional" * 100.0 / r.rest) END
FROM (SELECT id, "weightCore" + "weightFunctional" + "weightManagerial" AS rest FROM "AssessmentCycle") r
WHERE c.id = r.id;
UPDATE "AssessmentCycle" SET "weightManagerial" = 100 - "weightCore" - "weightFunctional", "weightKpi" = 0;

ALTER TABLE "AssessmentCycle"
  ALTER COLUMN "weightKpi" SET DEFAULT 0,
  ALTER COLUMN "weightCore" SET DEFAULT 35,
  ALTER COLUMN "weightFunctional" SET DEFAULT 40,
  ALTER COLUMN "weightManagerial" SET DEFAULT 25,
  ADD CONSTRAINT "AssessmentCycle_weights_range" CHECK (
    "weightCore" BETWEEN 0 AND 100 AND "weightFunctional" BETWEEN 0 AND 100
    AND "weightManagerial" BETWEEN 0 AND 100),
  ADD CONSTRAINT "AssessmentCycle_weights_total" CHECK (
    "weightKpi" = 0 AND "weightCore" + "weightFunctional" + "weightManagerial" = 100);
