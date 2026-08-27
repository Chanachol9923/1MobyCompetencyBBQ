"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Gift,
  Minus,
  Package,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
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
} from "@/components/ui";
import {
  AdminOnly,
  CountTile,
  IconAction,
  SearchInput,
  TableWrap,
  Td,
  Th,
  coverStyle,
  formatDate,
} from "@/components/admin/shared";
import type { Reward } from "@/data/learning";
import { useDemo } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { formatNumber } from "@/lib/utils";

export default function ManageRewardPage() {
  return (
    <AdminOnly>
      <ManageReward />
    </AdminOnly>
  );
}

const CATEGORIES = ["Voucher", "Merchandise", "Premium", "Experience"] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_TONE: Record<Category, string> = {
  Voucher: "from-[#0b6b3a] to-[#00b916]",
  Merchandise: "from-[#006bff] to-[#0061c8]",
  Premium: "from-[#faa21b] to-[#f7d488]",
  Experience: "from-[#9fd8dd] to-[#dff2f4]",
};

type Draft = {
  name: string;
  points: string;
  stock: string;
  category: Category;
};

const emptyDraft = (): Draft => ({
  name: "",
  points: "500",
  stock: "10",
  category: "Voucher",
});

type StockState = "out" | "low" | "in";

function stockTone(stock: number): { state: StockState; tone: "danger" | "warn" | "success" } {
  if (stock <= 0) return { state: "out", tone: "danger" };
  if (stock <= 5) return { state: "low", tone: "warn" };
  return { state: "in", tone: "success" };
}

function ManageReward() {
  const { state, update, notify, logActivity } = useDemo();
  const { t, tt } = useT();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [confirm, setConfirm] = useState<Reward | null>(null);

  const rewards = state.rewards;
  const stockOf = (id: string) => state.rewardStock[id] ?? 0;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rewards;
    return rewards.filter((r) => r.name.toLowerCase().includes(q));
  }, [rewards, query]);

  const redeemedCount = state.redeemed.length;
  const inStock = rewards.filter((r) => stockOf(r.id) > 0).length;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function openAdd() {
    setDraft(emptyDraft());
    setEditingId(null);
    setOpen(true);
  }

  function openEdit(r: Reward) {
    const category =
      (CATEGORIES.find((c) => CATEGORY_TONE[c] === r.tone) ?? "Voucher") as Category;
    setDraft({
      name: r.name,
      points: String(r.points),
      stock: String(stockOf(r.id)),
      category,
    });
    setEditingId(r.id);
    setOpen(true);
  }

  function save() {
    if (!draft.name.trim()) {
      notify(tt("Reward title is required", "กรุณากรอกชื่อของรางวัล"));
      return;
    }
    const stock = Number(draft.stock) || 0;
    const points = Number(draft.points) || 0;
    if (editingId) {
      const id = editingId;
      update((s) => ({
        ...s,
        rewards: s.rewards.map((r) =>
          r.id === id
            ? {
                ...r,
                name: draft.name.trim(),
                points,
                stock,
                image: draft.category.toLowerCase(),
                tone: CATEGORY_TONE[draft.category],
              }
            : r,
        ),
        rewardStock: { ...s.rewardStock, [id]: stock },
      }));
      logActivity("Updated reward", draft.name.trim(), `stock ${stock}`);
      notify(
        tt(
          `“${draft.name.trim()}” updated · stock ${stock}`,
          `อัปเดต “${draft.name.trim()}” · คงเหลือ ${stock}`,
        ),
      );
    } else {
      const id = `reward-${Date.now()}`;
      const reward: Reward = {
        id,
        name: draft.name.trim(),
        points,
        stock,
        image: draft.category.toLowerCase(),
        tone: CATEGORY_TONE[draft.category],
      };
      update((s) => ({
        ...s,
        rewards: [...s.rewards, reward],
        rewardStock: { ...s.rewardStock, [id]: stock },
      }));
      logActivity("Added reward", reward.name, `${points} pts`);
      notify(
        tt(
          `Reward “${reward.name}” added`,
          `เพิ่มของรางวัล “${reward.name}” แล้ว`,
        ),
      );
    }
    setOpen(false);
  }

  function adjustStock(r: Reward, delta: number) {
    const next = Math.max(0, stockOf(r.id) + delta);
    update((s) => ({ ...s, rewardStock: { ...s.rewardStock, [r.id]: next } }));
    logActivity("Adjusted reward stock", r.name, `${next}`);
    notify(
      tt(`${r.name} stock set to ${next}`, `ตั้งคงเหลือ ${r.name} เป็น ${next}`),
    );
  }

  function remove(r: Reward) {
    update((s) => {
      const rewardStock = { ...s.rewardStock };
      delete rewardStock[r.id];
      return { ...s, rewards: s.rewards.filter((x) => x.id !== r.id), rewardStock };
    });
    logActivity("Removed reward", r.name);
    notify(
      tt(
        `“${r.name}” removed from the catalogue`,
        `ลบ “${r.name}” ออกจากรายการของรางวัลแล้ว`,
      ),
    );
    setConfirm(null);
  }

  function markDelivered(id: string) {
    const record = state.redeemed.find((r) => r.id === id);
    update((s) => ({
      ...s,
      redeemed: s.redeemed.map((r) =>
        r.id === id ? { ...r, status: "Delivered" } : r,
      ),
    }));
    logActivity("Marked redemption delivered", record?.rewardName ?? "Reward");
    notify(
      tt(
        `${record?.rewardName ?? "Reward"} marked as delivered`,
        `ทำเครื่องหมายว่าส่งมอบ ${record?.rewardName ?? "ของรางวัล"} แล้ว`,
      ),
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading title={tt("Rewards Management", "จัดการของรางวัล")} />

      <div className="grid gap-4 sm:grid-cols-3">
        <CountTile
          value={rewards.length}
          label={tt("Total Rewards", "ของรางวัลทั้งหมด")}
          icon={<Gift size={20} />}
        />
        <CountTile
          value={inStock}
          label={tt("Active in catalogue", "มีในรายการ")}
          tone="success"
          icon={<Package size={20} />}
        />
        <CountTile
          value={redeemedCount}
          label={tt("Redeemed", "แลกไปแล้ว")}
          tone="amber"
          icon={<TrendingUp size={20} />}
        />
      </div>

      <Card className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <h3 className="text-lg font-bold text-ink">
            {tt("Reward catalogue", "รายการของรางวัล")}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder={tt("Search Rewards", "ค้นหาของรางวัล")}
              className="w-full sm:w-56"
            />
            <Button size="sm" onClick={openAdd}>
              <Plus size={15} />
              {tt("Add New Reward", "เพิ่มของรางวัล")}
            </Button>
          </div>
        </div>

        <TableWrap>
          <table className="w-full min-w-[820px] border-collapse">
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
                const stock = stockOf(r.id);
                const status = stockTone(stock);
                const redeemed = state.redeemed.filter(
                  (x) => x.rewardId === r.id,
                ).length;
                return (
                  <tr key={r.id} className="border-b border-line/60 last:border-0">
                    <Td>
                      <div className="flex items-center gap-3">
                        <span
                          className="size-9 shrink-0 rounded-lg"
                          style={coverStyle(r.tone)}
                        />
                        <span className="font-bold">{r.name}</span>
                      </div>
                    </Td>
                    <Td className="font-bold text-brand">
                      {tt(`${formatNumber(r.points)} pts`, `${formatNumber(r.points)} คะแนน`)}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <IconAction
                          aria-label={tt(
                            `Decrease ${r.name} stock`,
                            `ลดคงเหลือ ${r.name}`,
                          )}
                          onClick={() => adjustStock(r, -1)}
                        >
                          <Minus size={14} />
                        </IconAction>
                        <span className="w-10 text-center font-bold">{stock}</span>
                        <IconAction
                          aria-label={tt(
                            `Increase ${r.name} stock`,
                            `เพิ่มคงเหลือ ${r.name}`,
                          )}
                          onClick={() => adjustStock(r, 1)}
                        >
                          <Plus size={14} />
                        </IconAction>
                      </div>
                    </Td>
                    <Td className="text-muted">{redeemed}</Td>
                    <Td>
                      <Pill tone={status.tone}>
                        {status.state === "out"
                          ? tt("Out of stock", "หมด")
                          : status.state === "low"
                            ? tt("Low stock", "เหลือน้อย")
                            : tt("In stock", "มีสินค้า")}
                      </Pill>
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-2">
                        <IconAction
                          tone="brand"
                          aria-label={`${t("action.edit")} ${r.name}`}
                          onClick={() => openEdit(r)}
                        >
                          <Pencil size={14} />
                        </IconAction>
                        <IconAction
                          tone="danger"
                          aria-label={`${t("action.delete")} ${r.name}`}
                          onClick={() => setConfirm(r)}
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

      <Card className="mt-5">
        <CardHeader
          title={tt("Redemption requests", "คำขอแลกของรางวัล")}
          subtitle={tt(
            "Preparing orders need to be fulfilled and marked delivered.",
            "รายการที่กำลังเตรียมต้องจัดส่งและทำเครื่องหมายว่าส่งมอบแล้ว",
          )}
        />
        <TableWrap>
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-y border-line/70 bg-surface/60">
                <Th>{tt("Reward", "ของรางวัล")}</Th>
                <Th>{t("label.points")}</Th>
                <Th>{t("label.date")}</Th>
                <Th>{t("label.status")}</Th>
                <Th className="text-right">{t("label.action")}</Th>
              </tr>
            </thead>
            <tbody>
              {state.redeemed.map((r) => (
                <tr key={r.id} className="border-b border-line/60 last:border-0">
                  <Td className="font-bold">{r.rewardName}</Td>
                  <Td className="text-muted">
                    {tt(`${formatNumber(r.points)} pts`, `${formatNumber(r.points)} คะแนน`)}
                  </Td>
                  <Td className="text-muted">{formatDate(r.date)}</Td>
                  <Td>
                    <Pill tone={r.status === "Delivered" ? "success" : "warn"}>
                      {r.status === "Delivered"
                        ? tt("Delivered", "ส่งมอบแล้ว")
                        : tt("Preparing", "กำลังเตรียม")}
                    </Pill>
                  </Td>
                  <Td>
                    <div className="flex justify-end">
                      {r.status === "Preparing" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => markDelivered(r.id)}
                        >
                          <Check size={13} className="text-success" />
                          {tt("Mark delivered", "ทำเครื่องหมายส่งมอบ")}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted">
                          {tt("Fulfilled", "จัดส่งแล้ว")}
                        </span>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
              {state.redeemed.length === 0 ? (
                <tr>
                  <Td colSpan={5} className="py-10 text-center text-muted">
                    {tt("No redemption requests yet.", "ยังไม่มีคำขอแลกของรางวัล")}
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          editingId
            ? tt("Edit Reward", "แก้ไขของรางวัล")
            : tt("Add New Reward", "เพิ่มของรางวัล")
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
          <Field label={`${tt("Reward Title", "ชื่อของรางวัล")} *`}>
            <Input
              value={draft.name}
              placeholder={tt("Enter Reward Title", "กรอกชื่อของรางวัล")}
              onChange={(e) => set("name", e.target.value)}
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
                value={draft.category}
                onChange={(e) => set("category", e.target.value as Category)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-surface p-3">
            <span
              className="size-10 shrink-0 rounded-lg"
              style={coverStyle(CATEGORY_TONE[draft.category])}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">
                {draft.name || tt("Reward title", "ชื่อของรางวัล")}
              </p>
              <p className="truncate text-xs text-muted">
                {tt(
                  `${formatNumber(Number(draft.points) || 0)} points · ${
                    Number(draft.stock) || 0
                  } items in stock`,
                  `${formatNumber(Number(draft.points) || 0)} คะแนน · คงเหลือ ${
                    Number(draft.stock) || 0
                  } ชิ้น`,
                )}
              </p>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={tt("Delete reward", "ลบของรางวัล")}
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
          {tt("Remove", "ลบ")}{" "}
          <span className="font-medium text-ink">{confirm?.name}</span>{" "}
          {tt(
            "from the catalogue? Past redemptions stay in the history.",
            "ออกจากรายการหรือไม่? ประวัติการแลกที่ผ่านมาจะยังคงอยู่",
          )}
        </p>
      </Modal>
    </div>
  );
}
