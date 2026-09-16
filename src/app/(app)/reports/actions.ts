"use server";

import { z } from "zod";
import { can, PERMISSIONS } from "@/lib/permissions";
import { assertViewer, recordActivity } from "@/server/session";

/**
 * An export is a read, but it leaves the building — so it goes in the audit
 * trail like every other consequential act. The scope is re-checked here rather
 * than trusted from the browser.
 */
const schema = z.object({
  scope: z.enum(["me", "team", "company"]),
  caption: z.string().max(200),
  detail: z.string().max(200),
});

export async function recordExportAction(
  input: z.infer<typeof schema>,
): Promise<{ ok: boolean }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { scope, caption, detail } = parsed.data;

  let viewer;
  try {
    viewer = await assertViewer();
  } catch {
    return { ok: false };
  }

  const allowed =
    scope === "me"
      ? Boolean(viewer.employeeId)
      : scope === "team"
        ? can(viewer.permissions, PERMISSIONS.SEE_TEAM_RESULT)
        : can(viewer.permissions, PERMISSIONS.SEE_COMPANY_REPORT);
  if (!allowed) return { ok: false };

  await recordActivity({
    viewer,
    action: "Exported gap analysis report",
    targetType: "Report",
    targetLabel: caption,
    detail,
  });
  return { ok: true };
}
