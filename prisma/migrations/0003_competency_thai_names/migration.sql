-- Thai names for the 13 competencies. The client's workbook names them in
-- English only, so the Thai interface was showing English. Only fills a blank
-- name, so a name an administrator has already set is left alone.

UPDATE "Competency" SET "nameTh" = 'สร้างผลลัพธ์ที่มีคุณค่า' WHERE key = 'create-impact' AND "nameTh" IS NULL;
UPDATE "Competency" SET "nameTh" = 'รับผิดชอบงานเสมือนเจ้าของ' WHERE key = 'take-ownership' AND "nameTh" IS NULL;
UPDATE "Competency" SET "nameTh" = 'การปรับตัว' WHERE key = 'adaptive' AND "nameTh" IS NULL;
UPDATE "Competency" SET "nameTh" = 'การทำงานร่วมกัน' WHERE key = 'collaboration' AND "nameTh" IS NULL;
UPDATE "Competency" SET "nameTh" = 'การบริหารกระบวนการ' WHERE key = 'process' AND "nameTh" IS NULL;
UPDATE "Competency" SET "nameTh" = 'การกำหนดทิศทางและเป้าหมาย' WHERE key = 'purpose' AND "nameTh" IS NULL;
UPDATE "Competency" SET "nameTh" = 'การบริหารและพัฒนาคน' WHERE key = 'people' AND "nameTh" IS NULL;
UPDATE "Competency" SET "nameTh" = 'การบริหารผลลัพธ์' WHERE key = 'result' AND "nameTh" IS NULL;
UPDATE "Competency" SET "nameTh" = 'การเขียนโปรแกรมและคุณภาพโค้ด' WHERE key = 'programming' AND "nameTh" IS NULL;
UPDATE "Competency" SET "nameTh" = 'สถาปัตยกรรมและการออกแบบซอฟต์แวร์' WHERE key = 'architecture' AND "nameTh" IS NULL;
UPDATE "Competency" SET "nameTh" = 'ฐานข้อมูลและการจัดการข้อมูล' WHERE key = 'databases' AND "nameTh" IS NULL;
UPDATE "Competency" SET "nameTh" = 'การจัดการเวอร์ชันของโค้ด' WHERE key = 'version-control' AND "nameTh" IS NULL;
UPDATE "Competency" SET "nameTh" = 'การคิดวิเคราะห์และการบริหารเวลา' WHERE key = 'analytical' AND "nameTh" IS NULL;

-- The seeded development goals carried an English-only explanation after the
-- "Assigned by …" stamp; keep the stamp, which the screens now translate.
UPDATE "IdpGoal" SET remark = split_part(remark, ' — one of the widest gaps', 1)
WHERE remark LIKE 'Assigned by % — one of the widest gaps from this cycle''s review';

-- The three seeded announcements were English-only and dated to the first
-- quarter. Rewrite them for the open cycle in both languages — only while they
-- still carry the original seed text, so an edited announcement is left alone.
UPDATE "Announcement" a SET
  "titleEn" = c."nameEn" || ' assessment cycle is open',
  "titleTh" = 'เปิดรอบการประเมิน ' || c."nameTh" || ' แล้ว',
  "bodyEn" = 'Please complete your self assessment before ' || to_char(c."endsAt", 'FMDD Mon YYYY') || '. Managers review their teams before the cycle closes. Start with Core and Functional.',
  "bodyTh" = 'กรุณาทำแบบประเมินตนเองให้เสร็จก่อนวันที่ ' || to_char(c."endsAt", 'FMDD/MM/') || (extract(year from c."endsAt")::int + 543) || ' หัวหน้าจะประเมินทีมก่อนปิดรอบ แนะนำให้เริ่มจากสมรรถนะหลักและสมรรถนะตามสายงาน',
  "publishedAt" = c."startsAt"
FROM (SELECT "nameEn", "nameTh", "startsAt", "endsAt" FROM "AssessmentCycle" WHERE status = 'OPEN' ORDER BY "startsAt" DESC LIMIT 1) c
WHERE a.id = 'an1' AND a."titleEn" = 'Q1 Assessment cycle is open';

UPDATE "Announcement" SET
  "titleTh" = 'หลักสูตรใหม่: Advanced AWS',
  "bodyEn" = '8 lessons, 18 hours. It counts toward the Software Architecture and Design competency.',
  "bodyTh" = '8 บทเรียน 18 ชั่วโมง นับเป็นการพัฒนาสมรรถนะสถาปัตยกรรมและการออกแบบซอฟต์แวร์',
  "publishedAt" = now() - interval '2 days'
WHERE id = 'an2' AND "titleTh" IS NULL AND "bodyEn" LIKE '8 lessons, 18 hours, counts toward%';

UPDATE "Announcement" SET
  "titleTh" = 'อัปเดตรายการของรางวัล',
  "bodyEn" = 'New tumblers and gift vouchers are coming. Points you have already earned still count.',
  "bodyTh" = 'เตรียมพบแก้วน้ำและบัตรของขวัญใหม่ คะแนนที่สะสมไว้แล้วยังใช้ได้ตามเดิม',
  -- still waiting to go out: schedule it two weeks ahead instead of in March
  "publishAt" = CASE WHEN status = 'DRAFT' THEN now() + interval '14 days' ELSE "publishAt" END
WHERE id = 'an3' AND "titleTh" IS NULL AND "bodyEn" LIKE 'New tumblers and gift vouchers added%';
