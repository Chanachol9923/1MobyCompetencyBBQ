"use client";

import { useCallback, useMemo } from "react";
import { useDemo } from "@/lib/store";

export type Lang = "en" | "th";

/**
 * Shared vocabulary. Anything that appears in more than one screen lives here so
 * the two languages cannot drift apart. One-off page copy should use `tt()`
 * instead — it takes the English and Thai inline.
 */
export const DICT: Record<string, { en: string; th: string }> = {
  // navigation
  "nav.dashboard": { en: "Dashboard", th: "แดชบอร์ด" },
  "nav.teamProfile": { en: "Team Profile", th: "โปรไฟล์ทีม" },
  "nav.idp": { en: "IDP", th: "แผนพัฒนารายบุคคล" },
  "nav.lms": { en: "LMS", th: "ระบบการเรียนรู้" },
  "nav.achievements": { en: "Achievements", th: "ความสำเร็จ" },
  "nav.assessment": { en: "Assessment", th: "การประเมิน" },
  "nav.reward": { en: "Reward", th: "ของรางวัล" },
  "nav.reports": { en: "Reports", th: "รายงาน" },
  "nav.employee": { en: "Employee", th: "พนักงาน" },
  "nav.announcement": { en: "Announcement", th: "ประกาศ" },
  "nav.auditLog": { en: "Activity Log", th: "บันทึกกิจกรรม" },

  // roles & levels
  "role.l1": { en: "Employee", th: "พนักงาน" },
  "role.l2": { en: "Manager", th: "หัวหน้างาน" },
  "role.admin": { en: "Administrator", th: "ผู้ดูแลระบบ" },

  // competency groups
  "group.core": { en: "Core", th: "Core (สมรรถนะหลัก)" },
  "group.functional": { en: "Functional", th: "Functional (สมรรถนะตามสายงาน)" },
  "group.managerial": { en: "Managerial", th: "Managerial (สมรรถนะการบริหาร)" },
  "group.kpi": { en: "KPI", th: "KPI (ผลลัพธ์ของงาน)" },

  // rating scale
  "rating.1": { en: "Needs Improvement", th: "ต้องปรับปรุง" },
  "rating.2": { en: "Developing", th: "กำลังพัฒนา" },
  "rating.3": { en: "Proficient", th: "ทำได้ตามมาตรฐาน" },
  "rating.4": { en: "Exemplary", th: "เกินความคาดหมาย" },

  // assessment modes (180 degree)
  "mode.self": { en: "Self", th: "ประเมินตนเอง" },
  "mode.peer": { en: "Peer", th: "เพื่อนร่วมงาน" },
  "mode.supervisor": { en: "Supervisor", th: "หัวหน้าประเมิน" },

  // common actions
  "action.save": { en: "Save", th: "บันทึก" },
  "action.cancel": { en: "Cancel", th: "ยกเลิก" },
  "action.next": { en: "Next", th: "ถัดไป" },
  "action.back": { en: "Back", th: "ย้อนกลับ" },
  "action.submit": { en: "Submit", th: "ส่งผล" },
  "action.continue": { en: "Continue", th: "เรียนต่อ" },
  "action.add": { en: "Add", th: "เพิ่ม" },
  "action.edit": { en: "Edit", th: "แก้ไข" },
  "action.delete": { en: "Delete", th: "ลบ" },
  "action.confirm": { en: "Confirm", th: "ยืนยัน" },
  "action.close": { en: "Close", th: "ปิด" },
  "action.search": { en: "Search", th: "ค้นหา" },
  "action.export": { en: "Export", th: "ส่งออกไฟล์" },
  "action.viewMore": { en: "View More!", th: "ดูทั้งหมด!" },
  "action.seeAll": { en: "See All", th: "ดูทั้งหมด" },
  "action.redeem": { en: "Redeem", th: "แลกของรางวัล" },
  "action.logout": { en: "Log out", th: "ออกจากระบบ" },

  // common nouns
  "label.progress": { en: "Progress", th: "ความคืบหน้า" },
  "label.complete": { en: "Complete", th: "เสร็จสิ้น" },
  "label.expected": { en: "Expectation", th: "ระดับที่คาดหวัง" },
  "label.actual": { en: "Employee Skill Point", th: "คะแนนจริง" },
  "label.gap": { en: "Gap", th: "ส่วนต่าง" },
  "label.points": { en: "Points", th: "คะแนนสะสม" },
  "label.skills": { en: "Skills", th: "สมรรถนะ" },
  "label.member": { en: "Member", th: "สมาชิก" },
  "label.status": { en: "Status", th: "สถานะ" },
  "label.department": { en: "Department", th: "ฝ่าย" },
  "label.division": { en: "Division", th: "แผนก" },
  "label.position": { en: "Position", th: "ตำแหน่ง" },
  "label.level": { en: "Level", th: "ระดับ" },
  "label.course": { en: "Course", th: "หลักสูตร" },
  "label.notes": { en: "Note", th: "บันทึก" },
  "label.startDate": { en: "Start date", th: "วันเริ่มต้น" },
  "label.dueDate": { en: "Due date", th: "วันสิ้นสุด" },

  // status words
  "status.notStarted": { en: "Not started", th: "ยังไม่เริ่ม" },
  "status.inProgress": { en: "In progress", th: "กำลังดำเนินการ" },
  "status.submitted": { en: "Submitted", th: "ส่งแล้ว" },
  "status.overdue": { en: "Overdue", th: "เลยกำหนด" },
  "status.onTrack": { en: "On Track", th: "ตามแผน" },
  "status.needsFollowUp": { en: "Needs Follow-Up", th: "ต้องติดตาม" },

  // demo notice
  "demo.notice": {
    en: "Demo build — data is mocked and stored in your browser only.",
    th: "เวอร์ชันสาธิต — ข้อมูลเป็นข้อมูลจำลอง เก็บไว้ในเบราว์เซอร์ของคุณเท่านั้น",
  },

  /* ------------------------------------------------ admin shared vocabulary */

  // data-set columns (the requirement pack's Data Set table)
  "label.employee": { en: "Employee", th: "พนักงาน" },
  "label.employeeId": { en: "Employee ID", th: "รหัสพนักงาน" },
  "label.name": { en: "Name", th: "ชื่อ" },
  "label.nickname": { en: "Nickname", th: "ชื่อเล่น" },
  "label.role": { en: "Role", th: "บทบาท" },
  "label.grade": { en: "Grade", th: "เกรด" },
  "label.businessUnit": { en: "Business Unit", th: "หน่วยธุรกิจ" },
  "label.reportTo": { en: "Report to", th: "รายงานต่อ" },
  "label.remark": { en: "Remark", th: "หมายเหตุ" },
  "label.email": { en: "Email", th: "อีเมล" },
  "label.headcount": { en: "Members Amount", th: "จำนวนสมาชิก" },

  // table furniture
  "label.actions": { en: "Actions", th: "การจัดการ" },
  "label.action": { en: "Action", th: "การกระทำ" },
  "label.actor": { en: "Actor", th: "ผู้ดำเนินการ" },
  "label.target": { en: "Target", th: "เป้าหมาย" },
  "label.detail": { en: "Detail", th: "รายละเอียด" },
  "label.date": { en: "Date", th: "วันที่" },
  "label.timestamp": { en: "Timestamp", th: "เวลา" },
  "label.title": { en: "Title", th: "หัวข้อ" },
  "label.description": { en: "Description", th: "คำอธิบาย" },
  "label.category": { en: "Category", th: "หมวดหมู่" },
  "label.competency": { en: "Competency", th: "สมรรถนะ" },
  "label.channel": { en: "Channel", th: "ช่องทาง" },
  "label.audience": { en: "Audience", th: "กลุ่มผู้รับ" },
  "label.weight": { en: "Weight", th: "น้ำหนัก" },
  "label.all": { en: "All", th: "ทั้งหมด" },
  "label.total": { en: "Total", th: "รวม" },
  "label.everyone": { en: "All employees", th: "พนักงานทั้งหมด" },
  "label.notAssessed": { en: "Not assessed", th: "ไม่ได้ประเมิน" },
  "label.careerPath": { en: "Career path", th: "เส้นทางความก้าวหน้า" },

  // extra actions used across the admin screens
  "action.sendReminder": { en: "Send reminder", th: "ส่งการแจ้งเตือน" },
  "action.runNow": { en: "Run now", th: "ส่งทันที" },
  "action.exportCsv": { en: "Export CSV", th: "ส่งออก CSV" },
  "action.saveChanges": { en: "Save changes", th: "บันทึกการแก้ไข" },
  "action.reset": { en: "Reset", th: "รีเซ็ต" },
  "action.create": { en: "Create", th: "สร้าง" },

  // extra status words
  "status.published": { en: "Published", th: "เผยแพร่แล้ว" },
  "status.scheduled": { en: "Scheduled", th: "ตั้งเวลาไว้" },
  "status.draft": { en: "Draft", th: "ฉบับร่าง" },
  "status.active": { en: "Active", th: "เปิดใช้งาน" },
  "status.inactive": { en: "Inactive", th: "ปิดใช้งาน" },
  "status.completed": { en: "Completed", th: "เสร็จสมบูรณ์" },
  "status.incomplete": { en: "Incomplete", th: "ยังไม่เสร็จ" },

  // admin boilerplate
  "admin.searchEmployee": { en: "Search employee...", th: "ค้นหาพนักงาน..." },
  "admin.noMatch": {
    en: "Nothing matches the current filters.",
    th: "ไม่พบข้อมูลที่ตรงกับตัวกรองปัจจุบัน",
  },
  "admin.demoOnly": {
    en: "Demo only — changes stay in this browser and are not persisted to a backend.",
    th: "เวอร์ชันสาธิต — การเปลี่ยนแปลงถูกเก็บไว้ในเบราว์เซอร์นี้เท่านั้น ไม่ได้บันทึกลงเซิร์ฟเวอร์",
  },
  "admin.onlyDemoData": {
    en: "This only affects the demo data.",
    th: "มีผลกับข้อมูลสาธิตเท่านั้น",
  },

  /* ----------------------------------------------- reward shared vocabulary */

  // redemption + stock words, shared by /reward and /admin/reward
  "status.delivered": { en: "Delivered", th: "ส่งมอบแล้ว" },
  "status.preparing": { en: "Preparing", th: "กำลังเตรียม" },
  "status.outOfStock": { en: "Out of stock", th: "ของหมด" },
};

export function useT() {
  const { state, update } = useDemo();
  const lang: Lang = state.lang ?? "en";

  const t = useCallback(
    (key: string) => {
      const entry = DICT[key];
      if (!entry) return key;
      return entry[lang];
    },
    [lang],
  );

  /** Inline pair for page-specific copy: tt("Assessment", "การประเมิน") */
  const tt = useCallback((en: string, th: string) => (lang === "th" ? th : en), [lang]);

  const setLang = useCallback(
    (next: Lang) => update((s) => ({ ...s, lang: next })),
    [update],
  );

  return useMemo(() => ({ t, tt, lang, setLang }), [t, tt, lang, setLang]);
}

/** Rating label helper that follows the active language. */
export function useRatingLabel() {
  const { t } = useT();
  return useCallback((score: number) => t(`rating.${score}`), [t]);
}
