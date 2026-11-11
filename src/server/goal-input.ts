import { z } from "zod";

/**
 * The fields of a development goal, shared by the two places that write one:
 * a manager in Team Profile (`team-profile/actions.ts`) and the employee on
 * their own plan (`idp/actions.ts`). Each adds its own ids and decides who may
 * write; what a valid goal *is* is written once, here.
 */

export const GOAL_ACTIVITIES = ["ONLINE_COURSE", "COACHING", "ON_THE_JOB"] as const;

const isoDay = /^\d{4}-\d{2}-\d{2}$/;

export const goalFieldsSchema = z.object({
  competencyId: z.string().min(1),
  courseId: z.string().min(1).nullable(),
  fromLevel: z.number().int().min(0).max(4),
  toLevel: z.number().int().min(1).max(4),
  activity: z.enum(GOAL_ACTIVITIES),
  startDate: z.string().regex(isoDay),
  dueDate: z.string().regex(isoDay),
  note: z.string().max(500),
});

export type GoalFields = z.infer<typeof goalFieldsSchema>;

/** Separator the form uses to split the stamp from the author's own words. */
export const NOTE_SEP = " — ";

/** The checks zod cannot express: dates in order, a level actually raised. */
export function goalShapeError(data: GoalFields): "bad_dates" | "bad_levels" | null {
  if (Date.parse(data.dueDate) <= Date.parse(data.startDate)) return "bad_dates";
  // a goal raises a level; the database refuses anything else too
  if (data.toLevel <= data.fromLevel) return "bad_levels";
  return null;
}

/** The columns a goal's fields map onto. */
export function goalColumns(data: GoalFields, remark: string) {
  return {
    competencyId: data.competencyId,
    courseId: data.courseId,
    fromLevel: data.fromLevel,
    toLevel: data.toLevel,
    activity: data.activity,
    startDate: new Date(`${data.startDate}T00:00:00.000Z`),
    dueDate: new Date(`${data.dueDate}T00:00:00.000Z`),
    remark,
  };
}
