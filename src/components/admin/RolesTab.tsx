"use client";

import { useState } from "react";
import { Check, Minus, RotateCcw, ShieldCheck } from "lucide-react";
import { Button, Card, Pill } from "@/components/ui";
import {
  Note,
  TableWrap,
  Td,
  Th,
  Toggle,
  downloadCsv,
} from "@/components/admin/shared";
import { useDemo } from "@/lib/store";
import { useT } from "@/lib/i18n";
import type { Role } from "@/data/people";

const ROLES: Role[] = ["l1", "l2", "admin"];

type CapabilityId =
  | "seeOwnResult"
  | "seeTeamResult"
  | "seeCompanyReport"
  | "runSelfAssessment"
  | "reviewDirectReports"
  | "setTeamIdpGoals"
  | "workOwnIdp"
  | "takeCourses"
  | "redeemRewards"
  | "manageFramework"
  | "manageCycle"
  | "manageLms"
  | "manageRewards"
  | "manageUsers"
  | "sendNotifications"
  | "exportEmployeeList"
  | "viewAuditLog";

const CAPABILITY_ORDER: CapabilityId[] = [
  "seeOwnResult",
  "seeTeamResult",
  "seeCompanyReport",
  "runSelfAssessment",
  "reviewDirectReports",
  "setTeamIdpGoals",
  "workOwnIdp",
  "takeCourses",
  "redeemRewards",
  "manageFramework",
  "manageCycle",
  "manageLms",
  "manageRewards",
  "manageUsers",
  "sendNotifications",
  "exportEmployeeList",
  "viewAuditLog",
];

type Matrix = Record<CapabilityId, Record<Role, boolean>>;

const DEFAULTS: Matrix = {
  seeOwnResult: { l1: true, l2: true, admin: false },
  seeTeamResult: { l1: false, l2: true, admin: true },
  seeCompanyReport: { l1: false, l2: false, admin: true },
  runSelfAssessment: { l1: true, l2: true, admin: false },
  reviewDirectReports: { l1: false, l2: true, admin: false },
  setTeamIdpGoals: { l1: false, l2: true, admin: false },
  workOwnIdp: { l1: true, l2: true, admin: false },
  takeCourses: { l1: true, l2: true, admin: false },
  redeemRewards: { l1: true, l2: true, admin: false },
  manageFramework: { l1: false, l2: false, admin: true },
  manageCycle: { l1: false, l2: false, admin: true },
  manageLms: { l1: false, l2: false, admin: true },
  manageRewards: { l1: false, l2: false, admin: true },
  manageUsers: { l1: false, l2: false, admin: true },
  sendNotifications: { l1: false, l2: false, admin: true },
  exportEmployeeList: { l1: false, l2: true, admin: true },
  viewAuditLog: { l1: false, l2: false, admin: true },
};

const clone = (m: Matrix): Matrix =>
  Object.fromEntries(
    Object.entries(m).map(([k, v]) => [k, { ...v }]),
  ) as Matrix;

/**
 * Role-based access control surface. The app's real guard is the per-role
 * sidebar in `components/layout/nav.ts` plus the `AdminOnly` wrapper around
 * every /admin route — this matrix documents and configures the intent.
 */
export function RolesTab() {
  const { notify, logActivity } = useDemo();
  const { t, tt } = useT();
  const [matrix, setMatrix] = useState<Matrix>(() => clone(DEFAULTS));

  const CAPABILITY: Record<
    CapabilityId,
    { name: string; hint: string; source: string }
  > = {
    seeOwnResult: {
      name: tt("See own result", "ดูผลประเมินของตนเอง"),
      hint: tt(
        "Own scores, gaps, IDP and certificates.",
        "คะแนน ส่วนต่าง แผนพัฒนา และใบรับรองของตนเอง",
      ),
      source: "1.4",
    },
    seeTeamResult: {
      name: tt("See team results", "ดูผลประเมินของทีม"),
      hint: tt(
        "Direct reports only, never the whole company.",
        "เฉพาะผู้ใต้บังคับบัญชาโดยตรง ไม่เห็นทั้งบริษัท",
      ),
      source: "1.4 / 2.1",
    },
    seeCompanyReport: {
      name: tt("See company report", "ดูรายงานระดับองค์กร"),
      hint: tt(
        "Organisation-wide gap analysis and exports.",
        "รายงาน Gap Analysis และการส่งออกระดับองค์กร",
      ),
      source: "1.4",
    },
    runSelfAssessment: {
      name: tt("Run self assessment", "ประเมินตนเอง"),
      hint: tt(
        "KPI plus the competencies their role is assessed on.",
        "KPI และสมรรถนะตามที่ role ของตนถูกประเมิน",
      ),
      source: "1.1",
    },
    reviewDirectReports: {
      name: tt("Review direct reports", "ประเมินลูกทีม"),
      hint: tt(
        "The supervisor half of the assessment.",
        "การประเมินในฐานะหัวหน้างาน",
      ),
      source: "Scope 1",
    },
    setTeamIdpGoals: {
      name: tt("Set development goals for the team", "ตั้งเป้าหมายพัฒนาให้ลูกทีม"),
      hint: tt(
        "Pick a competency with a gap and set the timeline.",
        "เลือก Competency ที่มี Gap แล้วกำหนดช่วงเวลา",
      ),
      source: "2.2",
    },
    workOwnIdp: {
      name: tt("Work on own IDP", "ดำเนินการตามแผนพัฒนาของตนเอง"),
      hint: tt(
        "View the plan and progress it, but not author it.",
        "ดูแผนและทำให้คืบหน้าได้ แต่ไม่ได้เป็นผู้ตั้งเป้าหมาย",
      ),
      source: "2.2",
    },
    takeCourses: {
      name: tt("Take courses and earn certificates", "เรียนหลักสูตรและรับใบรับรอง"),
      hint: tt(
        "Learning path, pre/post test, certificate.",
        "เส้นทางการเรียนรู้ ข้อสอบก่อน/หลัง และใบรับรอง",
      ),
      source: "3.1",
    },
    redeemRewards: {
      name: tt("Collect points and redeem rewards", "สะสมแต้มและแลกของรางวัล"),
      hint: tt(
        "Points, leaderboard and the reward catalogue.",
        "แต้มสะสม อันดับ และการแลกของรางวัล",
      ),
      source: "3.2",
    },
    manageFramework: {
      name: tt("Manage competency framework", "จัดการกรอบสมรรถนะ"),
      hint: tt(
        "Competencies, expected levels and weighting.",
        "สมรรถนะ ระดับที่คาดหวัง และการถ่วงน้ำหนัก",
      ),
      source: "Scope 5",
    },
    manageCycle: {
      name: tt("Manage assessment cycle", "จัดการรอบการประเมิน"),
      hint: tt(
        "Cycle dates, reminders and completion tracking.",
        "ช่วงเวลารอบประเมิน การเตือน และการติดตาม",
      ),
      source: "Scope 5",
    },
    manageLms: {
      name: tt("Manage LMS content library", "จัดการคลังเนื้อหา LMS"),
      hint: tt(
        "Courses, chapters and content types (Video, PDF).",
        "หลักสูตร บทเรียน และประเภทเนื้อหา (วิดีโอ, PDF)",
      ),
      source: "3.3",
    },
    manageRewards: {
      name: tt("Manage rewards and achievements", "จัดการของรางวัลและความสำเร็จ"),
      hint: tt(
        "Catalogue, stock, badges and redemptions.",
        "รายการของรางวัล สต๊อก เหรียญตรา และการแลกรับ",
      ),
      source: "3.2",
    },
    manageUsers: {
      name: tt("Manage users and roles", "จัดการผู้ใช้และบทบาท"),
      hint: tt(
        "Employees, org structure and this matrix.",
        "พนักงาน โครงสร้างองค์กร และตารางสิทธิ์นี้",
      ),
      source: "Scope 5",
    },
    sendNotifications: {
      name: tt("Send announcements and reminders", "ส่งประกาศและการแจ้งเตือน"),
      hint: tt(
        "In-app and email notification rules.",
        "กฎการแจ้งเตือนในระบบและทางอีเมล",
      ),
      source: "3.4",
    },
    exportEmployeeList: {
      name: tt("Export employee list", "ส่งออกรายชื่อพนักงาน"),
      hint: tt(
        "Manager scope is their own team only.",
        "หัวหน้างานส่งออกได้เฉพาะทีมของตน",
      ),
      source: "Scope 5",
    },
    viewAuditLog: {
      name: tt("View activity log and audit trail", "ดูบันทึกกิจกรรมและ audit trail"),
      hint: tt(
        "The full trail of who changed what.",
        "บันทึกทั้งหมดว่าใครแก้อะไร",
      ),
      source: "7",
    },
  };

  function toggle(cap: CapabilityId, role: Role) {
    const next = !matrix[cap][role];
    setMatrix((m) => ({ ...m, [cap]: { ...m[cap], [role]: next } }));
    logActivity(
      next ? "Granted permission" : "Revoked permission",
      CAPABILITY[cap].name,
      t(`role.${role}`),
    );
  }

  function reset() {
    setMatrix(clone(DEFAULTS));
    logActivity("Reset permission matrix", tt("All roles", "ทุกบทบาท"));
    notify(tt("Permissions reset to defaults", "รีเซ็ตสิทธิ์กลับเป็นค่าเริ่มต้นแล้ว"));
  }

  function exportMatrix() {
    downloadCsv(
      "1moby-roles-permissions.csv",
      [tt("Capability", "ความสามารถ"), ...ROLES.map((r) => t(`role.${r}`))],
      CAPABILITY_ORDER.map((cap) => [
        CAPABILITY[cap].name,
        ...ROLES.map((r) => (matrix[cap][r] ? "yes" : "no")),
      ]),
    );
    notify(tt("Permission matrix exported", "ส่งออกตารางสิทธิ์แล้ว"));
  }

  const grantedCount = (role: Role) =>
    CAPABILITY_ORDER.filter((cap) => matrix[cap][role]).length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-brand" />
          <h3 className="text-lg font-bold text-ink">
            {tt("Roles & permissions", "บทบาทและสิทธิ์การใช้งาน")}
          </h3>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportMatrix}>
            {t("action.exportCsv")}
          </Button>
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw size={14} />
            {t("action.reset")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 px-5 pb-5 sm:grid-cols-3">
        {ROLES.map((r) => (
          <Card key={r} className="p-4">
            <p className="text-sm font-bold text-ink">{t(`role.${r}`)}</p>
            <p className="mt-0.5 text-xs text-muted">
              {r === "l1"
                ? tt("Level 1–2 individual contributor", "พนักงานระดับ 1–2")
                : r === "l2"
                  ? tt("Team Lead and above with reports", "หัวหน้าทีมที่มีลูกทีม")
                  : tt("HROD system administrator", "ผู้ดูแลระบบฝ่ายบุคคล")}
            </p>
            <p className="mt-2 text-xl font-bold text-brand">
              {grantedCount(r)}
              <span className="text-xs font-medium text-muted">
                {" "}
                / {CAPABILITY_ORDER.length}
              </span>
            </p>
          </Card>
        ))}
      </div>

      <TableWrap>
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-y border-line/70 bg-surface/60">
              <Th>{tt("Capability", "ความสามารถ")}</Th>
              {ROLES.map((r) => (
                <Th key={r} className="w-40 text-center">
                  {t(`role.${r}`)}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CAPABILITY_ORDER.map((cap) => (
              <tr key={cap} className="border-b border-line/60 last:border-0">
                <Td>
                  <span className="block font-bold">{CAPABILITY[cap].name}</span>
                  <span className="block text-[10px] text-muted">
                    {CAPABILITY[cap].hint}
                  </span>
                  <span className="mt-1 inline-block rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted">
                    {tt("Requirement", "ข้อกำหนด")} {CAPABILITY[cap].source}
                  </span>
                </Td>
                {ROLES.map((r) => {
                  const on = matrix[cap][r];
                  return (
                    <Td key={r}>
                      <div className="flex items-center justify-center gap-2">
                        <span
                          className={
                            on
                              ? "text-success"
                              : "text-line-2"
                          }
                          aria-hidden
                        >
                          {on ? <Check size={14} /> : <Minus size={14} />}
                        </span>
                        <Toggle
                          checked={on}
                          onChange={() => toggle(cap, r)}
                          label={`${CAPABILITY[cap].name} — ${t(`role.${r}`)}`}
                        />
                      </div>
                    </Td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>

      <div className="space-y-3 border-t border-line/70 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="warn">{tt("Demo-level enforcement", "การบังคับใช้ระดับสาธิต")}</Pill>
          <span className="text-xs text-muted">{t("admin.demoOnly")}</span>
        </div>
        <Note>
          {tt(
            "Footnote: the app's real guard is the per-role sidebar (components/layout/nav.ts) plus the AdminOnly wrapper around every /admin route — a non-admin session never gets an admin menu item and is bounced back to the dashboard if it navigates to one directly. Toggling a cell here records the intent in the activity log; wiring it to the route guards is a backend concern.",
            "หมายเหตุ: การควบคุมสิทธิ์จริงของแอปคือเมนูด้านข้างตามบทบาท (components/layout/nav.ts) ร่วมกับตัวครอบ AdminOnly ในทุกเส้นทาง /admin — ผู้ใช้ที่ไม่ใช่ผู้ดูแลระบบจะไม่เห็นเมนูผู้ดูแล และจะถูกส่งกลับไปยังแดชบอร์ดหากเข้าลิงก์โดยตรง การสลับสวิตช์ในตารางนี้จะบันทึกความตั้งใจไว้ในบันทึกกิจกรรม ส่วนการเชื่อมกับตัวควบคุมเส้นทางจริงเป็นงานฝั่งเซิร์ฟเวอร์",
          )}
        </Note>
      </div>
    </div>
  );
}
