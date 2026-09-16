import type { Metadata } from "next";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission } from "@/server/session";
import { getActivityPage } from "@/server/admin-users";
import { AuditScreen } from "@/components/admin/AuditScreen";
import { AUDIT_PAGE_SIZE, type AuditFilters } from "@/components/admin/admin-types";

export const metadata: Metadata = { title: "Activity log" };

export const dynamic = "force-dynamic";

/** `?a=1&a=2` is a possibility the framework allows; take the first value. */
const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? "";

/**
 * The trail comes from the database now, not the browser store. The filters
 * are URL state so a particular view of the log is a link someone can send,
 * and so the query — not the client — does the work.
 */
export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission(PERMISSIONS.VIEW_AUDIT_LOG);
  const sp = await searchParams;

  const filters: AuditFilters = {
    actorId: one(sp.actor),
    action: one(sp.action),
    from: one(sp.from),
    to: one(sp.to),
    q: one(sp.q),
  };
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const data = await getActivityPage({
    ...filters,
    page,
    pageSize: AUDIT_PAGE_SIZE,
  });

  return <AuditScreen data={data} filters={filters} />;
}
