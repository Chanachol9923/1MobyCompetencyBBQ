import type { Metadata } from "next";
import { Suspense } from "react";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission } from "@/server/session";
import { getProblemsAdminData } from "@/server/problems";
import { ProblemsAdminScreen } from "@/components/problems/ProblemsAdminScreen";

export const metadata: Metadata = { title: "Problem reports" };

export const dynamic = "force-dynamic";

export default async function ProblemsPage() {
  await requirePermission(PERMISSIONS.MANAGE_PROBLEMS);
  const data = await getProblemsAdminData();
  return (
    <Suspense>
      <ProblemsAdminScreen data={data} />
    </Suspense>
  );
}
