import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    max: Number(process.env.DB_POOL_MAX ?? 5),
  }),
});

async function main() {
  const counts = {
    employees: await db.employee.count(),
    competencies: await db.competency.count(),
    expectedCells: await db.expectedLevel.count(),
    notAssessedCells: await db.expectedLevel.count({ where: { level: null } }),
    assessments: await db.assessment.count(),
    scores: await db.assessmentScore.count(),
    courses: await db.course.count(),
    chapters: await db.chapter.count(),
    roles: await db.role.count(),
    permissions: await db.permission.count(),
    announcements: await db.announcement.count(),
  };
  console.log("counts:", JSON.stringify(counts, null, 1));

  const boss = await db.employee.findFirst({
    where: { name: "Boss Kitty" },
    select: {
      id: true,
      name: true,
      jobRole: { select: { name: true, level: true } },
      reports: { select: { name: true } },
    },
  });
  console.log(
    `\nmanager: ${boss?.name} — ${boss?.jobRole.name} (${boss?.jobRole.level}), ${boss?.reports.length} reports`,
  );

  const exec = await db.jobRole.findFirst({
    where: { name: "Executive" },
    select: {
      expectedLevels: {
        where: { level: null },
        select: { competency: { select: { key: true } } },
      },
    },
  });
  console.log(
    "Executive is NOT assessed on:",
    exec?.expectedLevels.map((e) => e.competency.key).join(", ") || "(nothing)",
  );

  // the 180 degree pair for one person
  if (boss) {
    const rows = await db.assessment.findMany({
      where: { subjectId: boss.id },
      select: { mode: true, scores: { select: { score: true } } },
    });
    for (const r of rows) {
      const avg =
        r.scores.reduce((a, s) => a + s.score, 0) / (r.scores.length || 1);
      console.log(`  ${r.mode}: ${r.scores.length} scores, avg ${avg.toFixed(2)}`);
    }
  }

  const adminRole = await db.role.findUnique({
    where: { key: "admin" },
    select: { permissions: { select: { permission: { select: { key: true } } } } },
  });
  console.log(
    `\nadmin role holds ${adminRole?.permissions.length} permissions`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
