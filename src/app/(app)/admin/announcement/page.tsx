"use client";

import { useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  Megaphone,
  Pencil,
  Plus,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import {
  Button,
  Card,
  Field,
  Input,
  Modal,
  PageHeading,
  Pill,
  Select,
  Textarea,
} from "@/components/ui";
import {
  AdminOnly,
  SearchInput,
  IconAction,
  Note,
  formatDate,
  todayIso,
} from "@/components/admin/shared";
import { NotificationRules } from "@/components/admin/NotificationRules";
import type { Announcement } from "@/data/learning";
import { DEPARTMENTS } from "@/data/people";
import { useDemo } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export default function ManageAnnouncementPage() {
  return (
    <AdminOnly>
      <ManageAnnouncement />
    </AdminOnly>
  );
}

const CHANNELS: Announcement["channel"][] = ["Email", "In-app", "Both"];

type Draft = {
  title: string;
  body: string;
  audience: string;
  channel: Announcement["channel"];
  publishNow: boolean;
  date: string;
};

const emptyDraft = (): Draft => ({
  title: "",
  body: "",
  audience: "All employees",
  channel: "Both",
  publishNow: true,
  date: todayIso(),
});

function ManageAnnouncement() {
  const { state, person, update, notify, pushNotification, logActivity } = useDemo();
  const { t, tt } = useT();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [confirm, setConfirm] = useState<Announcement | null>(null);

  const list = state.announcements;

  const channelLabel = (c: Announcement["channel"]) =>
    c === "Email"
      ? tt("Email", "อีเมล")
      : c === "In-app"
        ? tt("In-app", "ในแอป")
        : tt("Both", "ทั้งสองช่องทาง");

  const statusLabel = (s: Announcement["status"]) =>
    s === "Published"
      ? t("status.published")
      : s === "Scheduled"
        ? t("status.scheduled")
        : t("status.draft");

  /** "All employees" and departments broadcast; an individual is targeted. */
  const AUDIENCES = useMemo(
    () => [
      "All employees",
      ...DEPARTMENTS.map((d) => d.name),
      ...state.employees.map((p) => p.name),
    ],
    [state.employees],
  );

  const audienceLabel = (a: string) =>
    a === "All employees" ? t("label.everyone") : a;

  /** Maps the display audience onto the notification audience: "*" or a person id. */
  const audienceTarget = (label: string) =>
    state.employees.find((p) => p.name === label)?.id ?? "*";

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((a) => {
      const matchQ =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.body.toLowerCase().includes(q) ||
        a.audience.toLowerCase().includes(q);
      const matchS = statusFilter === "all" || a.status === statusFilter;
      const matchC = channelFilter === "all" || a.channel === channelFilter;
      return matchQ && matchS && matchC;
    });
  }, [list, query, statusFilter, channelFilter]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function openCreate() {
    setDraft(emptyDraft());
    setEditingId(null);
    setStep(1);
    setOpen(true);
  }

  function openEdit(a: Announcement) {
    setDraft({
      title: a.title,
      body: a.body,
      audience: a.audience,
      channel: a.channel,
      publishNow: a.status === "Published",
      date: a.publishedAt || todayIso(),
    });
    setEditingId(a.id);
    setStep(1);
    setOpen(true);
  }

  /** Raises the real in-app / email notification for a published announcement. */
  function deliver(a: Announcement) {
    const target = audienceTarget(a.audience);
    pushNotification({
      audience: target,
      title: a.title,
      body: a.body,
      kind: "system",
      channel: a.channel,
      href: "/dashboard",
    });
    logActivity(
      "Published announcement",
      a.title,
      `${a.audience} · ${a.channel}`,
    );
  }

  function sendTestToMyself() {
    if (!person) return;
    if (!draft.title.trim()) {
      notify(tt("Announcement title is required", "กรุณากรอกหัวข้อประกาศ"));
      setStep(1);
      return;
    }
    pushNotification({
      audience: person.id,
      title: `[${tt("TEST", "ทดสอบ")}] ${draft.title.trim()}`,
      body: draft.body.trim() || tt("(no message body)", "(ไม่มีเนื้อหา)"),
      kind: "system",
      channel: draft.channel,
      href: "/admin/announcement",
    });
    logActivity("Sent test announcement", draft.title.trim() || "(untitled)", person.name);
    notify(
      tt(
        "Test notification sent to you — open the bell",
        "ส่งการแจ้งเตือนทดสอบถึงคุณแล้ว — เปิดดูที่กระดิ่ง",
      ),
    );
  }

  function save() {
    if (!draft.title.trim()) {
      notify(tt("Announcement title is required", "กรุณากรอกหัวข้อประกาศ"));
      setStep(1);
      return;
    }
    const status: Announcement["status"] = draft.publishNow
      ? "Published"
      : "Scheduled";
    const publishedAt = draft.publishNow ? todayIso() : draft.date;

    if (editingId) {
      const id = editingId;
      const previous = list.find((a) => a.id === id);
      const next: Announcement = {
        id,
        title: draft.title.trim(),
        body: draft.body.trim(),
        audience: draft.audience,
        channel: draft.channel,
        status,
        publishedAt,
      };
      update((s) => ({
        ...s,
        announcements: s.announcements.map((a) => (a.id === id ? next : a)),
      }));
      // only notify when this edit is what actually publishes it
      if (status === "Published" && previous?.status !== "Published") {
        deliver(next);
      } else {
        logActivity("Updated announcement", next.title, statusLabel(status));
      }
      notify(tt(`“${next.title}” updated`, `อัปเดต “${next.title}” แล้ว`));
    } else {
      const announcement: Announcement = {
        id: `an-${Date.now()}`,
        title: draft.title.trim(),
        body: draft.body.trim(),
        audience: draft.audience,
        channel: draft.channel,
        publishedAt,
        status,
      };
      update((s) => ({
        ...s,
        announcements: [announcement, ...s.announcements],
      }));
      if (status === "Published") {
        deliver(announcement);
        notify(
          tt(
            `“${announcement.title}” published and notified`,
            `เผยแพร่ “${announcement.title}” และส่งการแจ้งเตือนแล้ว`,
          ),
        );
      } else {
        logActivity(
          "Scheduled announcement",
          announcement.title,
          formatDate(publishedAt),
        );
        notify(
          tt(
            `“${announcement.title}” scheduled for ${formatDate(publishedAt)} — no notification sent yet`,
            `ตั้งเวลา “${announcement.title}” ไว้วันที่ ${formatDate(publishedAt)} — ยังไม่ส่งการแจ้งเตือน`,
          ),
        );
      }
    }
    setOpen(false);
  }

  /** Publishes a scheduled announcement right away, which does notify. */
  function publishNow(a: Announcement) {
    const next: Announcement = {
      ...a,
      status: "Published",
      publishedAt: todayIso(),
    };
    update((s) => ({
      ...s,
      announcements: s.announcements.map((x) => (x.id === a.id ? next : x)),
    }));
    deliver(next);
    notify(
      tt(
        `“${a.title}” published and notified`,
        `เผยแพร่ “${a.title}” และส่งการแจ้งเตือนแล้ว`,
      ),
    );
  }

  function remove(a: Announcement) {
    update((s) => ({
      ...s,
      announcements: s.announcements.filter((x) => x.id !== a.id),
    }));
    logActivity("Deleted announcement", a.title);
    notify(tt(`“${a.title}” deleted`, `ลบ “${a.title}” แล้ว`));
    setConfirm(null);
  }

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading
        title={tt("Announcement Management", "จัดการประกาศ")}
        right={
          <Button onClick={openCreate}>
            <Plus size={15} />
            {tt("Create Announcement", "สร้างประกาศ")}
          </Button>
        }
      />

      <Card className="p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink">
              {t("action.search")}
            </span>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder={tt("Search announcements...", "ค้นหาประกาศ...")}
            />
          </div>
          <Field label={t("label.status")}>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">{tt("All Status", "ทุกสถานะ")}</option>
              {(["Published", "Scheduled", "Draft"] as const).map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("label.channel")}>
            <Select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
            >
              <option value="all">{tt("All Type", "ทุกช่องทาง")}</option>
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {channelLabel(c)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="mt-5">
        <div className="flex items-center justify-between p-5">
          <h3 className="text-base font-bold text-ink">
            {tt("Announcements", "ประกาศ")} ({visible.length})
          </h3>
        </div>
        <ul className="border-t border-line/70">
          {visible.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-start gap-4 border-b border-line/60 p-5 last:border-0"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand">
                <Megaphone size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink">{a.title}</p>
                <p className="mt-1 text-xs text-muted">{a.body}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Pill
                    tone={
                      a.status === "Published"
                        ? "success"
                        : a.status === "Scheduled"
                          ? "warn"
                          : "neutral"
                    }
                  >
                    {statusLabel(a.status)}
                  </Pill>
                  <Pill tone="brand">{channelLabel(a.channel)}</Pill>
                  <Pill>
                    <Users size={11} className="mr-1" />
                    {audienceLabel(a.audience)}
                  </Pill>
                  <span className="flex items-center gap-1 text-[11px] text-muted">
                    <CalendarDays size={12} />
                    {formatDate(a.publishedAt)}
                  </span>
                  {a.status === "Scheduled" ? (
                    <span className="text-[11px] text-muted">
                      {tt(
                        "· not notified yet",
                        "· ยังไม่ได้ส่งการแจ้งเตือน",
                      )}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {a.status === "Scheduled" ? (
                  <Button variant="outline" size="sm" onClick={() => publishNow(a)}>
                    <Send size={13} className="text-brand" />
                    {tt("Publish now", "เผยแพร่ทันที")}
                  </Button>
                ) : null}
                <IconAction
                  tone="brand"
                  aria-label={`${t("action.edit")} ${a.title}`}
                  onClick={() => openEdit(a)}
                >
                  <Pencil size={14} />
                </IconAction>
                <IconAction
                  tone="danger"
                  aria-label={`${t("action.delete")} ${a.title}`}
                  onClick={() => setConfirm(a)}
                >
                  <Trash2 size={14} />
                </IconAction>
              </div>
            </li>
          ))}
          {visible.length === 0 ? (
            <li className="p-10 text-center text-sm text-muted">
              {t("admin.noMatch")}
            </li>
          ) : null}
        </ul>
      </Card>

      {/* ------------------------------------------- notification rules */}
      <div className="mt-5">
        <NotificationRules />
      </div>

      {/* ------------------------------------------------ create / edit */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          editingId
            ? tt("Edit Announcement", "แก้ไขประกาศ")
            : tt("Create New Announcement", "สร้างประกาศใหม่")
        }
        subtitle={
          step === 1
            ? tt("Step 1 of 2 · Content", "ขั้นที่ 1 จาก 2 · เนื้อหา")
            : tt("Step 2 of 2 · Schedule & preview", "ขั้นที่ 2 จาก 2 · กำหนดเวลาและตัวอย่าง")
        }
        width="max-w-2xl"
        footer={
          step === 1 ? (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t("action.cancel")}
              </Button>
              <Button onClick={() => setStep(2)}>
                {tt("Next: schedule", "ถัดไป: กำหนดเวลา")}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={sendTestToMyself}>
                <Bell size={14} />
                {tt("Send test to myself", "ส่งทดสอบถึงตัวเอง")}
              </Button>
              <Button variant="outline" onClick={() => setStep(1)}>
                {t("action.back")}
              </Button>
              <Button onClick={save}>
                {editingId
                  ? t("action.saveChanges")
                  : draft.publishNow
                    ? tt("Publish & notify", "เผยแพร่และแจ้งเตือน")
                    : tt("Schedule", "ตั้งเวลา")}
              </Button>
            </>
          )
        }
      >
        {step === 1 ? (
          <div className="grid gap-4">
            <Field label={`${t("label.title")} *`}>
              <Input
                value={draft.title}
                placeholder={tt("Enter announcement title", "กรอกหัวข้อประกาศ")}
                onChange={(e) => set("title", e.target.value)}
              />
            </Field>
            <Field label={`${tt("Message", "ข้อความ")} *`}>
              <Textarea
                value={draft.body}
                placeholder={tt("Enter announcement message", "กรอกเนื้อหาประกาศ")}
                onChange={(e) => set("body", e.target.value)}
              />
            </Field>
            <Field
              label={t("label.audience")}
              hint={
                audienceTarget(draft.audience) === "*"
                  ? tt(
                      "Broadcast — every employee receives it.",
                      "ส่งแบบกระจาย — พนักงานทุกคนจะได้รับ",
                    )
                  : tt(
                      "Targeted — only this person receives it.",
                      "ส่งเจาะจง — เฉพาะบุคคลนี้เท่านั้นที่จะได้รับ",
                    )
              }
            >
              <Select
                value={draft.audience}
                onChange={(e) => set("audience", e.target.value)}
              >
                {AUDIENCES.map((a) => (
                  <option key={a} value={a}>
                    {audienceLabel(a)}
                  </option>
                ))}
              </Select>
            </Field>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-ink">
                {t("label.channel")}
              </legend>
              <div className="flex flex-wrap gap-4">
                {CHANNELS.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="radio"
                      name="channel"
                      value={c}
                      checked={draft.channel === c}
                      onChange={() => set("channel", c)}
                      className="accent-[#006bff]"
                    />
                    {channelLabel(c)}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        ) : (
          <div className="grid gap-4">
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-ink">
                {tt("Schedule", "กำหนดเวลา")}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { value: true, label: tt("Publish now", "เผยแพร่ทันที") },
                  {
                    value: false,
                    label: tt("Schedule for a date", "ตั้งเวลาเผยแพร่"),
                  },
                ].map((opt) => (
                  <label
                    key={String(opt.value)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                      draft.publishNow === opt.value
                        ? "border-brand bg-brand-tint text-brand"
                        : "border-line text-ink",
                    )}
                  >
                    <input
                      type="radio"
                      name="schedule"
                      checked={draft.publishNow === opt.value}
                      onChange={() => set("publishNow", opt.value)}
                      className="accent-[#006bff]"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {!draft.publishNow ? (
              <Field label={tt("Publish date", "วันที่เผยแพร่")}>
                <Input
                  type="date"
                  value={draft.date}
                  onChange={(e) => set("date", e.target.value)}
                />
              </Field>
            ) : null}

            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">
                {tt("Preview", "ตัวอย่าง")}
              </p>
              <div className="rounded-xl border border-line/70 bg-surface/50 p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-white">
                    <Bell size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">
                      {draft.title || tt("Announcement title", "หัวข้อประกาศ")}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {draft.body ||
                        tt(
                          "Your message will appear here.",
                          "ข้อความของคุณจะแสดงที่นี่",
                        )}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Pill tone={draft.publishNow ? "success" : "warn"}>
                        {draft.publishNow
                          ? t("status.published")
                          : t("status.scheduled")}
                      </Pill>
                      <Pill tone="brand">{channelLabel(draft.channel)}</Pill>
                      <Pill>{audienceLabel(draft.audience)}</Pill>
                      <span className="text-[11px] text-muted">
                        {formatDate(draft.publishNow ? todayIso() : draft.date)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Note>
              {draft.publishNow
                ? tt(
                    "Publishing raises an in-app notification for the selected audience straight away and writes an entry to the activity log.",
                    "การเผยแพร่จะส่งการแจ้งเตือนในแอปถึงกลุ่มผู้รับที่เลือกทันที และบันทึกลงบันทึกกิจกรรม",
                  )
                : tt(
                    "A scheduled announcement is stored with status Scheduled and does not notify anyone until it is published.",
                    "ประกาศที่ตั้งเวลาไว้จะถูกบันทึกด้วยสถานะ “ตั้งเวลาไว้” และจะยังไม่แจ้งเตือนใครจนกว่าจะเผยแพร่",
                  )}
            </Note>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={tt("Delete announcement", "ลบประกาศ")}
        width="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              {t("action.cancel")}
            </Button>
            <Button variant="danger" onClick={() => confirm && remove(confirm)}>
              {t("action.delete")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {tt("Delete", "ลบ")}{" "}
          <span className="font-medium text-ink">{confirm?.title}</span>?{" "}
          {tt(
            "It will disappear from every employee feed.",
            "ประกาศนี้จะหายไปจากฟีดของพนักงานทุกคน",
          )}
        </p>
      </Modal>
    </div>
  );
}
