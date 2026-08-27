"use client";

import { useMemo, useState } from "react";
import {
  Award,
  Flame,
  Pencil,
  Plus,
  Rocket,
  Star,
  Target,
  Trash2,
  Trophy,
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
  AdminOnly,
  CountTile,
  IconAction,
  SearchInput,
} from "@/components/admin/shared";
import type { Achievement } from "@/data/learning";
import { useDemo } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { cn, formatNumber } from "@/lib/utils";

export default function ManageAchievementsPage() {
  return (
    <AdminOnly>
      <ManageAchievements />
    </AdminOnly>
  );
}

const ICONS = {
  trophy: Trophy,
  award: Award,
  star: Star,
  zap: Zap,
  target: Target,
  flame: Flame,
  rocket: Rocket,
} as const;

type IconKey = keyof typeof ICONS;
const ICON_KEYS = Object.keys(ICONS) as IconKey[];

type Draft = {
  name: string;
  description: string;
  criteria: string;
  points: string;
  icon: IconKey;
};

const emptyDraft = (): Draft => ({
  name: "",
  description: "",
  criteria: "",
  points: "100",
  icon: "trophy",
});

function ManageAchievements() {
  const { state, update, notify, logActivity } = useDemo();
  const { t, tt } = useT();
  const [query, setQuery] = useState("");
  const [icons, setIcons] = useState<Record<string, IconKey>>(() => {
    const map: Record<string, IconKey> = {};
    state.achievements.forEach((a, i) => {
      map[a.id] = ICON_KEYS[i % ICON_KEYS.length]!;
    });
    return map;
  });
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [confirm, setConfirm] = useState<Achievement | null>(null);

  const list = state.achievements;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.criteria.toLowerCase().includes(q),
    );
  }, [list, query]);

  const active = list.filter((a) => a.active).length;
  const holders = list.reduce((sum, a) => sum + a.holders, 0);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function openAdd() {
    setDraft(emptyDraft());
    setEditingId(null);
    setOpen(true);
  }

  function openEdit(a: Achievement) {
    setDraft({
      name: a.name,
      description: a.description,
      criteria: a.criteria,
      points: String(a.points),
      icon: icons[a.id] ?? "trophy",
    });
    setEditingId(a.id);
    setOpen(true);
  }

  function save() {
    if (!draft.name.trim()) {
      notify(tt("Achievement title is required", "กรุณากรอกชื่อความสำเร็จ"));
      return;
    }
    if (editingId) {
      const id = editingId;
      update((s) => ({
        ...s,
        achievements: s.achievements.map((a) =>
          a.id === id
            ? {
                ...a,
                name: draft.name.trim(),
                description: draft.description.trim(),
                criteria: draft.criteria.trim(),
                points: Number(draft.points) || 0,
              }
            : a,
        ),
      }));
      setIcons((m) => ({ ...m, [id]: draft.icon }));
      logActivity("Updated achievement", draft.name.trim());
      notify(
        tt(
          `“${draft.name.trim()}” updated`,
          `อัปเดต “${draft.name.trim()}” แล้ว`,
        ),
      );
    } else {
      const id = `ach-${Date.now()}`;
      const achievement: Achievement = {
        id,
        name: draft.name.trim(),
        description: draft.description.trim(),
        criteria: draft.criteria.trim(),
        points: Number(draft.points) || 0,
        holders: 0,
        active: true,
      };
      update((s) => ({ ...s, achievements: [...s.achievements, achievement] }));
      setIcons((m) => ({ ...m, [id]: draft.icon }));
      logActivity("Added achievement", achievement.name, `+${achievement.points}`);
      notify(
        tt(
          `Achievement “${achievement.name}” added`,
          `เพิ่มความสำเร็จ “${achievement.name}” แล้ว`,
        ),
      );
    }
    setOpen(false);
  }

  function toggleActive(a: Achievement) {
    update((s) => ({
      ...s,
      achievements: s.achievements.map((x) =>
        x.id === a.id ? { ...x, active: !x.active } : x,
      ),
    }));
    logActivity(
      a.active ? "Deactivated achievement" : "Activated achievement",
      a.name,
    );
    notify(
      tt(
        `“${a.name}” ${a.active ? "deactivated" : "activated"}`,
        `${a.active ? "ปิด" : "เปิด"}ใช้งาน “${a.name}” แล้ว`,
      ),
    );
  }

  function remove(a: Achievement) {
    update((s) => ({
      ...s,
      achievements: s.achievements.filter((x) => x.id !== a.id),
    }));
    logActivity("Deleted achievement", a.name);
    notify(tt(`“${a.name}” deleted`, `ลบ “${a.name}” แล้ว`));
    setConfirm(null);
  }

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading title={tt("Achievements Management", "จัดการความสำเร็จ")} />

      <div className="grid gap-4 sm:grid-cols-3">
        <CountTile
          value={list.length}
          label={tt("Total Achievements", "ความสำเร็จทั้งหมด")}
          icon={<Trophy size={20} />}
        />
        <CountTile
          value={active}
          label={t("status.active")}
          tone="success"
          icon={<Zap size={20} />}
        />
        <CountTile
          value={formatNumber(holders)}
          label={tt("Badges held", "เหรียญที่มอบแล้ว")}
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
                "Manage achievement badges, conditions, and rewards",
                "จัดการเหรียญตรา เงื่อนไข และคะแนนที่ได้รับ",
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
          {visible.map((a) => {
            const Icon = ICONS[icons[a.id] ?? "trophy"];
            return (
              <div
                key={a.id}
                className={cn(
                  "rounded-xl border border-line/70 p-4 transition-opacity",
                  !a.active && "opacity-60",
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber/15 text-amber">
                    <Icon size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{a.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                      {a.description}
                    </p>
                  </div>
                  <Pill tone={a.active ? "success" : "neutral"}>
                    {a.active ? t("status.active") : t("status.inactive")}
                  </Pill>
                </div>

                <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-[11px] text-muted">
                  {tt("Tip", "เคล็ดลับ")}: {a.criteria}
                </p>

                <div className="mt-3 flex items-center gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted">
                      {t("label.points")}
                    </p>
                    <p className="text-sm font-bold text-brand">+ {a.points}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted">
                      {tt("Unlocked by", "ผู้ที่ปลดล็อกแล้ว")}
                    </p>
                    <p className="text-sm font-bold text-ink">{a.holders}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={a.active}
                      aria-label={`${tt("Toggle", "สลับ")} ${a.name}`}
                      onClick={() => toggleActive(a)}
                      className={cn(
                        "relative h-5 w-9 rounded-full transition-colors",
                        a.active ? "bg-success" : "bg-line-2",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 size-4 rounded-full bg-white transition-all",
                          a.active ? "left-[18px]" : "left-0.5",
                        )}
                      />
                    </button>
                    <IconAction
                      tone="brand"
                      aria-label={`${t("action.edit")} ${a.name}`}
                      onClick={() => openEdit(a)}
                    >
                      <Pencil size={14} />
                    </IconAction>
                    <IconAction
                      tone="danger"
                      aria-label={`${t("action.delete")} ${a.name}`}
                      onClick={() => setConfirm(a)}
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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          editingId
            ? tt("Edit Achievement", "แก้ไขความสำเร็จ")
            : tt("Add New Achievement", "เพิ่มความสำเร็จใหม่")
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("action.cancel")}
            </Button>
            <Button onClick={save}>
              {editingId ? t("action.saveChanges") : t("action.save")}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label={`${tt("Achievement Title", "ชื่อความสำเร็จ")} *`}>
            <Input
              value={draft.name}
              placeholder={tt("Enter Achievement Title", "กรอกชื่อความสำเร็จ")}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <Field label={`${t("label.description")} *`}>
            <Textarea
              value={draft.description}
              placeholder={tt("Enter Achievement Description", "กรอกคำอธิบาย")}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
          <Field label={`${tt("Tips / criteria", "เคล็ดลับ / เกณฑ์")} *`}>
            <Input
              value={draft.criteria}
              placeholder={tt("Enter This Achievement Tips", "กรอกเคล็ดลับของความสำเร็จนี้")}
              onChange={(e) => set("criteria", e.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("label.points")}>
              <Input
                type="number"
                min={0}
                value={draft.points}
                onChange={(e) => set("points", e.target.value)}
              />
            </Field>
            <Field label={tt("Icon", "ไอคอน")}>
              <Select
                value={draft.icon}
                onChange={(e) => set("icon", e.target.value as IconKey)}
              >
                {ICON_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {k[0]!.toUpperCase() + k.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-surface p-3">
            {(() => {
              const Preview = ICONS[draft.icon];
              return (
                <span className="grid size-10 place-items-center rounded-xl bg-amber/15 text-amber">
                  <Preview size={20} />
                </span>
              );
            })()}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">
                {draft.name || tt("Achievement title", "ชื่อความสำเร็จ")}
              </p>
              <p className="truncate text-xs text-muted">
                {tt(
                  `+ ${Number(draft.points) || 0} points`,
                  `+ ${Number(draft.points) || 0} คะแนน`,
                )}
              </p>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={tt("Delete achievement", "ลบความสำเร็จ")}
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
          <span className="font-medium text-ink">{confirm?.name}</span>?{" "}
          {tt(
            `Its ${confirm?.holders ?? 0} holders keep the points already awarded.`,
            `ผู้ถือครอง ${confirm?.holders ?? 0} คนจะยังคงคะแนนที่ได้รับไปแล้ว`,
          )}
        </p>
      </Modal>
    </div>
  );
}
