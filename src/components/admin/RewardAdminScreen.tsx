"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Check,
  Coffee,
  CupSoda,
  Eye,
  EyeOff,
  Gem,
  Gift,
  Minus,
  Package,
  Pencil,
  Plus,
  Shirt,
  Trash2,
  TrendingUp,
  Undo2,
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
  Tabs,
} from "@/components/ui";
import {
  CountTile,
  IconAction,
  SearchInput,
  TableWrap,
  Td,
  Th,
  coverStyle,
  formatDateTime,
} from "@/components/admin/shared";
import { ResultBanner } from "@/components/admin/rbac-shared";
import type {
  ActionResult,
  AdminRewardRow,
  RewardAdminData,
} from "@/components/admin/content-types";
import {
  adjustRewardStock,
  createReward,
  deleteReward,
  setRedemptionStatus,
  setRewardActive,
  updateReward,
} from "@/server/admin-content";
import { useT } from "@/lib/i18n";
import { formatNumber } from "@/lib/utils";

/**
 * The four presets carry the gradient and the icon slug together, because the
 * employee-facing catalogue reads `image` for the icon and `tone` for the card
 * header. Picking "Voucher" here is what makes a coffee cup show up there.
 */
const PRESETS = [
  {
    key: "voucher",
    en: "Voucher",
    th: "บัตรกำนัล",
    tone: "from-[#0b6b3a] to-[#00b916]",
    icon: Coffee,
  },
  {
    key: "gold",
    en: "Premium",
    th: "ของรางวัลพิเศษ",
    tone: "from-[#faa21b] to-[#f7d488]",
    icon: Gem,
  },
  {
    key: "tshirt",
    en: "Merchandise",
    th: "ของที่ระลึก",
    tone: "from-[#006bff] to-[#0061c8]",
    icon: Shirt,
  },
  {
    key: "tumbler",
    en: "Experience",
    th: "ประสบการณ์",
    tone: "from-[#9fd8dd] to-[#dff2f4]",
    icon: CupSoda,
  },
] as const;

type PresetKey = (typeof PRESETS)[number]["key"];

const presetFor = (image: string | null): (typeof PRESETS)[number] =>
  PRESETS.find((p) => p.key === image) ?? PRESETS[0];

type Draft = {
  nameEn: string;
  nameTh: string;
  points: string;
  stock: string;
  preset: PresetKey;
};

const emptyDraft = (): Draft => ({
  nameEn: "",
  nameTh: "",
  points: "500",
  stock: "10",
  preset: "voucher",
});

function stockTone(stock: number, active: boolean) {
  if (!active) return { key: "off", tone: "neutral" as const };
  if (stock <= 0) return { key: "out", tone: "danger" as const };
  if (stock <= 5) return { key: "low", tone: "warn" as const };
  return { key: "in", tone: "success" as const };
}

/**
 * The reward catalogue and the fulfilment queue.
 *
 * Stock is a column, not a number this screen holds: every +/- is a guarded
 * server action that re-reads the row, and a decrement is refused rather than
 * allowed to go negative. Cancelling a redemption is a refund — points back on
 * the ledger, item back in stock — so it says so before it is clicked.
 */
export function RewardAdminScreen({ data }: { data: RewardAdminData }) {
  const { t, tt, lang } = useT();
  const [tab, setTab] = useState<"catalogue" | "queue">("catalogue");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminRewardRow | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [confirmDelete, setConfirmDelete] = useState<AdminRewardRow | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const { rewards, queue, counts } = data;

  const name = (r: { nameEn: string; nameTh: string | null }) =>
    lang === "th" ? (r.nameTh ?? r.nameEn) : r.nameEn;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rewards;
    return rewards.filter((r) =>
      `${r.nameEn} ${r.nameTh ?? ""} ${r.key}`.toLowerCase().includes(q),
    );
  }, [rewards, query]);

  const pendingQueue = queue.filter((r) => r.status === "PREPARING");

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

  function openEdit(r: AdminRewardRow) {
    setDraft({
      nameEn: r.nameEn,
      nameTh: r.nameTh ?? "",
      points: String(r.points),
      stock: String(r.stock),
      preset: presetFor(r.image).key,
    });
    setEditing(r);
    setOpen(true);
  }

  function save() {
    const preset = PRESETS.find((p) => p.key === draft.preset) ?? PRESETS[0];
    const payload = {
      nameEn: draft.nameEn,
      nameTh: draft.nameTh,
      points: draft.points,
      stock: draft.stock,
      tone: preset.tone,
      image: preset.key,
    };
    const target = editing;
    runForm(() =>
      target
        ? updateReward({ ...payload, rewardId: target.id })
        : createReward(payload),
    );
  }

  const cancelTarget = queue.find((r) => r.id === confirmCancel) ?? null;
  const draftPreset = PRESETS.find((p) => p.key === draft.preset) ?? PRESETS[0];

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading
        title={tt("Manage rewards", "จัดการของรางวัล")}
        subtitle={tt(
          "The catalogue employees redeem against, and the queue of what they have claimed.",
          "รายการของรางวัลที่พนักงานใช้คะแนนแลก และคิวรายการที่รอส่งมอบ",
        )}
      />

      <ResultBanner result={result} onDismiss={() => setResult(null)} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <CountTile
          value={counts.total}
          label={tt("Total rewards", "ของรางวัลทั้งหมด")}
          icon={<Gift size={20} />}
        />
        <CountTile
          value={counts.inStock}
          label={tt("Listed and in stock", "เปิดขายและมีของ")}
          tone="success"
          icon={<Package size={20} />}
        />
        <CountTile
          value={counts.redeemed}
          label={tt("Redeemed", "แลกไปแล้ว")}
          tone="amber"
          icon={<TrendingUp size={20} />}
        />
        <CountTile
          value={formatNumber(counts.pointsSpent)}
          label={tt("Points spent by staff", "คะแนนที่พนักงานใช้ไป")}
          tone="ink"
          icon={<Gem size={20} />}
        />
      </div>

      <div className="mt-6">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            {
              value: "catalogue",
              label: tt(
                `Catalogue (${counts.total})`,
                `รายการของรางวัล (${counts.total})`,
              ),
            },
            {
              value: "queue",
              label: tt(
                `Redemption queue (${counts.preparing})`,
                `คิวรอส่งมอบ (${counts.preparing})`,
              ),
            },
          ]}
        />
      </div>

      {tab === "catalogue" ? (
        <Card className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <h3 className="text-lg font-bold text-ink">
              {tt("Reward catalogue", "รายการของรางวัล")}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder={tt("Search rewards", "ค้นหาของรางวัล")}
                className="w-full sm:w-56"
              />
              <Button size="sm" onClick={openAdd}>
                <Plus size={15} />
                {tt("Add reward", "เพิ่มของรางวัล")}
              </Button>
            </div>
          </div>

          <TableWrap>
            <table className="w-full min-w-[880px] xl:min-w-0 border-collapse">
              <thead>
                <tr className="border-y border-line/70 bg-surface/60">
                  <Th>{tt("Reward", "ของรางวัล")}</Th>
                  <Th>{t("label.points")}</Th>
                  <Th className="w-44">{tt("Stock", "คงเหลือ")}</Th>
                  <Th>{tt("Redeemed", "แลกไปแล้ว")}</Th>
                  <Th>{t("label.status")}</Th>
                  <Th className="text-right">{t("label.actions")}</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const status = stockTone(r.stock, r.active);
                  return (
                    <tr key={r.id} className="border-b border-line/60 last:border-0">
                      <Td>
                        <div className="flex items-center gap-3">
                          <span
                            className="size-9 shrink-0 rounded-lg"
                            style={coverStyle(r.tone ?? "")}
                          />
                          <span className="min-w-0">
                            <span className="block font-bold">{name(r)}</span>
                            <span className="block truncate text-[10px] text-muted">
                              {r.key}
                            </span>
                          </span>
                        </div>
                      </Td>
                      <Td className="font-bold text-brand">
                        {tt(
                          `${formatNumber(r.points)} pts`,
                          `${formatNumber(r.points)} คะแนน`,
                        )}
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <IconAction
                            disabled={busy || r.stock === 0}
                            aria-label={tt(
                              `Decrease ${r.nameEn} stock`,
                              `ลดคงเหลือ ${r.nameEn}`,
                            )}
                            onClick={() =>
                              run(() => adjustRewardStock({ rewardId: r.id, delta: -1 }))
                            }
                          >
                            <Minus size={14} />
                          </IconAction>
                          <span className="w-10 text-center font-bold">{r.stock}</span>
                          <IconAction
                            disabled={busy}
                            aria-label={tt(
                              `Increase ${r.nameEn} stock`,
                              `เพิ่มคงเหลือ ${r.nameEn}`,
                            )}
                            onClick={() =>
                              run(() => adjustRewardStock({ rewardId: r.id, delta: 1 }))
                            }
                          >
                            <Plus size={14} />
                          </IconAction>
                        </div>
                      </Td>
                      <Td className="text-muted">
                        {r.redeemedCount}
                        {r.preparingCount ? (
                          <span className="ml-1 text-[10px] text-amber">
                            {tt(
                              `(${r.preparingCount} waiting)`,
                              `(รอส่ง ${r.preparingCount})`,
                            )}
                          </span>
                        ) : null}
                      </Td>
                      <Td>
                        <Pill tone={status.tone}>
                          {status.key === "off"
                            ? tt("Delisted", "ซ่อนอยู่")
                            : status.key === "out"
                              ? tt("Out of stock", "หมด")
                              : status.key === "low"
                                ? tt("Low stock", "เหลือน้อย")
                                : tt("In stock", "มีสินค้า")}
                        </Pill>
                      </Td>
                      <Td>
                        <div className="flex justify-end gap-2">
                          <IconAction
                            disabled={busy}
                            aria-label={
                              r.active
                                ? tt(`Delist ${r.nameEn}`, `ซ่อน ${r.nameEn}`)
                                : tt(`List ${r.nameEn}`, `แสดง ${r.nameEn}`)
                            }
                            onClick={() =>
                              run(() =>
                                setRewardActive({ rewardId: r.id, active: !r.active }),
                              )
                            }
                          >
                            {r.active ? <EyeOff size={14} /> : <Eye size={14} />}
                          </IconAction>
                          <IconAction
                            tone="brand"
                            aria-label={`${t("action.edit")} ${r.nameEn}`}
                            onClick={() => openEdit(r)}
                          >
                            <Pencil size={14} />
                          </IconAction>
                          <IconAction
                            tone="danger"
                            aria-label={`${t("action.delete")} ${r.nameEn}`}
                            onClick={() => setConfirmDelete(r)}
                          >
                            <Trash2 size={14} />
                          </IconAction>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
                {visible.length === 0 ? (
                  <tr>
                    <Td colSpan={6} className="py-10 text-center text-muted">
                      {t("admin.noMatch")}
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      ) : (
        <Card className="mt-5">
          <CardHeader
            title={tt("Redemption requests", "คำขอแลกของรางวัล")}
            subtitle={tt(
              "Preparing orders need to be handed over and marked delivered. Cancelling refunds the points and returns the item to stock.",
              "รายการที่กำลังเตรียมต้องส่งมอบและบันทึกว่าส่งแล้ว การยกเลิกจะคืนคะแนนและนำของกลับเข้าสต๊อก",
            )}
            right={
              <Pill tone={pendingQueue.length ? "warn" : "success"}>
                {tt(
                  `${pendingQueue.length} waiting`,
                  `รอดำเนินการ ${pendingQueue.length} รายการ`,
                )}
              </Pill>
            }
          />
          <TableWrap>
            <table className="w-full min-w-[860px] xl:min-w-0 border-collapse">
              <thead>
                <tr className="border-y border-line/70 bg-surface/60">
                  <Th>{t("label.employee")}</Th>
                  <Th>{tt("Reward", "ของรางวัล")}</Th>
                  <Th>{t("label.points")}</Th>
                  <Th>{t("label.date")}</Th>
                  <Th>{t("label.status")}</Th>
                  <Th className="text-right">{t("label.actions")}</Th>
                </tr>
              </thead>
              <tbody>
                {queue.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 last:border-0">
                    <Td>
                      <span className="block font-bold">{r.employeeName}</span>
                      <span className="block text-[10px] text-muted">
                        {r.employeeCode}
                      </span>
                    </Td>
                    <Td className="font-bold">{name({ nameEn: r.rewardNameEn, nameTh: r.rewardNameTh })}</Td>
                    <Td className="text-muted">
                      {tt(
                        `${formatNumber(r.points)} pts`,
                        `${formatNumber(r.points)} คะแนน`,
                      )}
                    </Td>
                    <Td className="text-muted">{formatDateTime(r.createdAt)}</Td>
                    <Td>
                      <Pill
                        tone={
                          r.status === "DELIVERED"
                            ? "success"
                            : r.status === "CANCELLED"
                              ? "danger"
                              : "warn"
                        }
                      >
                        {r.status === "DELIVERED"
                          ? t("status.delivered")
                          : r.status === "CANCELLED"
                            ? tt("Cancelled", "ยกเลิกแล้ว")
                            : t("status.preparing")}
                      </Pill>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap justify-end gap-2">
                        {r.status === "PREPARING" ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                run(() =>
                                  setRedemptionStatus({
                                    redemptionId: r.id,
                                    status: "DELIVERED",
                                  }),
                                )
                              }
                            >
                              <Check size={13} className="text-success" />
                              {tt("Mark delivered", "ทำเครื่องหมายว่าส่งแล้ว")}
                            </Button>
                            <IconAction
                              tone="danger"
                              disabled={busy}
                              aria-label={tt(
                                `Cancel and refund ${r.employeeName}`,
                                `ยกเลิกและคืนคะแนนให้ ${r.employeeName}`,
                              )}
                              onClick={() => setConfirmCancel(r.id)}
                            >
                              <Undo2 size={14} />
                            </IconAction>
                          </>
                        ) : (
                          <span className="text-xs text-muted">
                            {r.status === "DELIVERED"
                              ? tt("Fulfilled", "จัดส่งแล้ว")
                              : tt("Refunded", "คืนคะแนนแล้ว")}
                          </span>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
                {queue.length === 0 ? (
                  <tr>
                    <Td colSpan={6} className="py-10 text-center text-muted">
                      {tt("No redemption requests yet.", "ยังไม่มีคำขอแลกของรางวัล")}
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}

      {/* ------------------------------------------------- create / edit */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          editing
            ? tt("Edit reward", "แก้ไขของรางวัล")
            : tt("Add reward", "เพิ่มของรางวัล")
        }
        subtitle={tt(
          "Both names are shown to staff — Thai first for a Thai reader.",
          "ชื่อทั้งสองภาษาจะแสดงให้พนักงานเห็น ผู้ใช้ภาษาไทยจะเห็นชื่อภาษาไทยก่อน",
        )}
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
        <div className="grid gap-4">
          <Field label={`${tt("Reward title (English)", "ชื่อของรางวัล (อังกฤษ)")} *`}>
            <Input
              value={draft.nameEn}
              placeholder={tt("Reward name", "ชื่อของรางวัล")}
              onChange={(e) => set("nameEn", e.target.value)}
            />
          </Field>
          <Field label={tt("Reward title (Thai)", "ชื่อของรางวัล (ไทย)")}>
            <Input
              value={draft.nameTh}
              placeholder={tt("Optional", "ไม่บังคับ")}
              onChange={(e) => set("nameTh", e.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={tt("Points cost", "คะแนนที่ใช้แลก")}>
              <Input
                type="number"
                min={0}
                value={draft.points}
                onChange={(e) => set("points", e.target.value)}
              />
            </Field>
            <Field label={tt("Stock", "คงเหลือ")}>
              <Input
                type="number"
                min={0}
                value={draft.stock}
                onChange={(e) => set("stock", e.target.value)}
              />
            </Field>
            <Field label={t("label.category")}>
              <Select
                value={draft.preset}
                onChange={(e) => set("preset", e.target.value as PresetKey)}
              >
                {PRESETS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {tt(p.en, p.th)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-surface p-3">
            <span
              className="grid size-10 shrink-0 place-items-center rounded-lg text-white"
              style={coverStyle(draftPreset.tone)}
            >
              <draftPreset.icon size={18} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">
                {(lang === "th" ? draft.nameTh || draft.nameEn : draft.nameEn) ||
                  tt("Reward title", "ชื่อของรางวัล")}
              </p>
              <p className="truncate text-xs text-muted">
                {tt(
                  `${formatNumber(Number(draft.points) || 0)} points · ${Number(draft.stock) || 0} items in stock`,
                  `${formatNumber(Number(draft.points) || 0)} คะแนน · คงเหลือ ${Number(draft.stock) || 0} ชิ้น`,
                )}
              </p>
            </div>
          </div>
        </div>
      </Modal>

      {/* ------------------------------------------------------- delete */}
      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title={tt("Delete reward", "ลบของรางวัล")}
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
                if (target) run(() => deleteReward({ rewardId: target.id }));
              }}
            >
              {t("action.delete")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {tt("Remove", "ลบ")}{" "}
          <span className="font-medium text-ink">
            {confirmDelete ? name(confirmDelete) : ""}
          </span>{" "}
          {tt(
            "from the catalogue? A reward anybody has redeemed cannot be deleted — delist it instead and the history stays intact.",
            "ออกจากรายการหรือไม่? ของรางวัลที่มีคนแลกไปแล้วจะลบไม่ได้ กรุณาใช้การซ่อนแทน เพื่อให้ประวัติยังคงอยู่",
          )}
        </p>
      </Modal>

      {/* ---------------------------------------------- cancel + refund */}
      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => setConfirmCancel(null)}
        title={tt("Cancel and refund", "ยกเลิกและคืนคะแนน")}
        width="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmCancel(null)}>
              {t("action.back")}
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                const id = confirmCancel;
                setConfirmCancel(null);
                if (id)
                  run(() =>
                    setRedemptionStatus({ redemptionId: id, status: "CANCELLED" }),
                  );
              }}
            >
              {tt("Cancel and refund", "ยกเลิกและคืนคะแนน")}
            </Button>
          </>
        }
      >
        {cancelTarget ? (
          <p className="text-sm leading-relaxed text-muted">
            {tt(
              `${cancelTarget.employeeName} gets ${formatNumber(cancelTarget.points)} points back and "${cancelTarget.rewardNameEn}" returns to stock.`,
              `${cancelTarget.employeeName} จะได้รับ ${formatNumber(cancelTarget.points)} คะแนนคืน และ "${cancelTarget.rewardNameTh ?? cancelTarget.rewardNameEn}" จะกลับเข้าสต๊อก`,
            )}
          </p>
        ) : null}
      </Modal>
    </div>
  );
}
