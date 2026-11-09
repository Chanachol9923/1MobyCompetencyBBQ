-- Aligning the data rules with the requirement brief.

-- §4 Data set: "รหัสพนักงานกำหนดอยู่ที่ 3 - 4 ตัวเลขเท่านั้น" — digits only
-- (every existing code already is).
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_employeeCode_format";
ALTER TABLE "Employee"
  ADD CONSTRAINT "Employee_employeeCode_format" CHECK ("employeeCode" ~ '^[0-9]{3,4}$');

-- Grades as on the 1Moby Careers chart: the specialist track runs SP1-SP2
-- (Specialist) then SP3-SP4 (Specialist Lead); Expertise spans EP1-EP4 over
-- levels 4-5; Director has no track code and takes level 5's G09-G10.
UPDATE "JobRole" SET "gradeFrom" = 'SP3', "gradeTo" = 'SP4' WHERE "key" = 'specialist-lead';
UPDATE "JobRole" SET "gradeFrom" = 'EP1', "gradeTo" = 'EP4' WHERE "key" = 'expertise';
UPDATE "JobRole" SET "gradeFrom" = 'G09', "gradeTo" = 'G10' WHERE "key" = 'director';
