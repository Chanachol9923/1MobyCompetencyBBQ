-- Organisation names that differ only in capitals are the same thing
-- ("Software engineer" vs "Software Engineer"). Merge any such duplicates,
-- keeping the spelling most staff already use, then make the database refuse
-- them from now on.

-- ---------------------------------------------------------------- positions
WITH ranked AS (
  SELECT p.id,
         lower(p.name) AS k,
         coalesce(p."departmentId", '') AS dept,
         row_number() OVER (
           PARTITION BY lower(p.name), coalesce(p."departmentId", '')
           ORDER BY (SELECT count(*) FROM "Employee" e WHERE e."positionId" = p.id) DESC, p.name
         ) AS rn
  FROM "Position" p
),
keep AS (SELECT k, dept, id FROM ranked WHERE rn = 1),
dupe AS (
  SELECT r.id AS old_id, keep.id AS new_id
  FROM ranked r JOIN keep ON keep.k = r.k AND keep.dept = r.dept
  WHERE r.rn > 1
)
UPDATE "Employee" e SET "positionId" = dupe.new_id FROM dupe WHERE e."positionId" = dupe.old_id;

-- staff now sit on the kept row, so it ranks first again; drop the rest
DELETE FROM "Position" WHERE id IN (
  SELECT id FROM (
    SELECT p.id, row_number() OVER (
      PARTITION BY lower(p.name), coalesce(p."departmentId", '')
      ORDER BY (SELECT count(*) FROM "Employee" e WHERE e."positionId" = p.id) DESC, p.name
    ) AS rn
    FROM "Position" p
  ) x WHERE rn > 1
);

CREATE UNIQUE INDEX "Position_name_ci_per_department"
  ON "Position" (lower(name), coalesce("departmentId", ''));

-- ---------------------------------------------------------------- divisions
WITH ranked AS (
  SELECT d.id, lower(d.name) AS k, d."departmentId" AS dept,
         row_number() OVER (
           PARTITION BY lower(d.name), d."departmentId"
           ORDER BY (SELECT count(*) FROM "Employee" e WHERE e."divisionId" = d.id) DESC, d.name
         ) AS rn
  FROM "Division" d
),
keep AS (SELECT k, dept, id FROM ranked WHERE rn = 1),
dupe AS (
  SELECT r.id AS old_id, keep.id AS new_id
  FROM ranked r JOIN keep ON keep.k = r.k AND keep.dept = r.dept
  WHERE r.rn > 1
)
UPDATE "Employee" e SET "divisionId" = dupe.new_id FROM dupe WHERE e."divisionId" = dupe.old_id;

DELETE FROM "Division" WHERE id IN (
  SELECT id FROM (
    SELECT d.id, row_number() OVER (
      PARTITION BY lower(d.name), d."departmentId"
      ORDER BY (SELECT count(*) FROM "Employee" e WHERE e."divisionId" = d.id) DESC, d.name
    ) AS rn
    FROM "Division" d
  ) x WHERE rn > 1
);

CREATE UNIQUE INDEX "Division_name_ci_per_department"
  ON "Division" (lower(name), "departmentId");

-- -------------------------------------------------------------- departments
CREATE UNIQUE INDEX "Department_name_ci" ON "Department" (lower(name));
