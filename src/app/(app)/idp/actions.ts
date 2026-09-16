"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertEmployee, recordActivity } from "@/server/session";

/**
 * "แนบหลักฐานการเรียนรู้" — the two writes an employee makes on their own plan.
 *
 * Employees do not author goals; their manager does that in Team Profile, which
 * is already on the database. What an employee owns is the *evidence* they hang
 * on a goal, so these are the only mutations here.
 *
 * Both start from `assertEmployee()` and check the row against that id. The
 * browser sends a goal id and an evidence id, never an employee id, and neither
 * is trusted: a goal that belongs to somebody else resolves to `not_found`
 * rather than to a permission error, because the viewer should not learn that
 * it exists.
 *
 * Errors come back as *codes*, not sentences — the server has no language, the
 * client renders each one through `tt()`.
 */

export type EvidenceError =
  | "not_authorised"
  | "invalid"
  | "not_found"
  | "bad_url"
  | "short_note"
  | "no_certificate"
  | "already_attached";

export type EvidenceResult =
  | { ok: true }
  | { ok: false; error: EvidenceError };

const fail = (error: EvidenceError): EvidenceResult => ({ ok: false, error });

/** A note has to say something; four characters is the floor. */
const MIN_NOTE = 4;

const attachSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("CERTIFICATE"),
    goalId: z.string().trim().min(1).max(200),
    certificateId: z.string().trim().min(1).max(200),
  }),
  z.object({
    kind: z.literal("LINK"),
    goalId: z.string().trim().min(1).max(200),
    url: z.string().trim().min(1).max(2000),
    label: z.string().trim().max(200).default(""),
  }),
  z.object({
    kind: z.literal("NOTE"),
    goalId: z.string().trim().min(1).max(200),
    note: z.string().trim().max(4000),
  }),
]);

export type AttachEvidenceInput = z.infer<typeof attachSchema>;

/** http(s) only — a `javascript:` or `data:` reference is not a link to work. */
function httpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

const truncate = (s: string, n: number) =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s;

function revalidatePlan() {
  revalidatePath("/idp");
  revalidatePath("/team-profile");
}

export async function attachEvidenceAction(
  input: AttachEvidenceInput,
): Promise<EvidenceResult> {
  const parsed = attachSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const data = parsed.data;

  let viewer;
  try {
    viewer = await assertEmployee();
  } catch {
    return fail("not_authorised");
  }
  const employeeId = viewer.employeeId;

  // the goal id came from the browser: it only resolves inside this person's
  // own plan
  const goal = await db.idpGoal.findFirst({
    where: { id: data.goalId, employeeId },
    select: {
      id: true,
      competency: { select: { nameEn: true } },
    },
  });
  if (!goal) return fail("not_found");

  let label: string;
  let reference: string;

  if (data.kind === "CERTIFICATE") {
    const certificate = await db.certificate.findFirst({
      where: { id: data.certificateId, employeeId },
      select: { id: true, titleEn: true },
    });
    if (!certificate) return fail("no_certificate");
    label = certificate.titleEn;
    reference = certificate.id;
  } else if (data.kind === "LINK") {
    const url = httpUrl(data.url);
    if (!url) return fail("bad_url");
    reference = url.toString();
    label = data.label || url.hostname;
  } else {
    const body = data.note;
    if (body.length < MIN_NOTE) return fail("short_note");
    reference = body;
    label = truncate(body, 60);
  }

  // the same certificate or the same link twice on one goal is a mistake, not
  // a second piece of evidence
  if (data.kind !== "NOTE") {
    const clash = await db.goalEvidence.findFirst({
      where: { goalId: goal.id, kind: data.kind, reference },
      select: { id: true },
    });
    if (clash) return fail("already_attached");
  }

  await db.goalEvidence.create({
    data: { goalId: goal.id, kind: data.kind, label, reference },
  });

  await recordActivity({
    viewer,
    action: "Attached learning evidence",
    targetType: "IdpGoal",
    targetId: goal.id,
    targetLabel: goal.competency.nameEn,
    detail: `${data.kind} · ${label}`,
  });

  revalidatePlan();
  return { ok: true };
}

const removeSchema = z.object({
  evidenceId: z.string().trim().min(1).max(200),
});

export async function removeEvidenceAction(
  input: z.infer<typeof removeSchema>,
): Promise<EvidenceResult> {
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");

  let viewer;
  try {
    viewer = await assertEmployee();
  } catch {
    return fail("not_authorised");
  }

  // scoped through the goal, so an id belonging to somebody else finds nothing
  const item = await db.goalEvidence.findFirst({
    where: { id: parsed.data.evidenceId, goal: { employeeId: viewer.employeeId } },
    select: {
      id: true,
      kind: true,
      label: true,
      goalId: true,
      goal: { select: { competency: { select: { nameEn: true } } } },
    },
  });
  if (!item) return fail("not_found");

  // only the link between the goal and the proof goes; the certificate itself
  // is a record of something that really happened and is never deleted here
  await db.goalEvidence.delete({ where: { id: item.id } });

  await recordActivity({
    viewer,
    action: "Removed learning evidence",
    targetType: "IdpGoal",
    targetId: item.goalId,
    targetLabel: item.goal.competency.nameEn,
    detail: `${item.kind} · ${item.label}`,
  });

  revalidatePlan();
  return { ok: true };
}
