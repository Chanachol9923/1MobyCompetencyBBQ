import { requireEmployee } from "@/server/session";
import { getPathView } from "@/server/learning";
import { MissingCard } from "../../MissingCard";
import { PathJourney } from "./PathJourney";

/**
 * One learning path. The route parameter is `LearningPath.slug`.
 *
 * The steps come from `LearningPathStep` and unlock in order on real
 * completion — the state is recomputed from this person's chapter rows every
 * time the page is read, never stored, so it cannot drift from what they
 * actually finished.
 */
export default async function LearningPathPage({
  params,
}: {
  params: Promise<{ pathId: string }>;
}) {
  const viewer = await requireEmployee();
  const { pathId: slug } = await params;

  const path = await getPathView(viewer.employeeId, slug);
  if (!path) return <MissingCard kind="path" />;

  return <PathJourney path={path} />;
}
