"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BellRing,
  CalendarDays,
  CheckCircle2,
  Eye,
  Megaphone,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Send,
  Trash2,
  Undo2,
  Users,
} from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Modal,
  PageHeading,
  Pill,
  Select,
  Textarea,
} from "@/components/ui";
import { IconAction, Note, SearchInput } from "@/components/admin/shared";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  createAnnouncement,
  deleteAnnouncement,
  publishAnnouncementNow,
  setAnnouncementPinned,
  unpublishAnnouncement,
  updateAnnouncement,
} from "@/server/announcements";
import type {
  ActionResult,
  AdminAnnouncementRow,
  Audience,
  AudienceOptions,
  Channel,
  NotificationRuleRow,
} from "./types";
import {
  audienceKindLabel,
  audienceLabel,
  channelLabel,
  excerpt,
  formatWhen,
  pick,
  statusLabel,
  toLocalInput,
} from "./format";

/**
 * Announcement management, writing to the database.
 *
 * Nothing here decides what is allowed: every button calls a server action that
 * re-checks `send_announcements` for itself. This component only decides what
 * to draw and how to explain the result.
 */

const AUDIENCES: Audience[] = ["ALL", "DEPARTMENT", "DIVISION", "JOB_ROLE", "PERSON"];
const CHANNELS: Channel[] = ["IN_APP", "EMAIL", "BOTH"];

type Draft = {
  id: string | null;
  titleEn: string;
  titleTh: string;
  bodyEn: string;
  bodyTh: string;
  audience: Audience;
  audienceRef: string;
  channel: Channel;
  pinned: boolean;
  publishNow: boolean;
  publishAt: string;
};

const emptyDraft = (): Draft => ({
  id: null,
  titleEn: "",
  titleTh: "",
  bodyEn: "",
  bodyTh: "",
  audience: "ALL",
  audienceRef: "",
  channel: "BOTH",
  pinned: false,
  publishNow: true,
  publishAt: "",
});

type Feedback = { tone: "ok" | "error"; en: string; th: string } | null;

export function AnnouncementAdmin({
  rows,
  options,
  rules,
  embedded = false,
}: {
  rows: AdminAnnouncementRow[];
  options: AudienceOptions;
  rules: NotificationRuleRow[];
  /** inside the Announcements page, which supplies the heading and tabs */
  embedded?: boolean;
}) {
  const { t, tt, lang } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [confirm, setConfirm] = useState<AdminAnnouncementRow | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  /* ------------------------------------------------------------- filtering */

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const scheduled =
        row.status === "DRAFT" &&
        row.publishAt !== null &&
        new Date(row.publishAt).getTime() > Date.now();
      const bucket = row.status === "PUBLISHED" ? "PUBLISHED" : scheduled ? "SCHEDULED" : "DRAFT";
      if (statusFilter !== "all" && bucket !== statusFilter) return false;
      if (channelFilter !== "all" && row.channel !== channelFilter) return false;
      if (!q) return true;
      return [row.titleEn, row.titleTh, row.bodyEn, row.bodyTh, row.audienceLabel]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q));
    });
  }, [rows, query, statusFilter, channelFilter]);

  /* --------------------------------------------------------------- actions */

  /** Every mutation lands here: report it, then re-read from the server. */
  function run<T>(
    action: () => Promise<ActionResult<T>>,
    success: { en: string; th: string },
    after?: () => void,
  ) {
    setFeedback(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setFeedback({ tone: "error", en: res.errorEn, th: res.errorTh });
        return;
      }
      setFeedback({ tone: "ok", ...success });
      after?.();
      router.refresh();
    });
  }

  function openCreate() {
    setDraft(emptyDraft());
    setStep(1);
    setFeedback(null);
    setOpen(true);
  }

  function openEdit(row: AdminAnnouncementRow) {
    setDraft({
      id: row.id,
      titleEn: row.titleEn,
      titleTh: row.titleTh ?? "",
      bodyEn: row.bodyEn,
      bodyTh: row.bodyTh ?? "",
      audience: row.audience,
      audienceRef: row.audienceRef ?? "",
      channel: row.channel,
      pinned: row.pinned,
      publishNow: row.status === "PUBLISHED",
      publishAt: toLocalInput(row.publishAt),
    });
    setStep(1);
    setFeedback(null);
    setOpen(true);
  }

  const payload = () => ({
    titleEn: draft.titleEn,
    titleTh: draft.titleTh.trim() ? draft.titleTh : null,
    bodyEn: draft.bodyEn,
    bodyTh: draft.bodyTh.trim() ? draft.bodyTh : null,
    audience: draft.audience,
    audienceRef: draft.audience === "ALL" ? null : draft.audienceRef || null,
    channel: draft.channel,
    pinned: draft.pinned,
    publishAt: draft.publishNow ? null : draft.publishAt || null,
    publishNow: draft.publishNow,
  });

  function save() {
    if (!draft.titleEn.trim() || !draft.bodyEn.trim()) {
      setStep(1);
      setFeedback({
        tone: "error",
        en: "An English title and message are required — Thai is optional.",
        th: "ต้องกรอกหัวข้อและข้อความภาษาอังกฤษ ส่วนภาษาไทยไม่บังคับ",
      });
      return;
    }
    if (draft.audience !== "ALL" && !draft.audienceRef) {
      setStep(1);
      setFeedback({
        tone: "error",
        en: "Pick who this announcement goes to.",
        th: "กรุณาเลือกกลุ่มผู้รับของประกาศนี้",
      });
      return;
    }
    if (!draft.publishNow && !draft.publishAt) {
      setFeedback({
        tone: "error",
        en: "Pick a date and time to publish, or publish now.",
        th: "กรุณาเลือกวันและเวลาเผยแพร่ หรือเลือกเผยแพร่ทันที",
      });
      return;
    }

    const body = payload();
    const editing = draft.id;
    run(
      () =>
        editing
          ? updateAnnouncement({ ...body, id: editing })
          : createAnnouncement(body),
      draft.publishNow
        ? {
            en: "Published — everyone in the audience has been notified.",
            th: "เผยแพร่แล้ว — ส่งการแจ้งเตือนถึงกลุ่มผู้รับเรียบร้อย",
          }
        : {
            en: "Saved as a scheduled draft. Nobody has been notified yet.",
            th: "บันทึกเป็นฉบับร่างที่ตั้งเวลาไว้ ยังไม่ได้แจ้งเตือนใคร",
          },
      () => setOpen(false),
    );
  }

  /* ----------------------------------------------------------------- copy */

  const statusOf = (row: AdminAnnouncementRow) =>
    statusLabel(row.status, row.publishAt, lang);

  const audienceTargets = (audience: Audience) => {
    if (audience === "DEPARTMENT") {
      return options.departments.map((d) => ({ id: d.id, label: d.name }));
    }
    if (audience === "DIVISION") {
      return options.divisions.map((d) => ({
        id: d.id,
        label: `${d.departmentName} · ${d.name}`,
      }));
    }
    if (audience === "JOB_ROLE") {
      return options.jobRoles.map((r) => ({ id: r.id, label: `${r.name} — ${r.level}` }));
    }
    if (audience === "PERSON") {
      return options.employees.map((e) => ({ id: e.id, label: `${e.name} (${e.email})` }));
    }
    return [];
  };

  const targets = audienceTargets(draft.audience);
  const previewAudience =
    draft.audience === "ALL"
      ? audienceKindLabel("ALL", lang)
      : `${audienceKindLabel(draft.audience, lang)} · ${
          targets.find((x) => x.id === draft.audienceRef)?.label ??
          tt("not chosen", "ยังไม่ได้เลือก")
        }`;

  const createButton = (
    <Button onClick={openCreate}>
      <Plus size={15} />
      {tt("Create Announcement", "สร้างประกาศ")}
    </Button>
  );

  return (
    <div className={embedded ? undefined : "mx-auto max-w-[1200px] p-6 lg:p-10"}>
      {embedded ? (
        <div className="mb-4 flex justify-end max-sm:[&>*]:w-full">{createButton}</div>
      ) : (
        <PageHeading
          title={tt("Announcement Management", "จัดการประกาศ")}
          subtitle={tt(
            "Published announcements appear in every recipient's feed and raise a notification.",
            "ประกาศที่เผยแพร่จะแสดงในฟีดของผู้รับทุกคนพร้อมส่งการแจ้งเตือน",
          )}
          right={createButton}
        />
      )}

      {feedback && !open ? (
        <div
          role="status"
          className={cn(
            "mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm",
            feedback.tone === "ok"
              ? "border-success/40 bg-success/10 text-success"
              : "border-accent/40 bg-accent/10 text-accent",
          )}
        >
          {feedback.tone === "ok" ? (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
          )}
          <span>{lang === "th" ? feedback.th : feedback.en}</span>
        </div>
      ) : null}

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
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">{tt("All Status", "ทุกสถานะ")}</option>
              <option value="PUBLISHED">{t("status.published")}</option>
              <option value="SCHEDULED">{t("status.scheduled")}</option>
              <option value="DRAFT">{t("status.draft")}</option>
            </Select>
          </Field>
          <Field label={t("label.channel")}>
            <Select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
              <option value="all">{tt("All Type", "ทุกช่องทาง")}</option>
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {channelLabel(c, lang)}
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
          {visible.map((row) => {
            const published = row.status === "PUBLISHED";
            const scheduled =
              !published &&
              row.publishAt !== null &&
              new Date(row.publishAt).getTime() > Date.now();
            return (
              <li
                key={row.id}
                className="flex flex-wrap items-start gap-4 border-b border-line/60 p-5 last:border-0"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand">
                  <Megaphone size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">
                    {row.pinned ? (
                      <Pin size={13} className="mr-1 inline -translate-y-px text-amber" />
                    ) : null}
                    {pick(lang, row.titleEn, row.titleTh)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {excerpt(pick(lang, row.bodyEn, row.bodyTh), 160)}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Pill tone={published ? "success" : scheduled ? "warn" : "neutral"}>
                      {statusOf(row)}
                    </Pill>
                    <Pill tone="brand">{channelLabel(row.channel, lang)}</Pill>
                    <Pill>
                      <Users size={11} className="mr-1" />
                      {audienceLabel(row.audience, row.audienceLabel, lang)}
                    </Pill>
                    <span className="flex items-center gap-1 text-[11px] text-muted">
                      <CalendarDays size={12} />
                      {published
                        ? formatWhen(row.publishedAt, lang)
                        : scheduled
                          ? `${tt("scheduled", "ตั้งเวลา")} ${formatWhen(row.publishAt, lang)}`
                          : tt("not scheduled", "ยังไม่ได้ตั้งเวลา")}
                    </span>
                    {published ? (
                      <span className="flex items-center gap-1 text-[11px] text-muted">
                        <Eye size={12} />
                        {tt(`read by ${row.readCount}`, `อ่านแล้ว ${row.readCount} คน`)}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted">
                        {tt("· nobody notified yet", "· ยังไม่ได้ส่งการแจ้งเตือน")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {published ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(() => unpublishAnnouncement(row.id), {
                          en: "Taken off the feed.",
                          th: "นำออกจากฟีดแล้ว",
                        })
                      }
                    >
                      <Undo2 size={13} className="text-muted" />
                      {tt("Unpublish", "ยกเลิกเผยแพร่")}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(() => publishAnnouncementNow(row.id), {
                          en: "Published — the audience has been notified.",
                          th: "เผยแพร่แล้ว — ส่งการแจ้งเตือนถึงกลุ่มผู้รับเรียบร้อย",
                        })
                      }
                    >
                      <Send size={13} className="text-brand" />
                      {tt("Publish now", "เผยแพร่ทันที")}
                    </Button>
                  )}
                  <IconAction
                    tone={row.pinned ? "brand" : "muted"}
                    disabled={pending}
                    aria-label={
                      row.pinned
                        ? tt("Unpin", "เลิกปักหมุด")
                        : tt("Pin to the top", "ปักหมุดไว้บนสุด")
                    }
                    onClick={() =>
                      run(() => setAnnouncementPinned(row.id, !row.pinned), {
                        en: row.pinned ? "Unpinned." : "Pinned to the top of the feed.",
                        th: row.pinned ? "เลิกปักหมุดแล้ว" : "ปักหมุดไว้บนสุดของฟีดแล้ว",
                      })
                    }
                  >
                    {row.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                  </IconAction>
                  <IconAction
                    tone="brand"
                    aria-label={`${t("action.edit")} ${row.titleEn}`}
                    onClick={() => openEdit(row)}
                  >
                    <Pencil size={14} />
                  </IconAction>
                  <IconAction
                    tone="danger"
                    aria-label={`${t("action.delete")} ${row.titleEn}`}
                    onClick={() => setConfirm(row)}
                  >
                    <Trash2 size={14} />
                  </IconAction>
                </div>
              </li>
            );
          })}
          {visible.length === 0 ? (
            <li className="p-10 text-center text-sm text-muted">
              {rows.length === 0
                ? tt("No announcements yet.", "ยังไม่มีประกาศ")
                : t("admin.noMatch")}
            </li>
          ) : null}
        </ul>
      </Card>

      {/* --------------------------------------------- notification rules */}
      <Card className="mt-5">
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
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="flex flex-wrap items-center gap-3 border-b border-line/60 px-5 py-4 last:border-0"
            >
              <span className="min-w-[180px] flex-1 text-sm font-medium text-ink">
                {lang === "th" ? rule.nameTh : rule.nameEn}
              </span>
              <Pill tone="brand">{channelLabel(rule.channel, lang)}</Pill>
              <Pill tone={rule.enabled ? "success" : "neutral"}>
                {rule.enabled ? t("status.active") : t("status.inactive")}
              </Pill>
            </li>
          ))}
          {rules.length === 0 ? (
            <li className="px-5 py-8 text-center text-xs text-muted">
              {tt("No rules configured.", "ยังไม่มีการตั้งกฎการแจ้งเตือน")}
            </li>
          ) : null}
        </ul>
        <div className="p-5 pt-0">
          <Note>
            {tt(
              "Automatic reminders the system sends on its own. They are set up by the system team; to reach people yourself, publish an announcement above.",
              "การแจ้งเตือนอัตโนมัติที่ระบบส่งเอง ตั้งค่าโดยทีมดูแลระบบ หากต้องการแจ้งพนักงานเอง ให้เผยแพร่ประกาศด้านบน",
            )}
          </Note>
        </div>
      </Card>

      {/* ------------------------------------------------- create / edit */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          draft.id
            ? tt("Edit Announcement", "แก้ไขประกาศ")
            : tt("Create New Announcement", "สร้างประกาศใหม่")
        }
        subtitle={
          step === 1
            ? tt("Step 1 of 2 · Content and audience", "ขั้นที่ 1 จาก 2 · เนื้อหาและกลุ่มผู้รับ")
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
              <Button variant="outline" onClick={() => setStep(1)} disabled={pending}>
                {t("action.back")}
              </Button>
              <Button onClick={save} disabled={pending}>
                {draft.id
                  ? t("action.saveChanges")
                  : draft.publishNow
                    ? tt("Publish & notify", "เผยแพร่และแจ้งเตือน")
                    : tt("Schedule", "ตั้งเวลา")}
              </Button>
            </>
          )
        }
      >
        {feedback ? (
          <div
            role="status"
            className={cn(
              "mb-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
              feedback.tone === "ok"
                ? "border-success/40 bg-success/10 text-success"
                : "border-accent/40 bg-accent/10 text-accent",
            )}
          >
            {feedback.tone === "ok" ? (
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
            )}
            <span>{lang === "th" ? feedback.th : feedback.en}</span>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-4">
            <Field label={`${t("label.title")} (EN) *`}>
              <Input
                value={draft.titleEn}
                placeholder={tt("Enter announcement title", "กรอกหัวข้อประกาศ")}
                onChange={(e) => set("titleEn", e.target.value)}
              />
            </Field>
            <Field
              label={`${t("label.title")} (TH)`}
              hint={tt(
                "Optional — Thai readers fall back to the English title.",
                "ไม่บังคับ — หากเว้นว่างจะแสดงหัวข้อภาษาอังกฤษแทน",
              )}
            >
              <Input
                value={draft.titleTh}
                placeholder={tt("Thai title", "หัวข้อภาษาไทย")}
                onChange={(e) => set("titleTh", e.target.value)}
              />
            </Field>
            <Field label={`${tt("Message", "ข้อความ")} (EN) *`}>
              <Textarea
                value={draft.bodyEn}
                placeholder={tt("Enter announcement message", "กรอกเนื้อหาประกาศ")}
                onChange={(e) => set("bodyEn", e.target.value)}
              />
            </Field>
            <Field
              label={`${tt("Message", "ข้อความ")} (TH)`}
              hint={tt(
                "Optional — falls back to the English message.",
                "ไม่บังคับ — หากเว้นว่างจะแสดงข้อความภาษาอังกฤษแทน",
              )}
            >
              <Textarea
                value={draft.bodyTh}
                placeholder={tt("Thai message", "เนื้อหาภาษาไทย")}
                onChange={(e) => set("bodyTh", e.target.value)}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("label.audience")}>
                <Select
                  value={draft.audience}
                  onChange={(e) => {
                    set("audience", e.target.value as Audience);
                    set("audienceRef", "");
                  }}
                >
                  {AUDIENCES.map((a) => (
                    <option key={a} value={a}>
                      {audienceKindLabel(a, lang)}
                    </option>
                  ))}
                </Select>
              </Field>
              {draft.audience !== "ALL" ? (
                <Field
                  label={tt("Send to", "ส่งถึง")}
                  hint={tt(
                    "Only these people will see it in their feed.",
                    "เฉพาะกลุ่มนี้เท่านั้นที่จะเห็นประกาศในฟีด",
                  )}
                >
                  <Select
                    value={draft.audienceRef}
                    onChange={(e) => set("audienceRef", e.target.value)}
                  >
                    <option value="">{tt("Choose...", "เลือก...")}</option>
                    {targets.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <div className="flex items-end">
                  <Note className="w-full">
                    {tt(
                      "Every active employee receives this.",
                      "พนักงานที่ยังทำงานอยู่ทุกคนจะได้รับประกาศนี้",
                    )}
                  </Note>
                </div>
              )}
            </div>

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
                    {channelLabel(c, lang)}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={draft.pinned}
                onChange={(e) => set("pinned", e.target.checked)}
                className="accent-[#006bff]"
              />
              {tt("Pin to the top of the feed", "ปักหมุดไว้บนสุดของฟีด")}
            </label>
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
                  { value: false, label: tt("Schedule for later", "ตั้งเวลาเผยแพร่") },
                ].map((opt) => (
                  <label
                    key={String(opt.value)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm max-lg:min-h-11",
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
              <Field
                label={tt("Publish date and time", "วันและเวลาที่เผยแพร่")}
                hint={tt(
                  "It stays a draft until it is published — nobody is notified in the meantime.",
                  "จะยังเป็นฉบับร่างจนกว่าจะกดเผยแพร่ และจะไม่มีการแจ้งเตือนใครในระหว่างนี้",
                )}
              >
                <Input
                  type="datetime-local"
                  value={draft.publishAt}
                  onChange={(e) => set("publishAt", e.target.value)}
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
                    <Megaphone size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">
                      {pick(lang, draft.titleEn, draft.titleTh) ||
                        tt("Announcement title", "หัวข้อประกาศ")}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-xs text-muted">
                      {pick(lang, draft.bodyEn, draft.bodyTh) ||
                        tt("Your message will appear here.", "ข้อความของคุณจะแสดงที่นี่")}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Pill tone={draft.publishNow ? "success" : "warn"}>
                        {draft.publishNow ? t("status.published") : t("status.scheduled")}
                      </Pill>
                      <Pill tone="brand">{channelLabel(draft.channel, lang)}</Pill>
                      <Pill>{previewAudience}</Pill>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Note>
              {draft.publishNow
                ? tt(
                    "Publishing writes one notification for every person in the audience, deep-linked to the announcement, and records the action in the activity log.",
                    "การเผยแพร่จะสร้างการแจ้งเตือนให้ผู้รับทุกคนพร้อมลิงก์ไปยังประกาศ และบันทึกลงบันทึกกิจกรรม",
                  )
                : tt(
                    "A scheduled announcement stays a draft until its publish time, then goes out and notifies its audience on its own. You can still publish it early.",
                    "ประกาศที่ตั้งเวลาไว้จะเป็นฉบับร่างจนถึงเวลาเผยแพร่ แล้วจะเผยแพร่และแจ้งเตือนผู้รับเอง หรือกดเผยแพร่ก่อนเวลาก็ได้",
                  )}
            </Note>
          </div>
        )}
      </Modal>

      {/* ------------------------------------------------------- delete */}
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
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => {
                const row = confirm;
                if (!row) return;
                run(
                  () => deleteAnnouncement(row.id),
                  { en: "Announcement deleted.", th: "ลบประกาศแล้ว" },
                  () => setConfirm(null),
                );
              }}
            >
              {t("action.delete")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {tt("Delete", "ลบ")}{" "}
          <span className="font-medium text-ink">
            {confirm ? pick(lang, confirm.titleEn, confirm.titleTh) : ""}
          </span>
          ?{" "}
          {tt(
            "It disappears from every employee feed. Notifications that were already delivered stay, because they really were sent.",
            "ประกาศจะหายไปจากฟีดของพนักงานทุกคน ส่วนการแจ้งเตือนที่ส่งไปแล้วจะยังคงอยู่ เพราะเป็นสิ่งที่เกิดขึ้นจริง",
          )}
        </p>
      </Modal>
    </div>
  );
}
