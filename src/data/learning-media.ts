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
