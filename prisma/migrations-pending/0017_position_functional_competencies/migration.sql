-- Functional competencies per job position (handoff task 8; the product
-- owner chose Position, not department). Nothing here changes what anybody
-- is assessed on today:
--   - the five existing functional competencies are flagged as the default
--     set, which every position without its own set keeps using;
--   - no position gets a set; an administrator chooses one later in the
--     organisation screen, which then replaces the default for that position.
-- The expected level still comes from ExpectedLevel by career role.

-- the functional set a position uses when it has none of its own
ALTER TABLE "Competency" ADD COLUMN "defaultFunctional" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Competency" SET "defaultFunctional" = true WHERE "group" = 'FUNCTIONAL';
-- only a functional competency can be in the default functional set
ALTER TABLE "Competency"
  ADD CONSTRAINT "Competency_default_is_functional" CHECK (NOT "defaultFunctional" OR "group" = 'FUNCTIONAL');

CREATE TABLE "PositionCompetency" (
    "positionId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PositionCompetency_pkey" PRIMARY KEY ("positionId", "competencyId")
);

CREATE INDEX "PositionCompetency_competencyId_idx" ON "PositionCompetency"("competencyId");

ALTER TABLE "PositionCompetency" ADD CONSTRAINT "PositionCompetency_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PositionCompetency" ADD CONSTRAINT "PositionCompetency_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- the link is for FUNCTIONAL competencies only: core and managerial ones are
-- decided by career role alone. A CHECK cannot look at another table, so a
-- trigger keeps it honest.
CREATE FUNCTION "PositionCompetency_functional_only"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "Competency" c WHERE c."id" = NEW."competencyId" AND c."group" = 'FUNCTIONAL'
  ) THEN
    RAISE EXCEPTION 'PositionCompetency: competency % is not FUNCTIONAL', NEW."competencyId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER "PositionCompetency_functional_only"
  BEFORE INSERT OR UPDATE ON "PositionCompetency"
  FOR EACH ROW EXECUTE FUNCTION "PositionCompetency_functional_only"();

-- the app reaches it through the server only
ALTER TABLE "PositionCompetency" ENABLE ROW LEVEL SECURITY;
