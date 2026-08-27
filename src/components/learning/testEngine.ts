import type { Course } from "@/data/learning";

/**
 * Deterministic pre/post test generator.
 *
 * Questions are built from the course's own chapters — the correct option is a
 * behavioural indicator from the chapter, the distractors come from the other
 * chapters (or from a small generic pool when the course is short). The seed is
 * derived from the course id and the variant, so the pre-test and the post-test
 * are different papers but each one is stable across reloads.
 */

export type Bilingual = { en: string; th: string };

export type TestQuestion = {
  id: string;
  stem: Bilingual;
  options: Bilingual[];
  answerIndex: number;
};

export type TestVariant = "pre" | "post";

/* ------------------------------------------------------------------ helpers */

function seed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let x = Math.imul(h ^ (h >>> 15), 1 | h);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const GENERIC_WRONG: Bilingual[] = [
  {
    en: "Waits for someone else to raise the risk in the meeting.",
    th: "รอให้คนอื่นเป็นคนหยิบยกความเสี่ยงขึ้นมาในที่ประชุม",
  },
  {
    en: "Skips the retrospective whenever the sprint went well.",
    th: "ข้ามการทบทวนงานทุกครั้งที่รอบการทำงานผ่านไปได้ด้วยดี",
  },
  {
    en: "Keeps the decision in one person's head so it stays flexible.",
    th: "เก็บการตัดสินใจไว้ในหัวคนเดียวเพื่อให้ยืดหยุ่นไว้ก่อน",
  },
  {
    en: "Adds the same buffer to every estimate regardless of uncertainty.",
    th: "บวกเวลาสำรองเท่ากันทุกงานโดยไม่สนใจระดับความไม่แน่นอน",
  },
  {
    en: "Announces the change and moves on without checking it landed.",
    th: "ประกาศการเปลี่ยนแปลงแล้วเดินหน้าต่อโดยไม่ตรวจว่าสื่อสารถึงจริงหรือไม่",
  },
  {
    en: "Documents the process only after someone complains about it.",
    th: "เขียนเอกสารกระบวนการก็ต่อเมื่อมีคนบ่นถึงมันแล้วเท่านั้น",
  },
];

const STEMS: Record<TestVariant, (chapter: string) => Bilingual> = {
  pre: (chapter) => ({
    en: `Before you start — which behaviour does “${chapter}” ask for?`,
    th: `ก่อนเริ่มเรียน — บทเรียน “${chapter}” ต้องการพฤติกรรมแบบใด`,
  }),
  post: (chapter) => ({
    en: `Which behaviour does “${chapter}” ask for?`,
    th: `บทเรียน “${chapter}” ต้องการพฤติกรรมแบบใด`,
  }),
};

type Indicator = Bilingual & { chapterEn: string; chapterTh: string };

function indicatorsOf(course: Course): Indicator[] {
  const out: Indicator[] = [];
  course.chapters.forEach((ch) => {
    ch.bullets.forEach((b, i) => {
      out.push({
        en: b,
        th: ch.bulletsTh?.[i] ?? b,
        chapterEn: ch.title,
        chapterTh: ch.titleTh ?? ch.title,
      });
    });
  });
  return out;
}

/* --------------------------------------------------------------- generator */

export function buildCourseTest(
  course: Course,
  variant: TestVariant,
): TestQuestion[] {
  const pool = indicatorsOf(course);
  if (!pool.length) return [];

  const rnd = seed(`${course.id}:${variant}`);
  const count = Math.min(5, Math.max(3, pool.length));

  // rotate the starting point so pre and post do not open on the same indicator
  const offset = variant === "post" ? Math.floor(pool.length / 2) : 0;

  return Array.from({ length: count }, (_, i) => {
    const correct = pool[(i + offset) % pool.length]!;
    const others = pool.filter((p) => p.en !== correct.en);
    const distractors: Bilingual[] = [];

    while (distractors.length < 2 && others.length) {
      const pick = others.splice(Math.floor(rnd() * others.length), 1)[0]!;
      if (!distractors.some((d) => d.en === pick.en)) distractors.push(pick);
    }
    let g = Math.floor(rnd() * GENERIC_WRONG.length);
    while (distractors.length < 3) {
      const pick = GENERIC_WRONG[g % GENERIC_WRONG.length]!;
      g += 1;
      if (!distractors.some((d) => d.en === pick.en)) distractors.push(pick);
    }

    const options = [correct as Bilingual, ...distractors];
    const shift = Math.floor(rnd() * options.length);
    const rotated = [...options.slice(shift), ...options.slice(0, shift)];

    return {
      id: `${course.id}-${variant}-${i}`,
      stem: {
        en: STEMS[variant](correct.chapterEn).en,
        th: STEMS[variant](correct.chapterTh).th,
      },
      options: rotated,
      answerIndex: rotated.findIndex((o) => o.en === correct.en),
    };
  });
}

/** Percentage score, rounded. */
export function scoreTest(
  questions: TestQuestion[],
  answers: (number | null)[],
) {
  if (!questions.length) return 0;
  const right = questions.reduce(
    (a, q, i) => a + (answers[i] === q.answerIndex ? 1 : 0),
    0,
  );
  return Math.round((right / questions.length) * 100);
}
