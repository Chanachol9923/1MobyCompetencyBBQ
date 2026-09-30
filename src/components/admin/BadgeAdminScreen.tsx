"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Award,
  Crown,
  Medal,
  Pencil,
  Plus,
  Route,
  Star,
  Trash2,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
  Zap,
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
  CountTile,
  IconAction,
  SearchInput,
  Toggle,
  formatDateTime,
} from "@/components/admin/shared";
import { ResultBanner } from "@/components/admin/rbac-shared";
import type {
  ActionResult,
  AdminBadgeRow,
  BadgeAdminData,
} from "@/components/admin/content-types";
import {
  createBadge,
  deleteBadge,
  grantBadge,
  revokeBadge,
  setBadgeActive,
  updateBadge,
} from "@/server/admin-content";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const BADGE_ICON: Record<string, typeof Trophy> = {
  courses: Star,
  certificates: Award,
  assessments: Medal,
  paths: Route,
  manual: Crown,
};

const SOURCES = [
  { value: "manual", en: "Granted by hand", th: "มอบด้วยตนเอง" },
  { value: "courses", en: "Courses completed", th: "จำนวนหลักสูตรที่เรียนจบ" },
  { value: "certificates", en: "Certificates earned", th: "จำนวนใบรับรองที่ได้รับ" },
  { value: "assessments", en: "Self assessments submitted", th: "จำนวนการประเมินตนเองที่ส่ง" },
  { value: "paths", en: "Learning paths finished", th: "จำนวนเส้นทางการเรียนรู้ที่จบ" },
] as const;

type SourceKey = (typeof SOURCES)[number]["value"];

const TONES = [
  { value: "from-[#8fc0ff] to-[#ffd9a8]", en: "Sunrise", th: "อรุณ" },
  { value: "from-[#7aa7ff] to-[#f0b27a]", en: "Amber", th: "อำพัน" },
  { value: "from-[#5b9bff] to-[#9ad0ff]", en: "Sky", th: "ฟ้า" },
  { value: "from-[#6fb1ff] to-[#c9e2ff]", en: "Ice", th: "น้ำแข็ง" },
  { value: "from-[#e6e6e6] to-[#f2f2f2]", en: "Slate", th: "เทา" },
] as const;

type Draft = {
  nameEn: string;
  nameTh: string;
  requirementEn: string;
  requirementTh: string;
  points: string;
  source: SourceKey;
  target: string;
  tone: string;
};

const emptyDraft = (): Draft => ({
  nameEn: "",
  nameTh: "",
  requirementEn: "",
  requirementTh: "",
  points: "100",
  source: "manual",
  target: "1",
  tone: TONES[0].value,
});

/**
 * Badge administration.
 *
 * A badge is either *granted by hand* or *measured*. A measured badge names a
 * counter and a target and unlocks itself the moment the person's real figures
 * reach it — this screen cannot grant one of those, because nothing here should
 * be able to fake a course somebody has not finished. Granting a badge that
 * carries points also moves the points, in the same transaction.
 */
export function BadgeAdminScreen({ data }: { data: BadgeAdminData }) {
  const { t, tt, lang } = useT();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminBadgeRow | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [holders, setHolders] = useState<AdminBadgeRow | null>(null);
  const [grantTo, setGrantTo] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<AdminBadgeRow | null>(null);
  const [busy, startTransition] = useTransition();

  const { badges, employees, counts } = data;

  const name = (b: { nameEn: string; nameTh: string | null }) =>
    lang === "th" ? (b.nameTh ?? b.nameEn) : b.nameEn;

  const requirement = (b: AdminBadgeRow) =>
    (lang === "th" ? (b.requirementTh ?? b.requirementEn) : b.requirementEn) ?? "";

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return badges;
    return badges.filter((b) =>
      `${b.nameEn} ${b.nameTh ?? ""} ${b.requirementEn ?? ""} ${b.key}`
        .toLowerCase()
        .includes(q),
    );
  }, [badges, query]);

  // the live badge row behind the holders modal, so it refreshes after a grant
  const holdersRow = holders
    ? (badges.find((b) => b.id === holders.id) ?? holders)
    : null;

  const grantable = useMemo(() => {
    if (!holdersRow) return employees;
    const taken = new Set(holdersRow.holders.map((h) => h.employeeId));
    return employees.filter((e) => !taken.has(e.id));
  }, [employees, holdersRow]);

  function run(fn: () => Promise<ActionResult>) {
    startTransition(async () => setResult(await fn()));
  }

  // a form stays open until its save succeeds, so a refusal never costs the
  // administrator what they typed
  const [formError, setFormError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) setFormError(null);
  }, [open]);
  function runForm(fn: () => Promise<ActionResult>) {
    setFormError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setOpen(false);
        setResult(res);
      } else {
        setFormError(tt(res.error.en, res.error.th));
      }
    });
  }

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function openAdd() {
    setDraft(emptyDraft());
    setEditing(null);
    setOpen(true);
  }

  function openEdit(b: AdminBadgeRow) {
    setDraft({
      nameEn: b.nameEn,
      nameTh: b.nameTh ?? "",
      requirementEn: b.requirementEn ?? "",
      requirementTh: b.requirementTh ?? "",
      points: String(b.points),
      source: (SOURCES.find((s) => s.value === b.source)?.value ??
        "manual") as SourceKey,
      target: String(b.target ?? 1),
      tone: b.tone ?? TONES[0].value,
    });
    setEditing(b);
    setOpen(true);
  }

  function save() {
    const payload = {
      nameEn: draft.nameEn,
      nameTh: draft.nameTh,
      requirementEn: draft.requirementEn,
      requirementTh: draft.requirementTh,
      points: draft.points,
      tone: draft.tone,
      source: draft.source,
      target: draft.source === "manual" ? undefined : draft.target,
    };
    const target = editing;
    runForm(() =>
      target ? updateBadge({ ...payload, badgeId: target.id }) : createBadge(payload),
    );
  }

  const sourceLabel = (value: string) => {
    const s = SOURCES.find((x) => x.value === value);
    return s ? tt(s.en, s.th) : value;
  };

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading
        title={tt("Achievements Management", "จัดการความสำเร็จ")}
        subtitle={tt(
          "Badges, what earns them, and who holds each one.",
          "เหรียญตรา เงื่อนไขการได้รับ และรายชื่อผู้ถือครอง",
        )}
      />

      <ResultBanner result={result} onDismiss={() => setResult(null)} />

      <div className="grid gap-4 sm:grid-cols-3">
        <CountTile
          value={counts.total}
          label={tt("Total badges", "เหรียญตราทั้งหมด")}
          icon={<Trophy size={20} />}
        />
        <CountTile
          value={counts.active}
          label={t("status.active")}
          tone="success"
          icon={<Zap size={20} />}
        />
        <CountTile
          value={counts.awarded}
          label={tt("Badges held by staff", "เหรียญที่พนักงานถือครอง")}
          tone="amber"
          icon={<Users size={20} />}
        />
      </div>

      <Card className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h3 className="text-2xl font-bold text-ink">
              {tt("All Achievements", "ความสำเร็จทั้งหมด")}
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              {tt(
                "A measured badge unlocks itself from the employee's real figures. A manual badge is granted here.",
                "เหรียญแบบวัดผลจะปลดล็อกอัตโนมัติจากตัวเลขจริงของพนักงาน ส่วนเหรียญแบบมอบเองจะมอบจากหน้านี้",
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder={tt("Search achievements...", "ค้นหาความสำเร็จ...")}
              className="w-full sm:w-56"
            />
            <Button size="sm" onClick={openAdd}>
              <Plus size={15} />
              {tt("Add Achievement", "เพิ่มความสำเร็จ")}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 border-t border-line/70 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((b) => {
            const Icon = BADGE_ICON[b.source] ?? Trophy;
            return (
              <div
                key={b.id}
                className={cn(
                  "flex flex-col rounded-xl border border-line/70 p-4 transition-opacity",
                  !b.active && "opacity-60",
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white",
                      b.tone ?? "from-[#e6e6e6] to-[#f2f2f2]",
                    )}
                  >
                    <Icon size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{name(b)}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                      {requirement(b)}
                    </p>
                  </div>
                  <Pill tone={b.active ? "success" : "neutral"}>
                    {b.active ? t("status.active") : t("status.inactive")}
                  </Pill>
                </div>

                <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-[11px] leading-relaxed text-muted">
                  {b.source === "manual"
                    ? tt(
                        "Granted by an administrator.",
                        "มอบโดยผู้ดูแลระบบ",
                      )
                    : tt(
                        `Unlocks at ${b.target} · ${sourceLabel(b.source)}`,
                        `ปลดล็อกเมื่อครบ ${b.target} · ${sourceLabel(b.source)}`,
                      )}
                </p>

                <div className="mt-3 flex items-center gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted">
                      {t("label.points")}
                    </p>
                    <p className="text-sm font-bold text-brand">+ {b.points}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setHolders(b);
                      setGrantTo("");
                    }}
                    className="text-left transition-colors hover:text-brand"
                  >
                    <p className="text-[10px] uppercase tracking-wide text-muted">
                      {tt("Unlocked by", "ผู้ที่ปลดล็อกแล้ว")}
                    </p>
                    <p className="text-sm font-bold text-ink underline decoration-dotted underline-offset-2">
                      {b.holderCount}
                    </p>
                  </button>
                  <div className="ml-auto flex items-center gap-2">
                    <Toggle
                      checked={b.active}
                      disabled={busy}
                      label={`${tt("Toggle", "สลับ")} ${b.nameEn}`}
                      onChange={(next) =>
                        run(() => setBadgeActive({ badgeId: b.id, active: next }))
                      }
                    />
                    <IconAction
                      tone="brand"
                      aria-label={`${t("action.edit")} ${b.nameEn}`}
                      onClick={() => openEdit(b)}
                    >
                      <Pencil size={14} />
                    </IconAction>
                    <IconAction
                      tone="danger"
                      aria-label={`${t("action.delete")} ${b.nameEn}`}
                      onClick={() => setConfirmDelete(b)}
                    >
                      <Trash2 size={14} />
                    </IconAction>
                  </div>
                </div>
              </div>
            );
          })}
          {visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted sm:col-span-2 xl:col-span-3">
              {t("admin.noMatch")}
            </p>
          ) : null}
        </div>
      </Card>

      {/* ------------------------------------------------- create / edit */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          editing
            ? tt("Edit Achievement", "แก้ไขความสำเร็จ")
            : tt("Add New Achievement", "เพิ่มความสำเร็จใหม่")
        }
        width="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("action.cancel")}
            </Button>
            <Button onClick={save} disabled={busy}>
              {editing ? t("action.saveChanges") : t("action.save")}
            </Button>
          </>
        }
      >
        {formError ? (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-ink"
          >
            {formError}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`${tt("Title (English)", "ชื่อ (อังกฤษ)")} *`}>
            <Input
              value={draft.nameEn}
              placeholder={tt("Enter Achievement Title", "กรอกชื่อความสำเร็จ")}
              onChange={(e) => set("nameEn", e.target.value)}
            />
          </Field>
          <Field label={tt("Title (Thai)", "ชื่อ (ไทย)")}>
            <Input
              value={draft.nameTh}
              placeholder={tt("Optional", "ไม่บังคับ")}
              onChange={(e) => set("nameTh", e.target.value)}
            />
          </Field>
          <Field label={tt("What earns it (English)", "เงื่อนไขการได้รับ (อังกฤษ)")}>
            <Textarea
              value={draft.requirementEn}
              placeholder={tt("Complete 5 courses", "เรียนจบ 5 หลักสูตร")}
              onChange={(e) => set("requirementEn", e.target.value)}
            />
          </Field>
          <Field label={tt("What earns it (Thai)", "เงื่อนไขการได้รับ (ไทย)")}>
            <Textarea
              value={draft.requirementTh}
              placeholder={tt("Optional", "ไม่บังคับ")}
              onChange={(e) => set("requirementTh", e.target.value)}
            />
          </Field>
          <Field
            label={tt("Measured from", "วัดผลจาก")}
            hint={tt(
              "A measured badge unlocks itself; it cannot be granted by hand.",
              "เหรียญแบบวัดผลจะปลดล็อกเอง ไม่สามารถมอบด้วยตนเองได้",
            )}
          >
            <Select
              value={draft.source}
              onChange={(e) => set("source", e.target.value as SourceKey)}
            >
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {tt(s.en, s.th)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={tt("Target", "เป้าหมาย")}>
            <Input
              type="number"
              min={1}
              value={draft.target}
              disabled={draft.source === "manual"}
              onChange={(e) => set("target", e.target.value)}
            />
          </Field>
          <Field
            label={t("label.points")}
            hint={tt(
              "Awarded on the ledger when the badge is granted.",
              "จะบันทึกลงบัญชีคะแนนเมื่อมีการมอบเหรียญ",
            )}
          >
            <Input
              type="number"
              min={0}
              value={draft.points}
              onChange={(e) => set("points", e.target.value)}
            />
          </Field>
          <Field label={tt("Colour", "สี")}>
            <Select value={draft.tone} onChange={(e) => set("tone", e.target.value)}>
              {TONES.map((tone) => (
                <option key={tone.value} value={tone.value}>
                  {tt(tone.en, tone.th)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>

      {/* ------------------------------------------------------- holders */}
      <Modal
        open={Boolean(holdersRow)}
        onClose={() => setHolders(null)}
        title={holdersRow ? name(holdersRow) : ""}
        subtitle={
          holdersRow
            ? tt(
                `${holdersRow.holderCount} holder(s) · ${sourceLabel(holdersRow.source)}`,
                `ผู้ถือครอง ${holdersRow.holderCount} คน · ${sourceLabel(holdersRow.source)}`,
              )
            : undefined
        }
        width="max-w-2xl"
        footer={
          <Button variant="outline" onClick={() => setHolders(null)}>
            {tt("Close", "ปิด")}
          </Button>
        }
      >
        {holdersRow ? (
          <div className="space-y-4">
            {holdersRow.source === "manual" ? (
              <div className="flex flex-wrap items-end gap-3 rounded-xl bg-surface p-3">
                <Field
                  label={tt("Grant to", "มอบให้")}
                  className="min-w-[200px] flex-1"
                >
                  <Select value={grantTo} onChange={(e) => setGrantTo(e.target.value)}>
                    <option value="">
                      {tt("Select an employee", "เลือกพนักงาน")}
                    </option>
                    {grantable.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} · {e.employeeCode}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button
                  size="sm"
                  disabled={!grantTo || busy}
                  onClick={() => {
                    const employeeId = grantTo;
                    setGrantTo("");
                    run(() => grantBadge({ badgeId: holdersRow.id, employeeId }));
                  }}
                >
                  <UserPlus size={15} />
                  {tt("Grant badge", "มอบเหรียญ")}
                </Button>
              </div>
            ) : (
              <p className="rounded-xl bg-surface px-3 py-2 text-xs leading-relaxed text-muted">
                {tt(
                  `This badge is measured, not granted: it appears the moment someone reaches ${holdersRow.target} · ${sourceLabel(holdersRow.source).toLowerCase()}. Switch it to "granted by hand" if it should be awarded manually.`,
                  `เหรียญนี้เป็นแบบวัดผล ไม่ได้มอบด้วยตนเอง จะปรากฏทันทีที่พนักงานทำได้ครบ ${holdersRow.target} (${sourceLabel(holdersRow.source)}) หากต้องการมอบเอง ให้เปลี่ยนเป็นแบบ "มอบด้วยตนเอง"`,
                )}
              </p>
            )}

            {holdersRow.holders.length ? (
              <ul className="divide-y divide-line/60">
                {holdersRow.holders.map((h) => (
                  <li
                    key={h.employeeId}
                    className="flex items-center gap-3 py-2.5 text-sm"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">
                        {h.name}
                      </span>
                      <span className="block text-[11px] text-muted">
                        {h.employeeCode} · {formatDateTime(h.earnedAt)}
                      </span>
                    </span>
                    <IconAction
                      tone="danger"
                      disabled={busy}
                      aria-label={tt(
                        `Withdraw from ${h.name}`,
                        `ถอนเหรียญจาก ${h.name}`,
                      )}
                      onClick={() =>
                        run(() =>
                          revokeBadge({
                            badgeId: holdersRow.id,
                            employeeId: h.employeeId,
                          }),
                        )
                      }
                    >
                      <UserMinus size={14} />
                    </IconAction>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted">
                {tt("Nobody holds this badge yet.", "ยังไม่มีใครได้รับเหรียญนี้")}
              </p>
            )}
          </div>
        ) : null}
      </Modal>

      {/* -------------------------------------------------------- delete */}
      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title={tt("Delete achievement", "ลบความสำเร็จ")}
        width="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              {t("action.cancel")}
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                const target = confirmDelete;
                setConfirmDelete(null);
                if (target) run(() => deleteBadge({ badgeId: target.id }));
              }}
            >
              {t("action.delete")}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          {tt("Delete", "ลบ")}{" "}
          <span className="font-medium text-ink">
            {confirmDelete ? name(confirmDelete) : ""}
          </span>
          ?{" "}
          {tt(
            "A badge somebody already holds cannot be deleted — deactivate it instead and they keep what they earned.",
            "เหรียญที่มีผู้ถือครองอยู่แล้วจะลบไม่ได้ กรุณาปิดใช้งานแทน เพื่อให้พวกเขายังคงเหรียญที่ได้รับไว้",
          )}
        </p>
      </Modal>
    </div>
  );
}
