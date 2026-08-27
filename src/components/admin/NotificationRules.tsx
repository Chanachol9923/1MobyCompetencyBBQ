"use client";

import { useState } from "react";
import { BellRing, BookOpen, CalendarClock, Send, Target, Timer } from "lucide-react";
import { Button, Card, CardHeader, Pill, Select } from "@/components/ui";
import { Note, Toggle } from "@/components/admin/shared";
import { useDemo, type AppNotification } from "@/lib/store";
import { useT } from "@/lib/i18n";

type Channel = AppNotification["channel"];

type RuleId = "idp" | "windowOpen" | "deadline" | "courseAssigned";

type RuleSetting = { enabled: boolean; channel: Channel };

const RULE_ICON = {
  idp: Target,
  windowOpen: CalendarClock,
  deadline: Timer,
  courseAssigned: BookOpen,
} as const;

const RULE_KIND: Record<RuleId, AppNotification["kind"]> = {
  idp: "idp",
  windowOpen: "assessment",
  deadline: "assessment",
  courseAssigned: "lms",
};

const RULE_HREF: Record<RuleId, string> = {
  idp: "/idp",
  windowOpen: "/assessment",
  deadline: "/assessment",
  courseAssigned: "/lms",
};

const DEFAULTS: Record<RuleId, RuleSetting> = {
  idp: { enabled: true, channel: "In-app" },
  windowOpen: { enabled: true, channel: "Both" },
  deadline: { enabled: true, channel: "Email" },
  courseAssigned: { enabled: false, channel: "In-app" },
};

const RULE_ORDER: RuleId[] = ["idp", "windowOpen", "deadline", "courseAssigned"];

/**
 * The four notification rules the requirement pack lists. Each rule owns a
 * channel and a "Run now" trigger that fires the real notification to everyone
 * so the bell in the top bar can be demonstrated.
 */
export function NotificationRules() {
  const { notify, pushNotification, logActivity } = useDemo();
  const { t, tt } = useT();
  const [rules, setRules] = useState<Record<RuleId, RuleSetting>>(DEFAULTS);

  const CHANNELS: Channel[] = ["Email", "In-app", "Both"];

  const channelLabel = (c: Channel) =>
    c === "Email"
      ? tt("Email", "อีเมล")
      : c === "In-app"
        ? tt("In-app", "ในแอป")
        : tt("Both", "ทั้งสองช่องทาง");

  const COPY: Record<RuleId, { name: string; when: string; title: string; body: string }> =
    {
      idp: {
        name: tt("New IDP activity", "มีกิจกรรมใหม่ในแผนพัฒนา"),
        when: tt(
          "A manager adds or updates a development goal.",
          "เมื่อหัวหน้าเพิ่มหรือแก้ไขเป้าหมายการพัฒนา",
        ),
        title: tt("Your IDP was updated", "แผนพัฒนารายบุคคลของคุณถูกอัปเดต"),
        body: tt(
          "A new development activity has been added to your individual development plan.",
          "มีการเพิ่มกิจกรรมการพัฒนาใหม่ในแผนพัฒนารายบุคคลของคุณ",
        ),
      },
      windowOpen: {
        name: tt("Assessment window opening", "เปิดรอบการประเมิน"),
        when: tt(
          "The self-assessment window opens for a cycle.",
          "เมื่อรอบการประเมินตนเองเปิดให้ทำ",
        ),
        title: tt("The assessment window is open", "รอบการประเมินเปิดแล้ว"),
        body: tt(
          "Self assessment is now open. Complete Core and Functional competencies first.",
          "การประเมินตนเองเปิดแล้ว กรุณาทำสมรรถนะหลักและสมรรถนะตามสายงานก่อน",
        ),
      },
      deadline: {
        name: tt("Deadline approaching", "ใกล้ถึงกำหนดส่ง"),
        when: tt(
          "Seven days before the cycle closes.",
          "เจ็ดวันก่อนปิดรอบการประเมิน",
        ),
        title: tt("Assessment deadline in 7 days", "อีก 7 วันจะปิดรอบการประเมิน"),
        body: tt(
          "Submit your self assessment before the cycle closes.",
          "กรุณาส่งการประเมินตนเองก่อนปิดรอบ",
        ),
      },
      courseAssigned: {
        name: tt("Course assigned", "ได้รับมอบหมายหลักสูตร"),
        when: tt(
          "A course is attached to a development goal.",
          "เมื่อมีการผูกหลักสูตรกับเป้าหมายการพัฒนา",
        ),
        title: tt("A course was assigned to you", "คุณได้รับมอบหมายหลักสูตรใหม่"),
        body: tt(
          "A new course is waiting in your learning plan.",
          "มีหลักสูตรใหม่รออยู่ในแผนการเรียนรู้ของคุณ",
        ),
      },
    };

  function setRule(id: RuleId, patch: Partial<RuleSetting>) {
    setRules((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  }

  function toggleRule(id: RuleId) {
    const next = !rules[id].enabled;
    setRule(id, { enabled: next });
    logActivity(
      next ? "Enabled notification rule" : "Disabled notification rule",
      COPY[id].name,
    );
    notify(
      next
        ? tt(`Rule enabled: ${COPY[id].name}`, `เปิดใช้กฎ: ${COPY[id].name}`)
        : tt(`Rule disabled: ${COPY[id].name}`, `ปิดใช้กฎ: ${COPY[id].name}`),
    );
  }

  function changeChannel(id: RuleId, channel: Channel) {
    setRule(id, { channel });
    logActivity("Changed notification channel", COPY[id].name, channel);
  }

  function runNow(id: RuleId) {
    const rule = rules[id];
    pushNotification({
      audience: "*",
      title: COPY[id].title,
      body: COPY[id].body,
      kind: RULE_KIND[id],
      channel: rule.channel,
      href: RULE_HREF[id],
    });
    logActivity("Triggered notification rule", COPY[id].name, rule.channel);
    notify(
      tt(
        `Sent to all employees via ${channelLabel(rule.channel)}`,
        `ส่งถึงพนักงานทุกคนผ่าน ${channelLabel(rule.channel)}`,
      ),
    );
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <BellRing size={18} className="text-brand" />
            {tt("Notification rules", "กฎการแจ้งเตือน")}
          </span>
        }
        subtitle={tt(
          "System-generated notifications, separate from announcements.",
          "การแจ้งเตือนที่ระบบสร้างขึ้นเอง แยกจากประกาศทั่วไป",
        )}
      />
      <ul className="border-t border-line/70">
        {RULE_ORDER.map((id) => {
          const Icon = RULE_ICON[id];
          const rule = rules[id];
          return (
            <li
              key={id}
              className="flex flex-wrap items-center gap-4 border-b border-line/60 p-5 last:border-0"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand">
                <Icon size={18} />
              </span>
              <div className="min-w-[180px] flex-1">
                <p className="text-sm font-bold text-ink">{COPY[id].name}</p>
                <p className="mt-0.5 text-xs text-muted">{COPY[id].when}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Pill tone={rule.enabled ? "success" : "neutral"}>
                  {rule.enabled ? t("status.active") : t("status.inactive")}
                </Pill>
                <Toggle
                  checked={rule.enabled}
                  onChange={() => toggleRule(id)}
                  label={`${COPY[id].name} — ${t("label.status")}`}
                />
                <Select
                  value={rule.channel}
                  onChange={(e) => changeChannel(id, e.target.value as Channel)}
                  className="h-9 w-36 py-0 text-xs"
                  aria-label={`${COPY[id].name} — ${t("label.channel")}`}
                >
                  {CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {channelLabel(c)}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runNow(id)}
                  disabled={!rule.enabled}
                >
                  <Send size={13} className="text-brand" />
                  {t("action.runNow")}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="p-5 pt-0">
        <Note>
          {tt(
            "“Run now” fires the rule immediately to every employee so you can watch it land in the bell. In production the same payload is raised by the scheduler when the condition is met.",
            "ปุ่ม “ส่งทันที” จะส่งการแจ้งเตือนถึงพนักงานทุกคนทันที เพื่อให้เห็นผลในกระดิ่งแจ้งเตือน ในระบบจริงตัวจัดตารางเวลาจะส่งข้อความเดียวกันนี้เมื่อเงื่อนไขเป็นจริง",
          )}
        </Note>
      </div>
    </Card>
  );
}
