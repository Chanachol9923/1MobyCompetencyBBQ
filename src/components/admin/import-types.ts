/** Shapes for the employee import (kept out of the "use server" module). */

export type ImportMessage = { en: string; th: string };

export type ImportRowAction = "create" | "update" | "same" | "error";

export type ImportRowPlan = {
  /** the line in the sheet, counting the header as line 1 */
  line: number;
  code: string;
  name: string;
  action: ImportRowAction;
  /** what will change on an existing record, e.g. "Level: Senior → Team Lead" */
  changes: ImportMessage[];
  /** why the row cannot be brought in */
  problems: ImportMessage[];
  /** brought in, but something was left as it was */
  warnings: ImportMessage[];
};

export type ImportPlan = {
  rows: ImportRowPlan[];
  counts: Record<ImportRowAction, number>;
  /** organisation units the import will add */
  create: { departments: string[]; divisions: string[]; positions: string[] };
  /** columns the header row was read as, for the preview */
  columns: string[];
};

export type ImportResult =
  | { ok: true; plan: ImportPlan; created: number; updated: number }
  | { ok: false; error: { en: string; th: string } };
