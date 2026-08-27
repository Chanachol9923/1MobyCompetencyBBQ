import { COURSES, type Chapter, type Course } from "@/data/learning";
import type { DemoState } from "@/lib/store";

/**
 * The catalogue as the LMS should read it.
 *
 * `state.courses` is persisted to localStorage, so a browser that ran an
 * earlier build still holds course rows without the phase-2 fields (Thai copy,
 * content type, article bodies) and is missing courses added to the seed data
 * since. Merge the seed back in: anything the admin screens can edit still
 * wins, the new fields are filled from the seed, and seed-only courses are
 * appended.
 */

function mergeChapter(saved: Chapter, seed: Chapter | undefined): Chapter {
  if (!seed) return saved;
  return {
    ...saved,
    titleTh: saved.titleTh ?? seed.titleTh,
    summaryTh: saved.summaryTh ?? seed.summaryTh,
    bullets: saved.bullets.length ? saved.bullets : seed.bullets,
    bulletsTh: saved.bulletsTh ?? seed.bulletsTh,
    kind: saved.kind ?? seed.kind,
    pages: saved.pages ?? seed.pages,
    body: saved.body ?? seed.body,
    bodyTh: saved.bodyTh ?? seed.bodyTh,
  };
}

function mergeCourse(saved: Course): Course {
  const seed = COURSES.find((c) => c.id === saved.id);
  if (!seed) return saved;
  return {
    ...saved,
    titleTh: saved.titleTh ?? seed.titleTh,
    descriptionTh: saved.descriptionTh ?? seed.descriptionTh,
    chapters: saved.chapters.map((ch) =>
      mergeChapter(
        ch,
        seed.chapters.find((s) => s.id === ch.id),
      ),
    ),
  };
}

export function libraryCourses(state: DemoState): Course[] {
  const saved = state.courses ?? [];
  const seen = new Set(saved.map((c) => c.id));
  return [
    ...saved.map(mergeCourse),
    ...COURSES.filter((c) => !seen.has(c.id)),
  ];
}

export function libraryCourse(state: DemoState, id: string) {
  return libraryCourses(state).find((c) => c.id === id);
}
