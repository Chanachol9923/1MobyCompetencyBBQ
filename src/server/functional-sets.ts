"use server";

/**
 * Functional competencies per job position (handoff task 8): creating a
 * functional competency, and choosing which ones a position is assessed on.
 *
 * What a person is assessed on is decided in `assessed-competencies.ts`; this
 * module only changes its inputs. Both changes reach people mid-cycle, so the
 * position change is previewed first — how many people, which competencies
 * they gain or lose, how many existing scores stop counting — the same
 * "confirm with impact" step as the expected-level matrix, and the affected
 * people's assigned courses are recomputed afterwards.
 *
 * Nothing here works before migration 0017 (the `PositionCompetency` table
 * and `Competency.defaultFunctional`): the actions say so instead of writing.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { NotAuthorised, assertPermission, recordActivity, type Viewer } from "@/server/session";
import { syncCourseAssignments } from "@/server/course-assignment";
import {
  DEFAULT_FUNCTIONAL_EXPECTED,
  assessedSetOf,
  functionalSetOf,
  loadAssessmentRules,
  type AssessmentRules,
} from "@/server/assessed-competencies";
import type { ActionResult, Bilingual } from "@/components/admin/admin-types";
import type {
  FunctionalSetImpact,
  FunctionalSetsData,
} from "@/components/admin/content-types";

/** The brief: five functional competencies per position. A warning, not a rule. */
const BRIEF_SET_SIZE = 5;

const msg = (en: string, th: string): Bilingual => ({ en, th });
const fail = (en: string, th: string): { ok: false; error: Bilingual } => ({ ok: false, error: msg(en, th) });

const NOT_READY = fail(
  "Functional competencies per position need database migration 0017, which has not been applied yet.",
  "สมรรถนะเฉพาะตามตำแหน่งต้องใช้ migration 0017 ของฐานข้อมูล ซึ่งยังไม่ได้รัน",
);

async function guard(permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]): Promise<Viewer | { ok: false; error: Bilingual }> {
  try {
    return await assertPermission(permission);
  } catch (err) {
    if (err instanceof NotAuthorised) return fail(err.message, "คุณไม่มีสิทธิ์ดำเนินการนี้");
    throw err;
  }
}
const refused = (v: Viewer | { ok: false; error: Bilingual }): v is { ok: false; error: Bilingual } =>
  "ok" in v && v.ok === false;

function revalidateFramework() {
  for (const p of ["/admin/employee", "/admin/assessment", "/admin", "/assessment", "/dashboard", "/team-profile", "/reports", "/idp", "/lms"]) {
    revalidatePath(p);
  }
}

/* ------------------------------------------------------------------ read */

/** What the position screen needs: the functional competencies and each position's own set. */
export async function getFunctionalSetsData(): Promise<FunctionalSetsData> {
  await assertPermission(PERMISSIONS.MANAGE_USERS);
  const rules = await loadAssessmentRules();
  const functional = await db.competency.findMany({
    where: { group: "FUNCTIONAL" },
    orderBy: { sortOrder: "asc" },
    select: { id: true, nameEn: true, nameTh: true },
  });
  const isDefault = new Set(rules.competencies.filter((c) => c.defaultFunctional).map((c) => c.id));
  return {
    ready: rules.ready,
    briefSetSize: BRIEF_SET_SIZE,
    competencies: functional.map((c) => ({ ...c, defaultFunctional: isDefault.has(c.id) })),
    sets: Object.fromEntries([...rules.positionSets].map(([positionId, ids]) => [positionId, [...ids]])),
  };
}

/* ------------------------------------------------- a position's functional set */

const setSchema = z.object({
  positionId: z.string().min(1).max(64),
  /** null = back to the default set; otherwise the position's own set */
  competencyIds: z.array(z.string().min(1).max(64)).min(1).max(30).nullable(),
});

type Planned =
  | { ok: false; error: Bilingual }
  | {
      ok: true;
      position: { id: string; name: string };
      next: string[] | null;
      impact: FunctionalSetImpact;
      people: string[];
    };

/** The change and what it does, without writing anything. */
async function plan(input: z.input<typeof setSchema>): Promise<Planned> {
  const parsed = setSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      "Choose at least one functional competency, or go back to the default set.",
      "เลือกสมรรถนะเฉพาะอย่างน้อยหนึ่งรายการ หรือกลับไปใช้ชุดเริ่มต้น",
    );
  }
  const rules = await loadAssessmentRules();
  if (!rules.ready) return NOT_READY;

  const { positionId } = parsed.data;
  const position = await db.position.findUnique({ where: { id: positionId }, select: { id: true, name: true } });
  if (!position) return fail("That position no longer exists.", "ไม่พบตำแหน่งนี้แล้ว");

  const functional = new Set(rules.competencies.filter((c) => c.group === "FUNCTIONAL").map((c) => c.id));
  const next = parsed.data.competencyIds ? [...new Set(parsed.data.competencyIds)] : null;
  if (next && next.some((id) => !functional.has(id))) {
    return fail(
      "Only functional competencies can be chosen for a position.",
      "เลือกได้เฉพาะสมรรถนะเฉพาะตามสายงาน (Functional) เท่านั้น",
    );
  }

  // the rules as they would be after the change
  const after: AssessmentRules = { ...rules, positionSets: new Map(rules.positionSets) };
  if (next) after.positionSets.set(positionId, new Set(next));
  else after.positionSets.delete(positionId);

  const [people, cycle] = await Promise.all([
    db.employee.findMany({
      where: { positionId, active: true },
      select: { id: true, jobRoleId: true, positionId: true },
    }),
    db.assessmentCycle.findFirst({ where: { status: "OPEN" }, orderBy: { startsAt: "desc" }, select: { id: true } }),
  ]);

  // per person: what leaves their set, what joins it
  const added = new Set<string>();
  const removed = new Set<string>();
  const lost: { subjectId: string; competencyId: string }[] = [];
  let changedPeople = 0;
  for (const p of people) {
    const before = assessedSetOf(rules, p);
    const later = assessedSetOf(after, p);
    let changed = false;
    for (const id of before.keys()) {
      if (!later.has(id)) {
        removed.add(id);
        lost.push({ subjectId: p.id, competencyId: id });
        changed = true;
      }
    }
    for (const id of later.keys()) {
      if (!before.has(id)) {
        added.add(id);
        changed = true;
      }
    }
    if (changed) changedPeople++;
  }

  // scores already given this cycle on what they stop being assessed on
  const scoresOrphaned =
    cycle && lost.length
      ? await db.assessmentScore.count({
          where: {
            assessment: { cycleId: cycle.id },
            OR: lost.map((l) => ({ competencyId: l.competencyId, assessment: { subjectId: l.subjectId } })),
          },
        })
      : 0;

  const size = next ? next.length : functionalSetOf(rules, null).size;
  return {
    ok: true,
    position,
    next,
    people: people.map((p) => p.id),
    impact: {
      positionName: position.name,
      usesDefault: next === null,
      setSize: size,
      notBriefSize: size !== BRIEF_SET_SIZE,
      people: people.length,
      peopleChanged: changedPeople,
      added: [...added],
      removed: [...removed],
      scoresOrphaned,
    },
  };
}

/** The impact of a change to a position's functional set, before it is made. */
export async function previewPositionFunctionalSet(
  input: z.input<typeof setSchema>,
): Promise<{ ok: true; impact: FunctionalSetImpact } | { ok: false; error: Bilingual }> {
  const viewer = await guard(PERMISSIONS.MANAGE_FRAMEWORK);
  if (refused(viewer)) return viewer;
  const p = await plan(input);
  return p.ok ? { ok: true, impact: p.impact } : p;
}

/**
 * Replace a position's functional set (or hand it back to the default). The
 * people in it are assessed on the new set from now on; scores already given
 * on competencies that leave the set are kept but stop counting, and their
 * assigned courses are recomputed.
 */
export async function setPositionFunctionalSet(input: z.input<typeof setSchema>): Promise<ActionResult> {
  const viewer = await guard(PERMISSIONS.MANAGE_FRAMEWORK);
  if (refused(viewer)) return viewer;
  const p = await plan(input);
  if (!p.ok) return p;
  const { position, next, impact } = p;

  await db.$transaction([
    db.positionCompetency.deleteMany({ where: { positionId: position.id } }),
    ...(next
      ? [db.positionCompetency.createMany({ data: next.map((competencyId) => ({ positionId: position.id, competencyId })) })]
      : []),
  ]);

  await recordActivity({
    viewer,
    action: "Set position functional competencies",
    targetType: "position",
    targetId: position.id,
    targetLabel: position.name,
    detail: `${next ? `${next.length} competencies` : "default set"}; ${impact.peopleChanged}/${impact.people} people changed; ${impact.scoresOrphaned} score(s) stop counting`,
  });
  if (p.people.length) {
    await syncCourseAssignments(p.people).catch((err) => console.error("course assignment failed", err));
  }
  revalidateFramework();

  const warn = impact.notBriefSize
    ? msg(
        ` Note: the brief asks for ${BRIEF_SET_SIZE} functional competencies per position; this one has ${impact.setSize}.`,
        ` หมายเหตุ: brief กำหนดสมรรถนะเฉพาะ ${BRIEF_SET_SIZE} รายการต่อตำแหน่ง ตำแหน่งนี้มี ${impact.setSize} รายการ`,
      )
    : msg("", "");
  return {
    ok: true,
    message: msg(
      `"${position.name}" now uses ${next ? "its own functional set" : "the default functional set"}. ${impact.peopleChanged} of ${impact.people} people are assessed on something different${impact.scoresOrphaned ? `, and ${impact.scoresOrphaned} existing score(s) stop being counted` : ""}.${warn.en}`,
      `ตำแหน่ง "${position.name}" ใช้${next ? "ชุดสมรรถนะเฉพาะของตำแหน่งเอง" : "ชุดสมรรถนะเฉพาะเริ่มต้น"}แล้ว พนักงาน ${impact.peopleChanged} จาก ${impact.people} คนจะถูกประเมินต่างจากเดิม${impact.scoresOrphaned ? ` และคะแนนเดิม ${impact.scoresOrphaned} รายการจะไม่ถูกนำมาคิด` : ""}${warn.th}`,
    ),
  };
}

/* ------------------------------------------ a new functional competency */

const levelSchema = z.object({
  score: z.number().int().min(1).max(4),
  descEn: z.string().trim().max(1000).optional().default(""),
  descTh: z.string().trim().max(1000).optional().default(""),
});

const createSchema = z.object({
  nameEn: z.string().trim().min(1).max(160),
  nameTh: z.string().trim().max(160).optional().default(""),
  definitionEn: z.string().trim().max(4000).optional().default(""),
  definitionTh: z.string().trim().max(4000).optional().default(""),
  levels: z.array(levelSchema).length(4),
});

/** The rating scale's own names, the same on every competency (brief 1.2). */
const LEVEL_LABELS: Record<number, Bilingual> = {
  4: { en: "Exceeds Expectations", th: "ทำได้เกินความคาดหมายอย่างมาก เป็นต้นแบบได้" },
  3: { en: "Meets Expectations", th: "ทำได้ตามมาตรฐานที่กำหนด สม่ำเสมอ" },
  2: { en: "Needs Improvement", th: "ทำได้ต่ำกว่ามาตรฐานในบางส่วน ต้องได้รับการพัฒนา" },
  1: { en: "Unacceptable", th: "ผลงานต่ำกว่ามาตรฐานอย่างมาก ต้องปรับปรุงเร่งด่วน" },
};

function slugify(value: string) {
  const base = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "competency";
}

/**
 * A new FUNCTIONAL competency. It is not in the default set, so nobody is
 * assessed on it until a position chooses it. Every career role gets an
 * expected level for it at once: the default level for roles assessed on
 * functional competencies, "not assessed" for the others (C Suite) — editable
 * in the matrix like any other cell.
 */
export async function createFunctionalCompetency(input: z.input<typeof createSchema>): Promise<ActionResult> {
  const viewer = await guard(PERMISSIONS.MANAGE_FRAMEWORK);
  if (refused(viewer)) return viewer;
  const parsed = createSchema.safeParse(input);
  if (!parsed.success || new Set(parsed.data.levels.map((l) => l.score)).size !== 4) {
    return fail(
      "A competency needs an English name and a description for each of the four levels.",
      "สมรรถนะต้องมีชื่อภาษาอังกฤษ และคำอธิบายครบทั้ง 4 ระดับ",
    );
  }
  const d = parsed.data;
  const rules = await loadAssessmentRules();
  if (!rules.ready) return NOT_READY;

  const clash = await db.competency.findFirst({
    where: { nameEn: { equals: d.nameEn, mode: "insensitive" } },
    select: { id: true },
  });
  if (clash) {
    return fail(`A competency called "${d.nameEn}" already exists.`, `มีสมรรถนะชื่อ "${d.nameEn}" อยู่แล้ว`);
  }

  const base = slugify(d.nameEn);
  let key = base;
  for (let i = 2; await db.competency.findUnique({ where: { key }, select: { id: true } }); i++) key = `${base}-${i}`;

  const [last, roles] = await Promise.all([
    db.competency.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } }),
    db.jobRole.findMany({ select: { id: true } }),
  ]);
  const functionalIds = rules.competencies.filter((c) => c.group === "FUNCTIONAL").map((c) => c.id);

  const created = await db.$transaction(async (tx) => {
    const c = await tx.competency.create({
      data: {
        key,
        group: "FUNCTIONAL",
        nameEn: d.nameEn,
        nameTh: d.nameTh || null,
        definitionEn: d.definitionEn || null,
        definitionTh: d.definitionTh || null,
        sortOrder: (last?.sortOrder ?? 0) + 1,
        defaultFunctional: false,
        levels: {
          create: d.levels.map((l) => ({
            score: l.score,
            labelEn: LEVEL_LABELS[l.score]!.en,
            labelTh: LEVEL_LABELS[l.score]!.th,
            descEn: l.descEn || null,
            descTh: l.descTh || null,
          })),
        },
      },
      select: { id: true, nameEn: true },
    });
    await tx.expectedLevel.createMany({
      data: roles.map((r) => {
        const levels = rules.expected.get(r.id);
        const assessesFunctional = functionalIds.some((id) => (levels?.get(id) ?? null) !== null);
        return {
          jobRoleId: r.id,
          competencyId: c.id,
          level: assessesFunctional ? DEFAULT_FUNCTIONAL_EXPECTED : null,
        };
      }),
      skipDuplicates: true,
    });
    return c;
  });

  await recordActivity({
    viewer,
    action: "Created functional competency",
    targetType: "competency",
    targetId: created.id,
    targetLabel: created.nameEn,
    detail: `key ${key}; expected level ${DEFAULT_FUNCTIONAL_EXPECTED} for roles assessed on functional competencies`,
  });
  revalidateFramework();
  return {
    ok: true,
    message: msg(
      `"${created.nameEn}" created. Nobody is assessed on it until a position chooses it (Staff records → Position). Each career role expects level ${DEFAULT_FUNCTIONAL_EXPECTED}; change that in the matrix.`,
      `สร้างสมรรถนะ "${d.nameTh || created.nameEn}" แล้ว จะยังไม่มีใครถูกประเมินจนกว่าจะเลือกให้ตำแหน่งใดตำแหน่งหนึ่ง (ข้อมูลพนักงาน → ตำแหน่ง) ทุกบทบาทคาดหวังระดับ ${DEFAULT_FUNCTIONAL_EXPECTED} แก้ไขได้ในตาราง`,
    ),
  };
}
