import {
  LEARNING_PATHS,
  findCourse,
  pathProgressKey,
  type Course,
  type LearningPath,
  type PathProject,
} from "@/data/learning";
import type { DemoState } from "@/lib/store";

export type StepState = "locked" | "available" | "in-progress" | "complete";

export type PathStep =
  | {
      kind: "course";
      index: number;
      course: Course;
      state: StepState;
      progress: number;
    }
  | {
      kind: "project";
      index: number;
      project: PathProject;
      state: StepState;
      progress: number;
    };

/**
 * The journey: five course steps then the final project. A step only unlocks
 * when the one before it is complete.
 */
export function pathSteps(state: DemoState, path: LearningPath): PathStep[] {
  const steps: PathStep[] = [];
  let previousComplete = true;

  path.courseIds.forEach((id, i) => {
    const course = findCourse(id);
    if (!course) return;
    const progress = state.courseProgress[id] ?? 0;
    const complete = progress >= 100;
    const unlocked = previousComplete;
    steps.push({
      kind: "course",
      index: i,
      course,
      progress,
      state: complete
        ? "complete"
        : !unlocked
          ? "locked"
          : progress > 0
            ? "in-progress"
            : "available",
    });
    previousComplete = complete;
  });

  const projectProgress = state.courseProgress[pathProgressKey(path.id)] ?? 0;
  steps.push({
    kind: "project",
    index: steps.length,
    project: path.project,
    progress: projectProgress,
    state:
      projectProgress >= 100
        ? "complete"
        : previousComplete
          ? "available"
          : "locked",
  });

  return steps;
}

export function pathCompletion(state: DemoState, path: LearningPath) {
  const steps = pathSteps(state, path);
  const done = steps.filter((s) => s.state === "complete").length;
  const total = steps.length;
  return {
    steps,
    done,
    total,
    percent: total ? Math.round((done / total) * 100) : 0,
    complete: total > 0 && done === total,
  };
}

/** How many learning paths the demo user has fully completed. */
export function pathsCompleted(state: DemoState) {
  return LEARNING_PATHS.filter((p) => pathCompletion(state, p).complete).length;
}
