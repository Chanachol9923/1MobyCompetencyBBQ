/**
 * Sample shorts and documents, so the Learning page is not empty on day one.
 *
 * The files live in the project's Vercel Blob store; these are their public
 * URLs. `competency` is a competency key and `course` a course slug.
 */

export type SampleShort = {
  titleEn: string;
  titleTh: string;
  captionEn: string;
  captionTh: string;
  competency: string;
  course: string;
  videoUrl: string;
  posterUrl: string;
  videoBytes: number;
};

export type SampleDocument = {
  titleEn: string;
  titleTh: string;
  descriptionEn: string;
  descriptionTh: string;
  competency: string | null;
  course: string | null;
  fileUrl: string;
  fileBytes: number;
  pages: number;
};

/** every sample short runs 25.5 seconds */
export const SAMPLE_SHORT_SECONDS = 26;

export const SAMPLE_SHORTS: SampleShort[] = [
  {
    "titleEn": "3 rules for a code review people actually want",
    "titleTh": "3 กฎรีวิวโค้ดที่ทีมอยากได้จริง ๆ",
    "captionEn": "Review the change, not the person; label how much each comment matters; keep PRs small.",
    "captionTh": "วิจารณ์ที่โค้ดไม่ใช่ที่คน บอกระดับความสำคัญของคอมเมนต์ และทำ PR ให้เล็ก",
    "competency": "version-control",
    "course": "clean-code-and-reviews",
    "videoUrl": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/shorts/code-review-3-rules-YdpeKf4BCIioyPQ73mzxTJJG7v7GtT.mp4",
    "posterUrl": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/posters/code-review-3-rules-i9DdOT6rnXCqvmI8z7hXaumNVR08Es.jpg",
    "videoBytes": 800322
  },
  {
    "titleEn": "Write a commit message your team can use",
    "titleTh": "เขียน commit message ที่ทีมใช้งานได้จริง",
    "captionEn": "The subject says what, the body says why, and each commit holds one idea.",
    "captionTh": "บรรทัดแรกบอกว่าทำอะไร เนื้อหาบอกว่าทำไม และหนึ่ง commit ต่อหนึ่งเรื่อง",
    "competency": "version-control",
    "course": "git-in-practice",
    "videoUrl": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/shorts/commit-messages-zyh9X0qzpD6XvRhdffW6KseqMs8wkZ.mp4",
    "posterUrl": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/posters/commit-messages-U50hm9WlK7O0CB2blye6eAvojZzmtg.jpg",
    "videoBytes": 1065594
  },
  {
    "titleEn": "The 5 Whys in 30 seconds",
    "titleTh": "เทคนิค 5 Whys ใน 30 วินาที",
    "captionEn": "Start from the symptom, keep asking why, and stop when you reach a process you can fix.",
    "captionTh": "เริ่มจากอาการ ถามว่าทำไมซ้ำ ๆ จนเจอกระบวนการที่แก้ไขได้",
    "competency": "analytical",
    "course": "root-cause-analysis",
    "videoUrl": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/shorts/five-whys-q93304YvBkMEkybOzgpNBcjpK2knoi.mp4",
    "posterUrl": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/posters/five-whys-qLWo6cvbfRUVLKLw2TY93aBV82Oe1Q.jpg",
    "videoBytes": 985840
  },
  {
    "titleEn": "Give feedback that lands: the SBI model",
    "titleTh": "ให้ฟีดแบ็กให้ได้ผลด้วยโมเดล SBI",
    "captionEn": "Situation, behaviour, impact — then ask how it looked from their side.",
    "captionTh": "สถานการณ์ พฤติกรรม ผลกระทบ แล้วถามมุมมองของอีกฝ่าย",
    "competency": "people",
    "course": "coaching-and-feedback",
    "videoUrl": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/shorts/feedback-sbi-lwn4hNhTIlZd7JL6VR4lZ8iEWTG7Jk.mp4",
    "posterUrl": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/posters/feedback-sbi-iMlfO3ZmLbQGzaYTeem0QmSCBeq1Cg.jpg",
    "videoBytes": 1185393
  },
  {
    "titleEn": "The status update that stops the chase",
    "titleTh": "อัปเดตสถานะที่ไม่ต้องมีใครตามถาม",
    "captionEn": "Headline first, dates instead of \"soon\", and a clear ask when you're blocked.",
    "captionTh": "บอกสถานะก่อน ระบุวันที่ให้ชัด และขอความช่วยเหลือให้ตรงจุดเมื่อติดขัด",
    "competency": "take-ownership",
    "course": "ownership-clinic-status",
    "videoUrl": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/shorts/status-update-Vs86Axczf7pD5NuAg4GW5lBFHuQEHx.mp4",
    "posterUrl": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/posters/status-update-iNK2iGYidNEMqh9aEJryHsKaFqpplJ.jpg",
    "videoBytes": 564555
  },
  {
    "titleEn": "Pick the work that moves the needle",
    "titleTh": "เลือกงานที่สร้างผลลัพธ์ได้จริง",
    "captionEn": "Plot impact against effort, ship the quick wins, and say no out loud.",
    "captionTh": "วางงานบนกราฟผลลัพธ์กับแรงที่ใช้ ทำงานที่คุ้มก่อน และปฏิเสธอย่างมีเหตุผล",
    "competency": "create-impact",
    "course": "impact-prioritisation",
    "videoUrl": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/shorts/impact-vs-effort-mgJf6VZyxkiUAv0IMh3kPMFjP64SEk.mp4",
    "posterUrl": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/posters/impact-vs-effort-O6jd7Dz5k7iBehfKaNSyo2NZGYCjAu.jpg",
    "videoBytes": 1089348
  }
];

export const SAMPLE_DOCUMENTS: SampleDocument[] = [
  {
    "titleEn": "Your Competency Assessment, Explained",
    "titleTh": "คู่มือการประเมินสมรรถนะสำหรับพนักงาน",
    "descriptionEn": "How the assessment cycle works, the three families of competency, and how to close a gap with courses, shorts and documents.",
    "descriptionTh": "ขั้นตอนของรอบการประเมิน สมรรถนะ 3 กลุ่ม และวิธีปิดช่องว่างด้วยหลักสูตร คลิปสั้น และเอกสาร",
    "competency": null,
    "course": null,
    "fileUrl": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/documents/assessment-handbook-scF5OC2VjSGkvVq0h8L47osy2gvpoX.pdf",
    "fileBytes": 85201,
    "pages": 4
  },
  {
    "titleEn": "Code Review Checklist",
    "titleTh": "เช็กลิสต์การรีวิวโค้ด",
    "descriptionEn": "What to check before opening a PR, what to look at while reviewing, and how to word comments so people keep shipping.",
    "descriptionTh": "สิ่งที่ต้องตรวจก่อนเปิด PR ประเด็นที่ต้องดูขณะรีวิว และวิธีเขียนคอมเมนต์ที่ทำให้ทีมอยากส่งงาน",
    "competency": "version-control",
    "course": "clean-code-and-reviews",
    "fileUrl": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/documents/code-review-checklist-qjzRFRFjxgMgL0LRDH0EEdsVWNHAjj.pdf",
    "fileBytes": 97502,
    "pages": 4
  },
  {
    "titleEn": "Feedback Conversation Guide (SBI)",
    "titleTh": "คู่มือการให้ฟีดแบ็กด้วยโมเดล SBI",
    "descriptionEn": "A one-sitting guide to giving feedback with Situation–Behaviour–Impact, before, during and after the conversation.",
    "descriptionTh": "คู่มือการให้ฟีดแบ็กด้วยโมเดล SBI ตั้งแต่ก่อน ระหว่าง และหลังการพูดคุย",
    "competency": "people",
    "course": "coaching-and-feedback",
    "fileUrl": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/documents/feedback-guide-sbi-lhf3VbraIfsMiOHUlgnbhTXyaYmYZX.pdf",
    "fileBytes": 75492,
    "pages": 3
  },
  {
    "titleEn": "Blameless Postmortem Template",
    "titleTh": "แบบฟอร์มสรุปเหตุการณ์โดยไม่กล่าวโทษ",
    "descriptionEn": "Fill it in within three working days of an incident: summary, timeline, five whys and owned actions.",
    "descriptionTh": "กรอกภายใน 3 วันทำงานหลังเกิดเหตุ: สรุป ไทม์ไลน์ 5 Whys และ action ที่มีเจ้าของ",
    "competency": "analytical",
    "course": "root-cause-analysis",
    "fileUrl": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/documents/postmortem-template-ATeEqC91CIbve5t018d3RtfmZazqZg.pdf",
    "fileBytes": 64879,
    "pages": 2
  }
];

/**
 * A lesson video for every VIDEO chapter of the sample courses, made from the
 * chapter's own title, key idea and points and narrated in Thai, so the
 * subtitles and the AI tutor have real speech to work from. `sortOrder` is the chapter's
 * position in its course.
 */
export type SampleChapterVideo = {
  course: string;
  sortOrder: number;
  url: string;
  bytes: number;
  seconds: number;
};

export const SAMPLE_CHAPTER_VIDEOS: SampleChapterVideo[] = [
  {
    "course": "adaptive-change-workshop",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/adaptive-change-workshop-1-th-HkQgJsYCFRVzFc6NXRJ6yNPhGV6pQg.mp4",
    "bytes": 894284,
    "seconds": 34
  },
  {
    "course": "advanced-aws",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/advanced-aws-1-th-brJY6i3qP5E8Jmfj4qpEZT51Zh9ASP.mp4",
    "bytes": 876865,
    "seconds": 26
  },
  {
    "course": "blameless-problem-solving",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/blameless-problem-solving-1-th-v76cB1KQk61JOYuvAY9sWyCsS3Bify.mp4",
    "bytes": 898050,
    "seconds": 28
  },
  {
    "course": "clean-code-and-reviews",
    "sortOrder": 1,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/clean-code-and-reviews-2-th-9qSFu6ZwvaNjSgeWkvZv4MjJeK9mM4.mp4",
    "bytes": 661718,
    "seconds": 31
  },
  {
    "course": "coaching-and-feedback",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/coaching-and-feedback-1-th-l1SHP4SAFmkK5aeOenyb1dG64GtsWm.mp4",
    "bytes": 965979,
    "seconds": 31
  },
  {
    "course": "cross-team-collaboration",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/cross-team-collaboration-1-th-CU9Yg6oO6UVGkBhPBgBb6ynZvjcadN.mp4",
    "bytes": 1377920,
    "seconds": 38
  },
  {
    "course": "data-modelling-essentials",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/data-modelling-essentials-1-th-6Kof0kLw58tAY7hZjbBLt3xknvxchQ.mp4",
    "bytes": 922798,
    "seconds": 28
  },
  {
    "course": "delegation-and-decisions",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/delegation-and-decisions-1-th-JUghCOPQlqf7Rf6Xgf5hH71bbPgaWB.mp4",
    "bytes": 836276,
    "seconds": 27
  },
  {
    "course": "delivery-cadence",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/delivery-cadence-1-th-B0uQOnsI8hwe8SMTULWuFRprqkOjGI.mp4",
    "bytes": 1243100,
    "seconds": 35
  },
  {
    "course": "end-to-end-ownership",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/end-to-end-ownership-1-th-fEB63VkA0uSioVPedc7sbus4Yjt8c5.mp4",
    "bytes": 555102,
    "seconds": 32
  },
  {
    "course": "git-in-practice",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/git-in-practice-1-th-kuFJ0xAoN9utFns0B7c7X6KVREFvK5.mp4",
    "bytes": 1084265,
    "seconds": 33
  },
  {
    "course": "goal-setting-and-kpis",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/goal-setting-and-kpis-1-th-xnfOIWJiK1brYubvLqKudrf6MZryXL.mp4",
    "bytes": 1155252,
    "seconds": 32
  },
  {
    "course": "how-to-be-funny",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/how-to-be-funny-1-th-0dVyphhneWk0g8o4RKjt0kJavM0LI3.mp4",
    "bytes": 617947,
    "seconds": 25
  },
  {
    "course": "impact-case-dashboard",
    "sortOrder": 1,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/impact-case-dashboard-2-th-7QXIE0oJn3vRG5jLpzB52tjb805Wgj.mp4",
    "bytes": 818420,
    "seconds": 36
  },
  {
    "course": "impact-prioritisation",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/impact-prioritisation-1-th-Wija5DiXM6qx7WJhbhI5LfBTy8txMq.mp4",
    "bytes": 1308833,
    "seconds": 35
  },
  {
    "course": "leadership-team-dynamics",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/leadership-team-dynamics-1-th-SAktPjBiAmQwLxYaYWSI3qEAsF9dHp.mp4",
    "bytes": 1320488,
    "seconds": 38
  },
  {
    "course": "leadership-team-dynamics",
    "sortOrder": 2,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/leadership-team-dynamics-3-th-NJ0GVI2M5pWZOefmxLMYfKVDxn6eKE.mp4",
    "bytes": 1079480,
    "seconds": 29
  },
  {
    "course": "learning-agility",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/learning-agility-1-th-dtPzG6sLpOOyklbrh6lemaLsNtIkZq.mp4",
    "bytes": 1113267,
    "seconds": 35
  },
  {
    "course": "measuring-your-work",
    "sortOrder": 1,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/measuring-your-work-2-th-2DkiRB7d715NM8fB7SWyank88hsyqK.mp4",
    "bytes": 1022985,
    "seconds": 32
  },
  {
    "course": "nodejs-expert",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/nodejs-expert-1-th-KV8X8SUMoDU3Q19XmWIgevlwW80dm5.mp4",
    "bytes": 674833,
    "seconds": 28
  },
  {
    "course": "ownership-clinic-status",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/ownership-clinic-status-1-th-h6P0c5SNoUCJpI2nH9M3snA3yDrow1.mp4",
    "bytes": 907995,
    "seconds": 35
  },
  {
    "course": "people-clinic-first-thirty-days",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/people-clinic-first-thirty-days-1-th-498so7sQqjIj5JMnh6K3gLAfyvbEDE.mp4",
    "bytes": 1189503,
    "seconds": 37
  },
  {
    "course": "prioritisation-and-time",
    "sortOrder": 1,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/prioritisation-and-time-2-th-zWPGHq3BOLffXQiGLMscWC8E7rPRjG.mp4",
    "bytes": 1062656,
    "seconds": 35
  },
  {
    "course": "process-improvement",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/process-improvement-1-th-PglcV28HmPziwWIq4azYDoqDZkGWnB.mp4",
    "bytes": 1243181,
    "seconds": 35
  },
  {
    "course": "project-management-essentials",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/project-management-essentials-1-th-CS0XpXAxevxgHk76ffYoqYO5EtxPeG.mp4",
    "bytes": 699520,
    "seconds": 33
  },
  {
    "course": "project-management-essentials",
    "sortOrder": 2,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/project-management-essentials-3-th-buKs16FrHmVsPqC2MytARGuSXOTh6g.mp4",
    "bytes": 542955,
    "seconds": 27
  },
  {
    "course": "purpose-mandate-workshop",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/purpose-mandate-workshop-1-th-gORdOExQCDantePnljlEE2vm1FAUmb.mp4",
    "bytes": 1162703,
    "seconds": 34
  },
  {
    "course": "query-tuning-lab",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/query-tuning-lab-1-th-OsLzK70ItpQDnrUoQU0VyejcybEmYb.mp4",
    "bytes": 991359,
    "seconds": 31
  },
  {
    "course": "refactoring-lab",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/refactoring-lab-1-th-O1rb7SiGR1kUIXp4aNSdyZS20d74nY.mp4",
    "bytes": 997728,
    "seconds": 35
  },
  {
    "course": "repo-rescue-lab",
    "sortOrder": 1,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/repo-rescue-lab-2-th-rfNQGbf4PFj3B6Ep2e9QXWKewtePDe.mp4",
    "bytes": 993612,
    "seconds": 31
  },
  {
    "course": "result-case-green-dashboard",
    "sortOrder": 1,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/result-case-green-dashboard-2-th-fD0m65Muy1FpZpuNiCptu5Gy2SogeB.mp4",
    "bytes": 838618,
    "seconds": 35
  },
  {
    "course": "root-cause-analysis",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/root-cause-analysis-1-th-O8y1AEGcPQtz6RpF5peYzcUnnlTtHU.mp4",
    "bytes": 699616,
    "seconds": 32
  },
  {
    "course": "staying-steady-under-pressure",
    "sortOrder": 1,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/staying-steady-under-pressure-2-th-V09yXEyWCkY3ygKgjNFOpXT4bHGaUN.mp4",
    "bytes": 1134472,
    "seconds": 36
  },
  {
    "course": "strategy-to-daily-work",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/strategy-to-daily-work-1-th-aHBQPVVVLwsE1C9IcBI2GkznE3mceK.mp4",
    "bytes": 732914,
    "seconds": 38
  },
  {
    "course": "testing-fundamentals",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/testing-fundamentals-1-th-9DokGPq4b2snMmoWfsuJ6RYO9wbmb0.mp4",
    "bytes": 1243200,
    "seconds": 35
  }
];
