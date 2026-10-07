"use client";

import { useCallback, useMemo } from "react";
import { useUi, type Lang } from "@/lib/ui-state";

export type { Lang };

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
  "nav.lms": { en: "LMS", th: "การเรียนรู้" },
  "nav.achievements": { en: "Achievements", th: "ความสำเร็จ" },
  "nav.assessment": { en: "Assessment", th: "การประเมิน" },
  "nav.reward": { en: "Rewards", th: "ของรางวัล" },
  "nav.reports": { en: "Reports", th: "รายงาน" },
  "nav.employee": { en: "Employee", th: "พนักงาน" },
  "nav.announcement": { en: "Announcement", th: "ประกาศ" },
  "nav.announcements": { en: "Announcements", th: "ประกาศ" },
  "nav.staffRecords": { en: "Staff records", th: "ข้อมูลพนักงาน" },
  "nav.auditLog": { en: "Activity log", th: "บันทึกกิจกรรม" },
  "nav.accounts": { en: "Accounts", th: "บัญชีผู้ใช้" },
  "nav.roles": { en: "Roles & permissions", th: "บทบาทและสิทธิ์" },

  // roles & levels
  "role.l1": { en: "Employee", th: "พนักงาน" },
  "role.l2": { en: "Manager", th: "หัวหน้างาน" },
  "role.admin": { en: "Administrator", th: "ผู้ดูแลระบบ" },

  // competency groups
  "group.core": { en: "Core", th: "สมรรถนะหลัก" },
  "group.functional": { en: "Functional", th: "สมรรถนะตามสายงาน" },
  "group.managerial": { en: "Managerial", th: "สมรรถนะการบริหาร" },
  "group.kpi": { en: "KPI", th: "KPI" },

  // rating scale
  "rating.1": { en: "Needs improvement", th: "ต้องปรับปรุง" },
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
  "action.submit": { en: "Submit", th: "ส่ง" },
  "action.continue": { en: "Continue", th: "เรียนต่อ" },
  "action.add": { en: "Add", th: "เพิ่ม" },
  "action.edit": { en: "Edit", th: "แก้ไข" },
  "action.delete": { en: "Delete", th: "ลบ" },
  "action.confirm": { en: "Confirm", th: "ยืนยัน" },
  "action.close": { en: "Close", th: "ปิด" },
  "action.search": { en: "Search", th: "ค้นหา" },
  "action.export": { en: "Export", th: "ส่งออก" },
  "action.viewMore": { en: "View more", th: "ดูเพิ่มเติม" },
  "action.seeAll": { en: "See all", th: "ดูทั้งหมด" },
  "action.redeem": { en: "Redeem", th: "แลก" },
  "action.logout": { en: "Log out", th: "ออกจากระบบ" },

  // common nouns
  "label.progress": { en: "Progress", th: "ความคืบหน้า" },
  "label.complete": { en: "Complete", th: "เสร็จสิ้น" },
  "label.expected": { en: "Expected level", th: "ระดับที่คาดหวัง" },
  "label.actual": { en: "Current score", th: "คะแนนที่ได้" },
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
  "label.dueDate": { en: "Due date", th: "กำหนดเสร็จ" },

  // status words
  "status.notStarted": { en: "Not started", th: "ยังไม่เริ่ม" },
  "status.inProgress": { en: "In progress", th: "กำลังดำเนินการ" },
  "status.submitted": { en: "Submitted", th: "ส่งแล้ว" },
  "status.overdue": { en: "Overdue", th: "เลยกำหนด" },
  "status.onTrack": { en: "On track", th: "ตามแผน" },
  "status.needsFollowUp": { en: "Needs follow-up", th: "ต้องติดตาม" },


  /* ------------------------------------------------ admin shared vocabulary */

  // data-set columns (the requirement pack's Data Set table)
  "label.employee": { en: "Employee", th: "พนักงาน" },
  "label.employeeId": { en: "Employee ID", th: "รหัสพนักงาน" },
  "label.name": { en: "Name", th: "ชื่อ" },
  "label.nickname": { en: "Nickname", th: "ชื่อเล่น" },
  "label.role": { en: "Role", th: "บทบาท" },
  "label.grade": { en: "Grade", th: "เกรด" },
  "label.businessUnit": { en: "Business unit", th: "หน่วยธุรกิจ" },
  "label.reportTo": { en: "Reports to", th: "หัวหน้างาน" },
  "label.remark": { en: "Remark", th: "หมายเหตุ" },
  "label.email": { en: "Email", th: "อีเมล" },
  "label.headcount": { en: "Members", th: "จำนวนคน" },

  // table furniture
  "label.actions": { en: "Actions", th: "จัดการ" },
  "label.action": { en: "Action", th: "รายการ" },
  "label.actor": { en: "Actor", th: "ผู้ดำเนินการ" },
  "label.target": { en: "Item", th: "รายการที่เปลี่ยน" },
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
  "label.notAssessed": { en: "Not assessed", th: "ไม่ประเมิน" },
  "label.careerPath": { en: "Career path", th: "เส้นทางความก้าวหน้า" },

  // extra actions used across the admin screens
  "action.sendReminder": { en: "Send reminder", th: "ส่งการเตือน" },
  "action.runNow": { en: "Run now", th: "ส่งทันที" },
  "action.exportCsv": { en: "Export CSV", th: "ส่งออก CSV" },
  "action.saveChanges": { en: "Save changes", th: "บันทึกการแก้ไข" },
  "action.reset": { en: "Reset", th: "รีเซ็ต" },
  "action.create": { en: "Create", th: "สร้าง" },

  // extra status words
  "status.published": { en: "Published", th: "เผยแพร่แล้ว" },
  "status.scheduled": { en: "Scheduled", th: "ตั้งเวลาไว้" },
  "status.draft": { en: "Draft", th: "ฉบับร่าง" },
  "status.active": { en: "Active", th: "ใช้งานอยู่" },
  "status.inactive": { en: "Inactive", th: "ปิดใช้งาน" },
  "status.completed": { en: "Completed", th: "เสร็จสมบูรณ์" },
  "status.incomplete": { en: "Incomplete", th: "ยังไม่เสร็จ" },

  // admin boilerplate
  "admin.searchEmployee": { en: "Search employee...", th: "ค้นหาพนักงาน..." },
  "admin.noMatch": {
    en: "Nothing matches the current filters.",
    th: "ไม่พบข้อมูลที่ตรงกับตัวกรองปัจจุบัน",
  },

  /* ----------------------------------------------- reward shared vocabulary */

  // redemption + stock words, shared by /reward and /admin/reward
  "status.delivered": { en: "Delivered", th: "ส่งมอบแล้ว" },
  "status.preparing": { en: "Preparing", th: "กำลังเตรียม" },
  "status.outOfStock": { en: "Out of stock", th: "ของหมด" },
};

export function useT() {
  const { lang, setLang } = useUi();

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

  /** A career level ("Level 3: Supervise") in the active language. */
  const lv = useCallback((level: string) => levelText(level, lang), [lang]);

  return useMemo(() => ({ t, tt, lv, lang, setLang }), [t, tt, lv, lang, setLang]);
}

/**
 * Career levels come from the client's framework in English ("Level 3:
 * Supervise"). The Thai interface shows them in Thai; an unknown level is
 * shown as stored rather than guessed at.
 */
const LEVEL_TH: Record<string, string> = {
  Operation: "ปฏิบัติการ",
  "Senior Operation": "ปฏิบัติการอาวุโส",
  Supervise: "กำกับดูแล",
  Management: "บริหารจัดการ",
  Strategy: "กลยุทธ์",
};

export function levelText(level: string, lang: Lang): string {
  if (lang !== "th") return level;
  const m = /^Level (\d+):\s*(.+)$/.exec(level.trim());
  if (!m) return level;
  return `ระดับ ${m[1]}: ${LEVEL_TH[m[2]!] ?? m[2]}`;
}

/** Rating label helper that follows the active language. */
export function useRatingLabel() {
  const { t } = useT();
  return useCallback((score: number) => t(`rating.${score}`), [t]);
}
