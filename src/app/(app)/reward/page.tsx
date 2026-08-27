"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  ClipboardList,
  Coffee,
  CupSoda,
  Flame,
  Gem,
  Gift,
  Lightbulb,
  Search,
  Shirt,
  ShoppingCart,
  Star,
  Target,
} from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeading,
  Pill,
  Tabs,
} from "@/components/ui";
import { POINT_RULES, type Reward } from "@/data/learning";
import { useT } from "@/lib/i18n";
import { useDemo } from "@/lib/store";
import { cn, formatNumber } from "@/lib/utils";

const RULE_ICON: Record<string, typeof BookOpen> = {
  book: BookOpen,
  clipboard: ClipboardList,
  target: Target,
  flame: Flame,
};

const REWARD_ICON: Record<string, typeof Coffee> = {
  voucher: Coffee,
  gold: Gem,
  tshirt: Shirt,
  tumbler: CupSoda,
};

export default function RewardPage() {
  const { state, person, update, notify } = useDemo();
  const { t, tt, lang } = useT();
  const [tab, setTab] = useState<"stock" | "history">("stock");
  const [pending, setPending] = useState<Reward | null>(null);
  const [query, setQuery] = useState("");

  const personId = person?.id ?? "";
  const balance = state.points[personId] ?? 0;
  const spent = state.redeemed.reduce((a, r) => a + r.points, 0);
  const totalEarned = balance + spent;

  /** "500 points" / "500 คะแนน" — the same phrase appears in four places. */
  const points = (n: number) =>
    tt(`${formatNumber(n)} points`, `${formatNumber(n)} คะแนน`);

  /**
   * The catalogue carries a Thai name for every reward, and history rows only
   * store the English one, so resolve back through the catalogue by id.
   */
  const rewardName = (r: { name: string; nameTh?: string }) =>
    lang === "th" ? (r.nameTh ?? r.name) : r.name;

  const historyName = (row: { rewardId: string; rewardName: string }) => {
    const fromCatalogue = state.rewards.find((r) => r.id === row.rewardId);
    return fromCatalogue ? rewardName(fromCatalogue) : row.rewardName;
  };

  const history = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = [...state.redeemed].sort((a, b) =>
      b.date.localeCompare(a.date),
    );
    return q
      ? rows.filter((r) =>
          `${r.rewardName} ${historyName(r)}`.toLowerCase().includes(q),
        )
      : rows;
    // historyName only reads state.rewards and lang, both covered below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.redeemed, query, state.rewards, lang]);

  const confirmRedeem = () => {
    const reward = pending;
    if (!reward) return;
    setPending(null);
    update((s) => ({
      ...s,
      points: {
        ...s.points,
        [personId]: (s.points[personId] ?? 0) - reward.points,
      },
      rewardStock: {
        ...s.rewardStock,
        [reward.id]: Math.max(0, (s.rewardStock[reward.id] ?? 0) - 1),
      },
      redeemed: [
        {
          id: `r-${Date.now()}`,
          rewardId: reward.id,
          rewardName: reward.name,
          points: reward.points,
          date: new Date().toISOString().slice(0, 10),
          status: "Preparing" as const,
        },
        ...s.redeemed,
      ],
    }));
    notify(
      tt(
        `Redeemed ${reward.name} for ${formatNumber(reward.points)} points`,
        `แลก ${reward.name} ด้วย ${formatNumber(reward.points)} คะแนนแล้ว`,
      ),
    );
    setTab("history");
  };

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading title={t("nav.reward")} />

      {/* ----------------------------------------------------------- banner */}
      <div className="rounded-xl bg-gradient-to-r from-ink to-brand px-6 py-6 text-white shadow-[0_2px_10px_rgba(16,24,40,.12)]">
        <p className="text-xl font-medium sm:text-2xl">
          {tt("Point Remaining", "คะแนนคงเหลือ")}
        </p>
        <p className="mt-1 text-4xl font-bold sm:text-5xl">
          {formatNumber(balance)}
        </p>
      </div>

      {/* ------------------------------------------------------------ stats */}
      <div className="mt-5 grid gap-5 sm:grid-cols-3">
        <StatTile
          icon={<Star size={20} />}
          label={tt("Total Point", "คะแนนสะสมทั้งหมด")}
          value={formatNumber(totalEarned)}
        />
        <StatTile
          icon={<ShoppingCart size={20} />}
          label={tt("Points Spent", "คะแนนที่ใช้ไป")}
          value={formatNumber(spent)}
        />
        <StatTile
          icon={<Gift size={20} />}
          label={tt("Rewards Redeemed", "ของรางวัลที่แลกแล้ว")}
          value={String(state.redeemed.length)}
        />
      </div>

      {/* ------------------------------------------------------- point rules */}
      <div className="mt-5 rounded-xl bg-brand-tint/60 p-5">
        <p className="flex items-center gap-2 text-base font-medium text-ink">
          <Lightbulb size={18} className="shrink-0 text-amber" />
          {tt("How to get point?", "รับคะแนนได้อย่างไร?")}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {POINT_RULES.map((rule) => {
            const Icon = RULE_ICON[rule.icon] ?? Star;
            return (
              <div
                key={rule.id}
                className="flex items-center gap-3 rounded-lg border border-line/70 bg-white px-4 py-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-tint text-brand">
                  <Icon size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">+{rule.points}</p>
                  <p className="text-xs text-muted">
                    {lang === "th" ? rule.labelTh : rule.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------- tabs */}
      <div className="mt-6">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "stock", label: tt("Stock", "รายการของรางวัล") },
            { value: "history", label: tt("History", "ประวัติการแลก") },
          ]}
        />
      </div>

      {tab === "stock" ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {state.rewards.map((r) => {
            const stock = state.rewardStock[r.id] ?? 0;
            const affordable = balance >= r.points;
            const disabled = !affordable || stock === 0;
            const Icon = REWARD_ICON[r.image] ?? Gift;
            return (
              <Card key={r.id} className="flex flex-col overflow-hidden">
                <div
                  className={cn(
                    "grid h-36 place-items-center bg-gradient-to-br text-white",
                    r.tone,
                  )}
                >
                  <Icon size={52} strokeWidth={1.2} />
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-sm font-medium text-ink">
                    {rewardName(r)}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-base font-medium text-ink">
                        {points(r.points)}
                      </p>
                      <p className="text-xs text-muted">
                        {tt(
                          `${stock} ${stock === 1 ? "item" : "items"} in Stock`,
                          `คงเหลือ ${stock} ชิ้น`,
                        )}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      disabled={disabled}
                      onClick={() => setPending(r)}
                      className="shrink-0 whitespace-nowrap"
                    >
                      {t("action.redeem")}
                    </Button>
                  </div>
                  {disabled ? (
                    <p className="mt-2 text-xs text-accent">
                      {stock === 0
                        ? t("status.outOfStock")
                        : tt(
                            `Need ${formatNumber(r.points - balance)} more points`,
                            `ต้องการอีก ${formatNumber(r.points - balance)} คะแนน`,
                          )}
                    </p>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="relative min-w-[220px] flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tt(
                  "Search redemption details",
                  "ค้นหารายการที่แลก",
                )}
                aria-label={tt(
                  "Search redemption history",
                  "ค้นหาประวัติการแลกของรางวัล",
                )}
                className="pl-9"
              />
            </div>
            <Pill tone="brand">
              {tt(`${history.length} records`, `${history.length} รายการ`)}
            </Pill>
          </div>

          {history.length ? (
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="py-2 font-medium">{t("label.date")}</th>
                    <th className="py-2 font-medium">
                      {tt("Redemption details", "รายการที่แลก")}
                    </th>
                    <th className="py-2 font-medium">
                      {tt("Points", "คะแนนที่ใช้")}
                    </th>
                    <th className="py-2 text-right font-medium">
                      {t("label.status")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-line/60 last:border-0"
                    >
                      <td className="py-3 text-muted">
                        {row.date.split("-").reverse().join(" / ")}
                      </td>
                      <td className="py-3 font-medium text-ink">
                        {historyName(row)}
                      </td>
                      <td className="py-3 text-muted">{points(row.points)}</td>
                      <td className="py-3 text-right">
                        <Pill
                          tone={row.status === "Delivered" ? "success" : "warn"}
                        >
                          {row.status === "Delivered"
                            ? t("status.delivered")
                            : t("status.preparing")}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title={tt("No redemptions yet", "ยังไม่มีการแลกของรางวัล")}
              hint={tt(
                "Redeem something from the Stock tab and it will show up here.",
                "เลือกแลกของรางวัลจากแท็บรายการของรางวัล แล้วรายการจะแสดงที่นี่",
              )}
            />
          )}
        </Card>
      )}

      <Modal
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title={tt("Confirm redemption", "ยืนยันการแลกของรางวัล")}
        subtitle={tt(
          "Points are deducted immediately in this demo",
          "ในเวอร์ชันสาธิต คะแนนจะถูกหักทันที",
        )}
        footer={
          <>
            <Button variant="outline" onClick={() => setPending(null)}>
              {t("action.cancel")}
            </Button>
            <Button onClick={confirmRedeem}>
              {tt("Confirm redeem", "ยืนยันการแลก")}
            </Button>
          </>
        }
      >
        {pending ? (
          <div className="space-y-3 text-sm">
            <p className="text-ink">
              {tt("Redeem", "แลก")}{" "}
              <span className="font-bold">{rewardName(pending)}</span>{" "}
              {tt("for", "ด้วย")}{" "}
              <span className="font-bold">{points(pending.points)}</span>
              {tt("?", " ใช่หรือไม่?")}
            </p>
            <div className="rounded-lg bg-surface px-4 py-3 text-muted">
              <div className="flex justify-between gap-3">
                <span>{tt("Current balance", "คะแนนคงเหลือปัจจุบัน")}</span>
                <span className="font-medium text-ink">
                  {formatNumber(balance)}
                </span>
              </div>
              <div className="mt-1 flex justify-between gap-3">
                <span>{tt("Balance after", "คงเหลือหลังแลก")}</span>
                <span className="font-medium text-brand">
                  {formatNumber(balance - pending.points)}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand-tint text-brand">
        {icon}
      </span>
      <div className="min-w-0">
        {/* no truncate — Thai labels run longer and must be allowed to wrap */}
        <p className="text-sm text-muted">{label}</p>
        <p className="text-2xl font-bold text-ink">{value}</p>
      </div>
    </Card>
  );
}
