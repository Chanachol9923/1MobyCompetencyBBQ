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
 * chapter's own title, key idea and points. `sortOrder` is the chapter's
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
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/adaptive-change-workshop-1-AtrdjH8QP65vD1XWMiahrgN24nkHpu.mp4",
    "bytes": 1229961,
    "seconds": 41
  },
  {
    "course": "advanced-aws",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/advanced-aws-1-auK0r3kmk9Fwl5jhrfGPcPe3DvalZc.mp4",
    "bytes": 942250,
    "seconds": 34
  },
  {
    "course": "blameless-problem-solving",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/blameless-problem-solving-1-Rk36AcPiuSYN1QJXFFbQ66ETcFG4Lf.mp4",
    "bytes": 549116,
    "seconds": 34
  },
  {
    "course": "clean-code-and-reviews",
    "sortOrder": 1,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/clean-code-and-reviews-2-KdPhuQo7hWKSONFGtTfBcwQNomQob3.mp4",
    "bytes": 630011,
    "seconds": 41
  },
  {
    "course": "coaching-and-feedback",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/coaching-and-feedback-1-AeI6KpFCYom2DpSM5kIKIFLnGXBOuq.mp4",
    "bytes": 1084114,
    "seconds": 41
  },
  {
    "course": "cross-team-collaboration",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/cross-team-collaboration-1-Uha2jpIJUJQbIlDlevSxCA0YLYYG7B.mp4",
    "bytes": 1393352,
    "seconds": 41
  },
  {
    "course": "data-modelling-essentials",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/data-modelling-essentials-1-EHLZYkVcI4sSJqPDmOdglIwZXKKckg.mp4",
    "bytes": 971033,
    "seconds": 34
  },
  {
    "course": "delegation-and-decisions",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/delegation-and-decisions-1-cAh2bndrkHrxiXkRO5nyrBNMpPVYcE.mp4",
    "bytes": 1102044,
    "seconds": 34
  },
  {
    "course": "delivery-cadence",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/delivery-cadence-1-fGO8DTVn3IgDf74BeVdlBzr4PlJXK4.mp4",
    "bytes": 1372142,
    "seconds": 41
  },
  {
    "course": "end-to-end-ownership",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/end-to-end-ownership-1-BhvLltP7OVE5NcDHoT5qxGXCUob79X.mp4",
    "bytes": 1189357,
    "seconds": 41
  },
  {
    "course": "git-in-practice",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/git-in-practice-1-XZYoiPSLmdw2f13fnGWig4lfGOWXOb.mp4",
    "bytes": 1255641,
    "seconds": 41
  },
  {
    "course": "goal-setting-and-kpis",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/goal-setting-and-kpis-1-imcEuHG34l1KWarcE9uRF1Li6DNJgQ.mp4",
    "bytes": 1379221,
    "seconds": 41
  },
  {
    "course": "how-to-be-funny",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/how-to-be-funny-1-SsUGzuCEya6Kp7TqxwBFz0sAM378K2.mp4",
    "bytes": 986377,
    "seconds": 34
  },
  {
    "course": "impact-case-dashboard",
    "sortOrder": 1,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/impact-case-dashboard-2-Ts6a1LCldNyegS7oefo5fUMNAji4kg.mp4",
    "bytes": 1200707,
    "seconds": 41
  },
  {
    "course": "impact-prioritisation",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/impact-prioritisation-1-N0WYGr8PNFlb1KJE7tvU0SenD1aNu3.mp4",
    "bytes": 1276621,
    "seconds": 41
  },
  {
    "course": "leadership-team-dynamics",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/leadership-team-dynamics-1-9XrDAfUAqUnJrtsLkNuareCssHS6aY.mp4",
    "bytes": 1803475,
    "seconds": 49
  },
  {
    "course": "leadership-team-dynamics",
    "sortOrder": 2,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/leadership-team-dynamics-3-uiS3PYHVY9EQmzmoxgXKN98RpO1l2u.mp4",
    "bytes": 1346185,
    "seconds": 41
  },
  {
    "course": "learning-agility",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/learning-agility-1-TWLrw8h2rodfbPyiYHAfWfvFkTr7aH.mp4",
    "bytes": 1116344,
    "seconds": 41
  },
  {
    "course": "measuring-your-work",
    "sortOrder": 1,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/measuring-your-work-2-oK1KqwzBvcD2iarT5MCZ1Ov5vD7Cpw.mp4",
    "bytes": 1106834,
    "seconds": 41
  },
  {
    "course": "nodejs-expert",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/nodejs-expert-1-JE387wV1hrucukhF3nfaDYAnlFU5A7.mp4",
    "bytes": 625356,
    "seconds": 34
  },
  {
    "course": "ownership-clinic-status",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/ownership-clinic-status-1-N423cNWraH7O0UDLjYWp9WODuvN14v.mp4",
    "bytes": 1091121,
    "seconds": 41
  },
  {
    "course": "people-clinic-first-thirty-days",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/people-clinic-first-thirty-days-1-2c5Q1k8fhKs17Y8B4cbdM0nGT5PLO8.mp4",
    "bytes": 696607,
    "seconds": 41
  },
  {
    "course": "prioritisation-and-time",
    "sortOrder": 1,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/prioritisation-and-time-2-VsfBprZqO7efvio37zaaF2aLsUw8Fo.mp4",
    "bytes": 1175286,
    "seconds": 41
  },
  {
    "course": "process-improvement",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/process-improvement-1-zQKvIizPgoHTcxuql3LPAcKxPLbOuz.mp4",
    "bytes": 1304066,
    "seconds": 41
  },
  {
    "course": "project-management-essentials",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/project-management-essentials-1-0G7sBurL9jR3z2MNaeypvQ01oBqEPi.mp4",
    "bytes": 1102140,
    "seconds": 41
  },
  {
    "course": "project-management-essentials",
    "sortOrder": 2,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/project-management-essentials-3-zpzupq5V3Z43R3WjZMbdHBO3ZTOL2f.mp4",
    "bytes": 912171,
    "seconds": 34
  },
  {
    "course": "purpose-mandate-workshop",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/purpose-mandate-workshop-1-8XAIzOkV46ou1XaCLj2yrgNPGQIiCN.mp4",
    "bytes": 1355525,
    "seconds": 41
  },
  {
    "course": "query-tuning-lab",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/query-tuning-lab-1-O4s3RraBTxEXoxtYqax1GALElRs1jp.mp4",
    "bytes": 1125609,
    "seconds": 41
  },
  {
    "course": "refactoring-lab",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/refactoring-lab-1-S9kRm0t8E2cVjLBMlHMpmDqt8kZmxb.mp4",
    "bytes": 1193853,
    "seconds": 41
  },
  {
    "course": "repo-rescue-lab",
    "sortOrder": 1,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/repo-rescue-lab-2-h0X56MLISD8t5dNUHe81jqwKLB99Uz.mp4",
    "bytes": 978823,
    "seconds": 34
  },
  {
    "course": "result-case-green-dashboard",
    "sortOrder": 1,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/result-case-green-dashboard-2-pVQq352hZaU5oiFx43EWGGTXIpF0AL.mp4",
    "bytes": 1408395,
    "seconds": 41
  },
  {
    "course": "root-cause-analysis",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/root-cause-analysis-1-CJeErtEaUsy9BNcfTy24btuB0bLqbC.mp4",
    "bytes": 1292347,
    "seconds": 41
  },
  {
    "course": "staying-steady-under-pressure",
    "sortOrder": 1,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/staying-steady-under-pressure-2-dKYAkv17d9tWArG9ghnW3BUOKzvMKm.mp4",
    "bytes": 1411009,
    "seconds": 41
  },
  {
    "course": "strategy-to-daily-work",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/strategy-to-daily-work-1-hUQXxdBu72GdySQjvwzfcY1SU3K9s1.mp4",
    "bytes": 1181165,
    "seconds": 41
  },
  {
    "course": "testing-fundamentals",
    "sortOrder": 0,
    "url": "https://gvzppvcud9jrqwqy.public.blob.vercel-storage.com/learning/chapters/testing-fundamentals-1-F8nxbv5W6mrnrutKfxLjedCbc5xDlt.mp4",
    "bytes": 911766,
    "seconds": 41
  }
];
