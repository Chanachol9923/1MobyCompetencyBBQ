-- Rating scale wording from the requirement brief §1.2. Only the two label
-- columns change; each competency's own description and behaviours
-- (descTh / behaviorTh) stay exactly as they are.
UPDATE "CompetencyLevel"
  SET "labelEn" = 'Exceeds Expectations', "labelTh" = 'ทำได้เกินความคาดหมายอย่างมาก เป็นต้นแบบได้'
  WHERE "score" = 4;
UPDATE "CompetencyLevel"
  SET "labelEn" = 'Meets Expectations', "labelTh" = 'ทำได้ตามมาตรฐานที่กำหนด สม่ำเสมอ'
  WHERE "score" = 3;
UPDATE "CompetencyLevel"
  SET "labelEn" = 'Needs Improvement', "labelTh" = 'ทำได้ต่ำกว่ามาตรฐานในบางส่วน ต้องได้รับการพัฒนา'
  WHERE "score" = 2;
UPDATE "CompetencyLevel"
  SET "labelEn" = 'Unacceptable', "labelTh" = 'ผลงานต่ำกว่ามาตรฐานอย่างมาก ต้องปรับปรุงเร่งด่วน'
  WHERE "score" = 1;
