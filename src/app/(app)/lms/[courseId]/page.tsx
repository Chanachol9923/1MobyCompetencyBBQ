import { requireEmployee } from "@/server/session";
import {
  ensureEnrollment,
  getCourseIdBySlug,
  getPlayerView,
} from "@/server/learning";
import { MissingCard } from "../MissingCard";
import { PlayerView } from "./PlayerView";

/**
 * The course player.
 *
 * The route parameter is `Course.slug`, and opening the page is the enrolment
 * event: `ensureEnrollment` upserts the row before anything is read, so the
 * player always has something to hang `ChapterProgress` off and two tabs
 * opening at once still produce one enrolment.
 *
 * Whose progress this is comes from the session. There is no way to ask this
 * page for somebody else's.
 */
export default async function CoursePlayerPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const viewer = await requireEmployee();
  const { courseId: slug } = await params;

  const courseId = await getCourseIdBySlug(slug);
  if (courseId) await ensureEnrollment(viewer.employeeId, courseId);

  const view = courseId ? await getPlayerView(viewer.employeeId, slug) : null;
  if (!view) return <MissingCard kind="course" />;

  return <PlayerView view={view} />;
}
