/**
 * Seeds the database from the TypeScript data the demo was built on, which in
 * turn came out of the client's "Mock Data _1Moby" workbook.
 *
 *   npx prisma db push      # create the tables
 *   npx prisma db seed      # fill them
 *
 * The script is idempotent: every write is an upsert keyed on a natural key, so
 * running it again updates rather than duplicates.
 */
import "dotenv/config";
import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { FRAMEWORK, EXPECTED_BY_ROLE } from "../src/data/framework";
import { RAW_PEOPLE } from "../src/data/people.generated";
import { COMPETENCIES } from "../src/data/competencies";
import { JOB_ROLES } from "../src/data/people";
import {
  BADGES,
  COURSES,
  LEARNING_PATHS,
  REWARDS,
  chapterKind,
} from "../src/data/learning";
import {
  SAMPLE_CHAPTER_VIDEOS,
  SAMPLE_DOCUMENTS,
  SAMPLE_SHORTS,
  SAMPLE_SHORT_SECONDS,
} from "../src/data/learning-media";
import { DEFAULT_ROLES, PERMISSION_CATALOGUE } from "../src/lib/permissions";
import { currentCycle } from "../src/data/cycle";
import { hashPassword } from "../src/lib/password";
import { suggestLoginId } from "../src/lib/login-id";
import { sslFor } from "../src/lib/db-ssl";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Set DATABASE_URL (and DIRECT_URL) before seeding.");
}
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString, ssl: sslFor(connectionString) }),
});

const GROUP: Record<string, "CORE" | "FUNCTIONAL" | "MANAGERIAL"> = {
  core: "CORE",
  functional: "FUNCTIONAL",
  managerial: "MANAGERIAL",
};

const ACTIVITY = {
  "Online Course": "ONLINE_COURSE",
  Coaching: "COACHING",
  "On-the-job Training": "ON_THE_JOB",
} as const;

async function seedRbac() {
  for (const p of PERMISSION_CATALOGUE) {
    await db.permission.upsert({
      where: { key: p.key },
      update: {
        nameEn: p.nameEn,
        nameTh: p.nameTh,
        category: p.category,
        descEn: p.descEn,
        descTh: p.descTh,
      },
      create: {
        key: p.key,
        nameEn: p.nameEn,
        nameTh: p.nameTh,
        category: p.category,
        descEn: p.descEn,
        descTh: p.descTh,
      },
    });
  }

  for (const r of DEFAULT_ROLES) {
    const role = await db.role.upsert({
      where: { key: r.key },
      update: {
        nameEn: r.nameEn,
        nameTh: r.nameTh,
        description: r.description,
        sortOrder: r.sortOrder,
        isSystem: true,
      },
      create: {
        key: r.key,
        nameEn: r.nameEn,
        nameTh: r.nameTh,
        description: r.description,
        sortOrder: r.sortOrder,
        isSystem: true,
      },
    });
    // only seed the default grants when the role has none yet, so an admin's
    // later changes survive a re-seed
    const existing = await db.rolePermission.count({ where: { roleId: role.id } });
    if (existing === 0) {
      const perms = await db.permission.findMany({
        where: { key: { in: r.permissions as string[] } },
        select: { id: true },
      });
      await db.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }
  }
  console.log(`  roles ${DEFAULT_ROLES.length}, permissions ${PERMISSION_CATALOGUE.length}`);
}

async function seedFramework() {
  const enById = new Map(COMPETENCIES.map((c) => [c.id, c]));

  // the workbook names competencies in English only; these are the Thai names
  const NAME_TH: Record<string, string> = {
  "create-impact": "สร้างผลลัพธ์ที่มีคุณค่า",
  "take-ownership": "รับผิดชอบงานเสมือนเจ้าของ",
  "adaptive": "การปรับตัว",
  "collaboration": "การทำงานร่วมกัน",
  "process": "การบริหารกระบวนการ",
  "purpose": "การกำหนดทิศทางและเป้าหมาย",
  "people": "การบริหารและพัฒนาคน",
  "result": "การบริหารผลลัพธ์",
  "programming": "การเขียนโปรแกรมและคุณภาพโค้ด",
  "architecture": "สถาปัตยกรรมและการออกแบบซอฟต์แวร์",
  "databases": "ฐานข้อมูลและการจัดการข้อมูล",
  "version-control": "การจัดการเวอร์ชันของโค้ด",
  "analytical": "การคิดวิเคราะห์และการบริหารเวลา",
  };

  for (const [i, f] of FRAMEWORK.entries()) {
    const en = enById.get(f.id);
    const competency = await db.competency.upsert({
      where: { key: f.id },
      update: {
        group: GROUP[f.group]!,
        nameEn: f.name,
        definitionEn: en?.definition ?? null,
        definitionTh: f.definitionTh || null,
        subTh: f.subTh || null,
        indicatorsEn: en?.indicators ?? [],
        sortOrder: i,
      },
      create: {
        key: f.id,
        group: GROUP[f.group]!,
        nameEn: f.name,
        nameTh: NAME_TH[f.id] ?? null,
        definitionEn: en?.definition ?? null,
        definitionTh: f.definitionTh || null,
        subTh: f.subTh || null,
        indicatorsEn: en?.indicators ?? [],
        sortOrder: i,
      },
    });

    for (const lv of f.levels) {
      await db.competencyLevel.upsert({
        where: {
          competencyId_score: { competencyId: competency.id, score: lv.score },
        },
        update: {
          labelEn: lv.labelEn,
          labelTh: lv.labelTh,
          descTh: lv.descTh || null,
          behaviorTh: lv.behaviorTh ? lv.behaviorTh.replace(/\\n/g, "\n") : null,
        },
        create: {
          competencyId: competency.id,
          score: lv.score,
          labelEn: lv.labelEn,
          labelTh: lv.labelTh,
          descTh: lv.descTh || null,
          behaviorTh: lv.behaviorTh ? lv.behaviorTh.replace(/\\n/g, "\n") : null,
        },
      });
    }
  }

  // career ladder
  for (const [i, r] of JOB_ROLES.entries()) {
    const [from, to] = r.grade.split(" - ");
    await db.jobRole.upsert({
      where: { name: r.name },
      update: {
        level: r.level,
        levelRank: Number(r.level.match(/\d/)?.[0] ?? i + 1),
        gradeFrom: from ?? r.grade,
        gradeTo: to ?? from ?? r.grade,
        sortOrder: i,
      },
      create: {
        key: r.name.toLowerCase().replace(/\s+/g, "-"),
        name: r.name,
        level: r.level,
        levelRank: Number(r.level.match(/\d/)?.[0] ?? i + 1),
        gradeFrom: from ?? r.grade,
        gradeTo: to ?? from ?? r.grade,
        sortOrder: i,
      },
    });
  }

  // the expected-level matrix — the rule the whole product hangs off
  const roles = await db.jobRole.findMany({ select: { id: true, name: true } });
  const comps = await db.competency.findMany({ select: { id: true, key: true } });
  const compByKey = new Map(comps.map((c) => [c.key, c.id]));

  let cells = 0;
  for (const role of roles) {
    const row = EXPECTED_BY_ROLE[role.name as keyof typeof EXPECTED_BY_ROLE];
    if (!row) continue;
    for (const [key, level] of Object.entries(row)) {
      const competencyId = compByKey.get(key);
      if (!competencyId) continue;
      await db.expectedLevel.upsert({
        where: { jobRoleId_competencyId: { jobRoleId: role.id, competencyId } },
        update: { level: level ?? null },
        create: { jobRoleId: role.id, competencyId, level: level ?? null },
      });
      cells++;
    }
  }
  console.log(`  competencies ${FRAMEWORK.length}, job roles ${roles.length}, expected-level cells ${cells}`);
}

async function seedOrg() {
  const departments = [...new Set(RAW_PEOPLE.map((p) => p.department))];
  for (const name of departments) {
    await db.department.upsert({ where: { name }, update: {}, create: { name } });
  }
  const deptByName = new Map(
    (await db.department.findMany({ select: { id: true, name: true } })).map((d) => [d.name, d.id]),
  );

  // the source data spells some titles two ways ("Software engineer" and
  // "Software Engineer"); use one spelling per department, the commoner one
  const spellingCount = new Map<string, Map<string, number>>();
  for (const p of RAW_PEOPLE) {
    const key = `${p.department}:${p.position.toLowerCase()}`;
    const counts = spellingCount.get(key) ?? new Map<string, number>();
    counts.set(p.position, (counts.get(p.position) ?? 0) + 1);
    spellingCount.set(key, counts);
  }
  const positionName = (department: string, position: string) => {
    const counts = spellingCount.get(`${department}:${position.toLowerCase()}`)!;
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];
  };

  for (const p of RAW_PEOPLE) {
    const departmentId = deptByName.get(p.department)!;
    await db.division.upsert({
      where: { departmentId_name: { departmentId, name: p.division } },
      update: {},
      create: { departmentId, name: p.division },
    });
    const position = positionName(p.department, p.position);
    await db.position.upsert({
      where: { name_departmentId: { name: position, departmentId } },
      update: {},
      create: { name: position, departmentId },
    });
  }

  const divByKey = new Map(
    (await db.division.findMany({ select: { id: true, name: true, departmentId: true } })).map(
      (d) => [`${d.departmentId}:${d.name}`, d.id],
    ),
  );
  const posByKey = new Map(
    (await db.position.findMany({ select: { id: true, name: true, departmentId: true } })).map(
      (p) => [`${p.departmentId}:${p.name}`, p.id],
    ),
  );
  const roleByName = new Map(
    (await db.jobRole.findMany({ select: { id: true, name: true } })).map((r) => [r.name, r.id]),
  );

  // pass 1: everyone, without managers (the graph has forward references)
  const taken = new Set<string>();
  for (const p of RAW_PEOPLE) {
    const departmentId = deptByName.get(p.department)!;
    const [firstName, ...rest] = p.name.split(" ");
    const lastName = rest.join(" ");
    // company login id, name.sur@1moby.com
    const email = suggestLoginId(firstName!, lastName, taken)!;
    taken.add(email);
    const data = {
      name: p.name,
      firstName: firstName!,
      lastName: lastName || null,
      nickname: p.nickname,
      email,
      grade: p.grade,
      businessUnit: p.businessUnit,
      jobRoleId: roleByName.get(p.jobRole)!,
      departmentId,
      divisionId: divByKey.get(`${departmentId}:${p.division}`) ?? null,
      positionId: posByKey.get(`${departmentId}:${positionName(p.department, p.position)}`) ?? null,
    } satisfies Prisma.EmployeeUncheckedCreateInput | Prisma.EmployeeUncheckedUpdateInput;

    await db.employee.upsert({
      where: { employeeCode: p.employeeId },
      update: data,
      create: { employeeCode: p.employeeId, ...data },
    });
  }

  // pass 2: reporting lines
  const byCode = new Map(
    (await db.employee.findMany({ select: { id: true, employeeCode: true } })).map((e) => [
      e.employeeCode,
      e.id,
    ]),
  );
  // widened to string: reportTo can name the admin persona, who is not staff
  const codeByDemoId = new Map<string, string>(
    RAW_PEOPLE.map((p) => [p.id as string, p.employeeId as string]),
  );
  for (const p of RAW_PEOPLE) {
    const managerCode = codeByDemoId.get(p.reportTo);
    const managerId = managerCode ? (byCode.get(managerCode) ?? null) : null;
    await db.employee.update({
      where: { employeeCode: p.employeeId },
      data: { managerId },
    });
  }
  console.log(`  employees ${RAW_PEOPLE.length}, departments ${departments.length}`);
}

async function seedAssessments() {
  // Seeding in the last weeks of a quarter would open a cycle that closes
  // almost at once; roll over to the next quarter and open it today instead.
  const DAY = 86_400_000;
  let cycle = currentCycle();
  let startsAt = cycle.start;
  if (cycle.daysRemaining < 30) {
    cycle = currentCycle(new Date(cycle.end.getTime() + DAY));
    const now = new Date();
    startsAt = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }
  const endsAt = cycle.end;
  // the seeded reviews were handed in early in the window, never in the future
  const submittedAt = new Date(Math.min(Date.now(), startsAt.getTime() + 3 * DAY));

  const dbCycle = await db.assessmentCycle.upsert({
    where: { key: cycle.id },
    update: { nameEn: cycle.nameEn, nameTh: cycle.nameTh, startsAt, endsAt },
    create: {
      key: cycle.id,
      nameEn: cycle.nameEn,
      nameTh: cycle.nameTh,
      startsAt,
      endsAt,
      status: "OPEN",
    },
  });

  const comps = await db.competency.findMany({ select: { id: true, key: true } });
  const compByKey = new Map(comps.map((c) => [c.key, c.id]));
  const employees = await db.employee.findMany({
    select: { id: true, employeeCode: true, managerId: true },
  });
  const byCode = new Map(employees.map((e) => [e.employeeCode, e]));

  let written = 0;
  for (const p of RAW_PEOPLE) {
    const subject = byCode.get(p.employeeId);
    if (!subject) continue;

    // A supervisor review needs a supervisor in the system. The one person whose
    // manager sits outside it (the Director, reporting to the CEO) keeps their
    // self assessment and shows as not yet reviewed, rather than reviewing
    // themselves — which the database now refuses anyway.
    const blocks: [("SELF" | "SUPERVISOR"), Record<string, number>, string][] = [
      ["SELF", p.selfScores as Record<string, number>, subject.id],
    ];
    if (subject.managerId) {
      blocks.push(["SUPERVISOR", p.managerScores as Record<string, number>, subject.managerId]);
    }

    for (const [mode, scores, reviewerId] of blocks) {
      const assessment = await db.assessment.upsert({
        where: {
          cycleId_subjectId_reviewerId_mode: {
            cycleId: dbCycle.id,
            subjectId: subject.id,
            reviewerId,
            mode,
          },
        },
        update: { submittedAt },
        create: {
          cycleId: dbCycle.id,
          subjectId: subject.id,
          reviewerId,
          mode,
          submittedAt,
        },
      });
      const rows = Object.entries(scores)
        .map(([key, score]) => ({
          assessmentId: assessment.id,
          competencyId: compByKey.get(key)!,
          score,
        }))
        .filter((r) => r.competencyId);
      await db.assessmentScore.createMany({ data: rows, skipDuplicates: true });
      written += rows.length;
    }
  }
  console.log(`  cycle ${cycle.nameEn}, assessment scores ${written}`);
}

async function seedLearning() {
  const comps = await db.competency.findMany({ select: { id: true, key: true } });
  const compByKey = new Map(comps.map((c) => [c.key, c.id]));

  for (const c of COURSES) {
    const course = await db.course.upsert({
      where: { slug: c.id },
      update: {
        titleEn: c.title,
        titleTh: c.titleTh ?? null,
        descriptionEn: c.description,
        descriptionTh: c.descriptionTh ?? null,
        category: c.category.toUpperCase() as "CORE" | "FUNCTIONAL" | "MANAGERIAL",
        competencyId: compByKey.get(c.competencyId) ?? null,
        hours: c.hours,
        cover: c.cover,
        status: c.status === "Published" ? "PUBLISHED" : "DRAFT",
      },
      create: {
        slug: c.id,
        titleEn: c.title,
        titleTh: c.titleTh ?? null,
        descriptionEn: c.description,
        descriptionTh: c.descriptionTh ?? null,
        category: c.category.toUpperCase() as "CORE" | "FUNCTIONAL" | "MANAGERIAL",
        competencyId: compByKey.get(c.competencyId) ?? null,
        hours: c.hours,
        cover: c.cover,
        status: c.status === "Published" ? "PUBLISHED" : "DRAFT",
      },
    });

    for (const [i, ch] of c.chapters.entries()) {
      await db.chapter.upsert({
        where: { courseId_sortOrder: { courseId: course.id, sortOrder: i } },
        update: {
          kind: chapterKind(ch).toUpperCase() as "VIDEO" | "PDF" | "ARTICLE",
          titleEn: ch.title,
          titleTh: ch.titleTh ?? null,
          summaryEn: ch.summary,
          summaryTh: ch.summaryTh ?? null,
          bulletsEn: ch.bullets,
          bulletsTh: ch.bulletsTh ?? [],
          bodyEn: ch.body ?? null,
          bodyTh: ch.bodyTh ?? null,
          minutes: ch.minutes,
          pages: ch.pages ?? null,
        },
        create: {
          courseId: course.id,
          sortOrder: i,
          kind: chapterKind(ch).toUpperCase() as "VIDEO" | "PDF" | "ARTICLE",
          titleEn: ch.title,
          titleTh: ch.titleTh ?? null,
          summaryEn: ch.summary,
          summaryTh: ch.summaryTh ?? null,
          bulletsEn: ch.bullets,
          bulletsTh: ch.bulletsTh ?? [],
          bodyEn: ch.body ?? null,
          bodyTh: ch.bodyTh ?? null,
          minutes: ch.minutes,
          pages: ch.pages ?? null,
        },
      });
    }
  }

  const courseBySlug = new Map(
    (await db.course.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]),
  );

  for (const p of LEARNING_PATHS) {
    const path = await db.learningPath.upsert({
      where: { slug: p.id },
      update: {
        titleEn: p.title,
        titleTh: p.titleTh ?? null,
        descriptionEn: p.description,
        descriptionTh: p.descriptionTh ?? null,
        targetLevel: p.targetLevel,
        audience: p.audience,
        cover: p.cover,
        projectTitleEn: p.project.title,
        projectTitleTh: p.project.titleTh ?? null,
        projectBriefEn: p.project.brief,
        projectBriefTh: p.project.briefTh ?? null,
        projectDeliverableEn: p.project.deliverable,
        projectDeliverableTh: p.project.deliverableTh ?? null,
        projectPoints: p.project.points,
      },
      create: {
        slug: p.id,
        titleEn: p.title,
        titleTh: p.titleTh ?? null,
        descriptionEn: p.description,
        descriptionTh: p.descriptionTh ?? null,
        targetLevel: p.targetLevel,
        audience: p.audience,
        cover: p.cover,
        projectTitleEn: p.project.title,
        projectTitleTh: p.project.titleTh ?? null,
        projectBriefEn: p.project.brief,
        projectBriefTh: p.project.briefTh ?? null,
        projectDeliverableEn: p.project.deliverable,
        projectDeliverableTh: p.project.deliverableTh ?? null,
        projectPoints: p.project.points,
      },
    });
    for (const [i, courseSlug] of p.courseIds.entries()) {
      const courseId = courseBySlug.get(courseSlug);
      if (!courseId) continue;
      await db.learningPathStep.upsert({
        where: { pathId_sortOrder: { pathId: path.id, sortOrder: i } },
        update: { courseId },
        create: { pathId: path.id, courseId, sortOrder: i },
      });
    }
  }
  console.log(`  courses ${COURSES.length}, learning paths ${LEARNING_PATHS.length}`);
}

/** Sample shorts and PDFs; the files themselves are already in Blob storage. */
async function seedLearningMedia() {
  const comps = new Map(
    (await db.competency.findMany({ select: { id: true, key: true } })).map((c) => [c.key, c.id]),
  );
  const courses = new Map(
    (await db.course.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]),
  );
  const now = Date.now();
  let added = 0;
  for (const [i, s] of SAMPLE_SHORTS.entries()) {
    if (await db.shortVideo.findFirst({ where: { videoUrl: s.videoUrl }, select: { id: true } })) continue;
    await db.shortVideo.create({
      data: {
        titleEn: s.titleEn,
        titleTh: s.titleTh,
        captionEn: s.captionEn,
        captionTh: s.captionTh,
        videoUrl: s.videoUrl,
        posterUrl: s.posterUrl,
        videoBytes: s.videoBytes,
        durationSec: SAMPLE_SHORT_SECONDS,
        competencyId: comps.get(s.competency) ?? null,
        courseId: courses.get(s.course) ?? null,
        status: "PUBLISHED",
        publishedAt: new Date(now - i * 3_600_000),
      },
    });
    added++;
  }
  for (const [i, d] of SAMPLE_DOCUMENTS.entries()) {
    if (await db.learningDocument.findFirst({ where: { fileUrl: d.fileUrl }, select: { id: true } })) continue;
    await db.learningDocument.create({
      data: {
        titleEn: d.titleEn,
        titleTh: d.titleTh,
        descriptionEn: d.descriptionEn,
        descriptionTh: d.descriptionTh,
        fileUrl: d.fileUrl,
        fileBytes: d.fileBytes,
        pages: d.pages,
        competencyId: d.competency ? (comps.get(d.competency) ?? null) : null,
        courseId: d.course ? (courses.get(d.course) ?? null) : null,
        status: "PUBLISHED",
        publishedAt: new Date(now - i * 3_600_000),
      },
    });
    added++;
  }
  // lesson videos for the sample courses' video chapters — only where the
  // chapter has no file of its own yet, so an admin's upload is never replaced
  let videos = 0;
  for (const v of SAMPLE_CHAPTER_VIDEOS) {
    const res = await db.chapter.updateMany({
      where: {
        course: { slug: v.course },
        sortOrder: v.sortOrder,
        kind: "VIDEO",
        OR: [{ mediaUrl: null }, { mediaUrl: v.url }],
      },
      data: { mediaUrl: v.url, mediaBytes: v.bytes, minutes: Math.max(1, Math.round(v.seconds / 60)) },
    });
    videos += res.count;
  }
  console.log(
    `  shorts ${SAMPLE_SHORTS.length}, documents ${SAMPLE_DOCUMENTS.length} (${added} new), chapter videos ${SAMPLE_CHAPTER_VIDEOS.length} (${videos} attached)`,
  );
}

async function seedEngagement() {
  for (const b of BADGES) {
    await db.badge.upsert({
      where: { key: b.id },
      update: {
        nameEn: b.name,
        nameTh: b.nameTh ?? null,
        requirementEn: b.requirement,
        requirementTh: b.requirementTh ?? null,
        tone: b.tone,
        source: b.source ?? "manual",
        target: b.target ?? null,
      },
      create: {
        key: b.id,
        nameEn: b.name,
        nameTh: b.nameTh ?? null,
        requirementEn: b.requirement,
        requirementTh: b.requirementTh ?? null,
        tone: b.tone,
        source: b.source ?? "manual",
        target: b.target ?? null,
      },
    });
  }

  for (const r of REWARDS) {
    await db.reward.upsert({
      where: { key: r.id },
      update: {
        nameEn: r.name,
        nameTh: r.nameTh ?? null,
        points: r.points,
        stock: r.stock,
        image: r.image,
        tone: r.tone,
      },
      create: {
        key: r.id,
        nameEn: r.name,
        nameTh: r.nameTh ?? null,
        points: r.points,
        stock: r.stock,
        image: r.image,
        tone: r.tone,
      },
    });
  }

  // starting balance so the leaderboard is not empty on day one
  const employees = await db.employee.findMany({ select: { id: true, employeeCode: true } });
  for (const e of employees) {
    const already = await db.pointLedger.count({
      where: { employeeId: e.id, reason: "Opening balance" },
    });
    if (already) continue;
    const seedPoints =
      2000 + (Number(e.employeeCode.replace(/\D/g, "")) % 61) * 100;
    await db.pointLedger.create({
      data: { employeeId: e.id, delta: seedPoints, reason: "Opening balance" },
    });
  }
  console.log(`  badges ${BADGES.length}, rewards ${REWARDS.length}, point ledgers ${employees.length}`);
}

async function seedComms() {
  // Written for the cycle that is open, in both languages, so the feed reads
  // as current on whatever day the system is set up.
  const cycle = await db.assessmentCycle.findFirst({
    where: { status: "OPEN" },
    orderBy: { startsAt: "desc" },
  });
  const DAY = 86_400_000;
  const now = Date.now();
  const fmt = (d: Date, locale: string) =>
    d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const closes = cycle?.endsAt ?? new Date(now + 60 * DAY);
  const seeded = [
    {
      id: "an1",
      titleEn: cycle ? `${cycle.nameEn} assessment cycle is open` : "The assessment cycle is open",
      titleTh: cycle ? `เปิดรอบการประเมิน ${cycle.nameTh} แล้ว` : "เปิดรอบการประเมินแล้ว",
      bodyEn: `Please complete your self assessment before ${fmt(closes, "en-GB")}. Managers review their teams before the cycle closes. Start with Core and Functional.`,
      bodyTh: `กรุณาทำแบบประเมินตนเองให้เสร็จก่อน ${fmt(closes, "th-TH")} หัวหน้าจะประเมินทีมก่อนปิดรอบ แนะนำให้เริ่มจากสมรรถนะหลักและสมรรถนะตามสายงาน`,
      channel: "BOTH" as const,
      status: "PUBLISHED" as const,
      publishedAt: new Date(cycle?.startsAt ?? now),
      publishAt: null,
    },
    {
      id: "an2",
      titleEn: "New course: Advanced AWS",
      titleTh: "หลักสูตรใหม่: Advanced AWS",
      bodyEn: "8 lessons, 18 hours. It counts toward the Software Architecture and Design competency.",
      bodyTh: "8 บทเรียน 18 ชั่วโมง นับเป็นการพัฒนาสมรรถนะสถาปัตยกรรมและการออกแบบซอฟต์แวร์",
      channel: "IN_APP" as const,
      status: "PUBLISHED" as const,
      publishedAt: new Date(now - 2 * DAY),
      publishAt: null,
    },
    {
      id: "an3",
      titleEn: "Reward catalogue refresh",
      titleTh: "อัปเดตรายการของรางวัล",
      bodyEn: "New tumblers and gift vouchers are coming. Points you have already earned still count.",
      bodyTh: "เตรียมพบแก้วน้ำและบัตรของขวัญใหม่ คะแนนที่สะสมไว้แล้วยังใช้ได้ตามเดิม",
      channel: "EMAIL" as const,
      // scheduled, so the manage screen shows how scheduling looks
      status: "DRAFT" as const,
      publishedAt: null,
      publishAt: new Date(now + 14 * DAY),
    },
  ];
  for (const a of seeded) {
    await db.announcement.upsert({
      where: { id: a.id },
      update: {},
      create: { ...a, audience: "ALL" },
    });
  }

  const rules = [
    { key: "idp_activity", nameEn: "New IDP activity", nameTh: "มีกิจกรรมใหม่ในแผนพัฒนา" },
    { key: "cycle_open", nameEn: "Assessment window opens", nameTh: "เปิดรอบการประเมิน" },
    { key: "deadline", nameEn: "Deadline approaching", nameTh: "ใกล้ถึงกำหนดส่ง" },
    { key: "course_assigned", nameEn: "Course assigned", nameTh: "ได้รับมอบหมายหลักสูตร" },
  ];
  for (const r of rules) {
    await db.notificationRule.upsert({
      where: { key: r.key },
      update: {},
      create: { ...r, channel: "BOTH", enabled: true },
    });
  }
  console.log(`  announcements ${seeded.length}, notification rules ${rules.length}`);
}

async function seedAccounts() {
  // Seeded staff are treated as already onboarded: an ACTIVE account with a
  // password, so the system can be used straight away. Accounts an
  // administrator creates later start PENDING and are activated by the person.
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password || password.length < 10) {
    throw new Error(
      "Set SEED_DEMO_PASSWORD (10+ characters) in .env — it becomes the password of every seeded account.",
    );
  }
  const passwordHash = await hashPassword(password);
  const roles = new Map(
    (await db.role.findMany({ select: { id: true, key: true } })).map((r) => [r.key, r.id]),
  );

  const staff = await db.employee.findMany({
    select: { id: true, email: true, name: true, _count: { select: { reports: true } } },
  });
  for (const e of staff) {
    const roleId = roles.get(e._count.reports > 0 ? "manager" : "employee") ?? null;
    const user = await db.user.upsert({
      where: { email: e.email },
      update: { name: e.name },
      create: {
        email: e.email,
        name: e.name,
        status: "ACTIVE",
        roleId,
        passwordHash,
        passwordSetAt: new Date(),
      },
      select: { id: true },
    });
    await db.employee.update({ where: { id: e.id }, data: { userId: user.id } });
  }

  // HROD runs the framework and is deliberately outside the assessed headcount,
  // so the administrator is an account with a role and no staff record.
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "neo.hro@1moby.com").toLowerCase();
  await db.user.upsert({
    where: { email: adminEmail },
    update: { roleId: roles.get("admin") ?? null },
    create: {
      email: adminEmail,
      name: "Neo (HROD)",
      status: "ACTIVE",
      roleId: roles.get("admin") ?? null,
      passwordHash,
      passwordSetAt: new Date(),
    },
  });
  console.log(`  accounts ${staff.length} staff + administrator ${adminEmail}`);
}

/**
 * A starting development plan, the way a manager would write one after the
 * review: each person's two widest gaps (supervisor score below expected),
 * raised to the expected level over the quarter, through the course written
 * for that competency. People who already have goals are left alone, so a
 * re-seed never duplicates or overwrites a real plan.
 */
async function seedDevelopmentPlans() {
  const cycle = await db.assessmentCycle.findFirst({
    where: { status: "OPEN" },
    orderBy: { startsAt: "desc" },
  });
  if (!cycle) return;

  const [people, courses] = await Promise.all([
    db.employee.findMany({
      where: { active: true, managerId: { not: null }, idpGoals: { none: {} } },
      select: {
        id: true,
        managerId: true,
        manager: { select: { name: true } },
        jobRole: {
          select: { expectedLevels: { select: { competencyId: true, level: true } } },
        },
        assessmentsAbout: {
          where: { cycleId: cycle.id, mode: "SUPERVISOR" },
          select: { scores: { select: { competencyId: true, score: true } } },
        },
      },
    }),
    db.course.findMany({
      where: { competencyId: { not: null } },
      orderBy: { createdAt: "asc" },
      select: { id: true, competencyId: true },
    }),
  ]);
  const courseFor = new Map<string, string>();
  for (const c of courses) if (!courseFor.has(c.competencyId!)) courseFor.set(c.competencyId!, c.id);

  const DAY = 86_400_000;
  const startDate = cycle.startsAt;
  const dueDate = new Date(startDate.getTime() + 90 * DAY);
  let written = 0;
  for (const p of people) {
    const scores = new Map(
      p.assessmentsAbout.flatMap((a) => a.scores).map((s) => [s.competencyId, s.score]),
    );
    const gaps = p.jobRole.expectedLevels
      .filter((e) => e.level !== null && scores.has(e.competencyId))
      .map((e) => ({ competencyId: e.competencyId, from: scores.get(e.competencyId)!, to: e.level! }))
      .filter((g) => g.from < g.to)
      .sort((a, b) => a.from - a.to - (b.from - b.to))
      .slice(0, 2);
    for (const g of gaps) {
      const courseId = courseFor.get(g.competencyId) ?? null;
      await db.idpGoal.create({
        data: {
          employeeId: p.id,
          competencyId: g.competencyId,
          courseId,
          fromLevel: g.from,
          toLevel: g.to,
          activity: courseId ? "ONLINE_COURSE" : "COACHING",
          startDate,
          dueDate,
          remark: `Assigned by ${p.manager?.name ?? "your manager"}`,
          createdById: p.managerId,
        },
      });
      written++;
    }
  }
  console.log(`  development goals ${written}`);
}

async function main() {
  // SEED_ONLY=plans adds starting development plans to an existing database
  if (process.env.SEED_ONLY === "plans") {
    await seedDevelopmentPlans();
    return;
  }
  // SEED_ONLY=media adds the sample shorts and documents to an existing database
  if (process.env.SEED_ONLY === "media") {
    await seedLearningMedia();
    return;
  }
  console.log("seeding 1Moby…");
  await seedRbac();
  await seedFramework();
  await seedOrg();
  await seedAssessments();
  await seedLearning();
  await seedLearningMedia();
  await seedDevelopmentPlans();
  await seedEngagement();
  await seedComms();
  await seedAccounts();
  console.log("done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

// referenced so the unused-import check stays honest about ACTIVITY's purpose
void ACTIVITY;
