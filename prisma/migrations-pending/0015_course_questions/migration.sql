-- Real pre/post-test questions per course (handoff task 5). The tests are
-- graded on the server from this bank; a course with no questions here still
-- gets the paper generated from its chapters, also graded on the server.

CREATE TABLE "CourseQuestion" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "stemEn" TEXT NOT NULL,
    "stemTh" TEXT,
    "options" JSONB NOT NULL,
    "answerIndex" INTEGER NOT NULL,
    "explainEn" TEXT,
    "explainTh" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseQuestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CourseQuestion_courseId_sortOrder_idx" ON "CourseQuestion"("courseId", "sortOrder");

ALTER TABLE "CourseQuestion" ADD CONSTRAINT "CourseQuestion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- a question has a stem, 2-6 options and an answer that is one of them
ALTER TABLE "CourseQuestion"
  ADD CONSTRAINT "CourseQuestion_stem_present" CHECK (length(btrim("stemEn")) > 0),
  -- CASE, because AND does not promise to skip jsonb_array_length on a non-array
  ADD CONSTRAINT "CourseQuestion_options_array" CHECK (
    CASE WHEN jsonb_typeof("options") = 'array'
      THEN jsonb_array_length("options") BETWEEN 2 AND 6
      ELSE false END
  ),
  ADD CONSTRAINT "CourseQuestion_answer_in_range" CHECK (
    CASE WHEN jsonb_typeof("options") = 'array'
      THEN "answerIndex" >= 0 AND "answerIndex" < jsonb_array_length("options")
      ELSE false END
  );

-- the app reaches it through the server only
ALTER TABLE "CourseQuestion" ENABLE ROW LEVEL SECURITY;
