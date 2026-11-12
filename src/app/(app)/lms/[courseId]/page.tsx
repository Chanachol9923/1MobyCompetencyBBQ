import type { Metadata } from "next";
import { requireEmployee } from "@/server/session";
import {
  ensureEnrollment,
  getCourseIdBySlug,
  getPlayerView,
} from "@/server/learning";
import { MissingCard } from "../MissingCard";
import { PlayerView } from "./PlayerView";

export const metadata: Metadata = { title: "Course" };

/**
 * The course player.
 *
 * The route parameter is `Course.slug`, and opening the page is the enrolment
 * event: `ensureEnrollment` upserts the row before anything is read, so the
 * player always has something to hang `ChapterProgress` off and two tabs
 * opening at once still produce one enrolment.
 *
 * A course whose prerequisites are not completed yet is read but not joined:
 * the player shows what to finish first, and the actions refuse progress.
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
  // a course still locked behind its prerequisites is shown, not joined
  const view = courseId ? await getPlayerView(viewer.employeeId, slug) : null;
  if (!view) return <MissingCard kind="course" />;
  if (!view.lock?.locked) await ensureEnrollment(viewer.employeeId, view.courseId);

  return <PlayerView view={view} />;
}
