import type { Metadata } from "next";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission } from "@/server/session";
import { getLmsAdminData } from "@/server/admin-content";
import { getMediaAdminData } from "@/server/learning-media";
import {
  LearningAdminScreen,
  type LearningAdminTab,
} from "@/components/admin/LearningAdminScreen";

export const metadata: Metadata = { title: "Manage learning" };

export const dynamic = "force-dynamic";

export default async function ManageLmsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission(PERMISSIONS.MANAGE_LMS);
  const { tab } = await searchParams;
  const current: LearningAdminTab =
    tab === "shorts" || tab === "documents" ? tab : "courses";
  const [courses, media] = await Promise.all([getLmsAdminData(), getMediaAdminData()]);
  return <LearningAdminScreen tab={current} courses={courses} media={media} />;
}
