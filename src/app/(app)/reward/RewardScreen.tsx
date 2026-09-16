"use client";

import { useMemo, useState, useTransition } from "react";
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
import { ResultBanner } from "@/components/admin/rbac-shared";
import { redeemReward } from "@/server/engagement";
import { POINT_RULES } from "@/data/learning";
import { useT } from "@/lib/i18n";
import { cn, formatNumber } from "@/lib/utils";
import type {
  ActionResult,
  RedeemResult,
  RewardCard,
  RewardScreenData,
} from "./types";

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

/**
 * The reward catalogue and the viewer's own redemption history.
 *
 * Nothing on this screen decides anything. The balance is the ledger's sum, the
 * stock figure is the catalogue row, and the Redeem button only *offers* — the
 * server action re-reads price, balance and stock inside a transaction and is
 * free to refuse. Disabling the button is a courtesy to the person, not a
 * control: a refusal comes back as a sentence in their language.
 */
export function RewardScreen({ data }: { data: RewardScreenData }) {
  const { t, tt, lang } = useT();
  const [tab, setTab] = useState<"stock" | "history">("stock");
  const [pending, setPending] = useState<RewardCard | null>(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [busy, startTransition] = useTransition();

  const { balance, spent, totalEarned, redeemedCount, rewards, history } = data;

  /** "500 points" / "500 คะแนน" — the same phrase appears in four places. */
  const points = (n: number) =>
    tt(`${formatNumber(n)} points`, `${formatNumber(n)} คะแนน`);

  const name = (r: { nameEn: string; nameTh: string | null }) =>
    lang === "th" ? (r.nameTh ?? r.nameEn) : r.nameEn;

  const visibleHistory = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return history;
    return history.filter((r) =>
      `${r.nameEn} ${r.nameTh ?? ""}`.toLowerCase().includes(q),
    );
  }, [history, query]);

  function confirmRedeem() {
    const reward = pending;
    if (!reward) return;
    setPending(null);
    startTransition(async () => {
      const res: RedeemResult = await redeemReward({ rewardId: reward.id });
      setResult(res);
      if (res.ok) setTab("history");
    });
  }

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading title={t("nav.reward")} />

      <ResultBanner result={result} onDismiss={() => setResult(null)} />

      {/* ----------------------------------------------------------- banner */}
      <div className="rounded-xl bg-gradient-to-r from-ink to-brand px-6 py-6 text-white shadow-[0_2px_10px_rgba(16,24,40,.12)]">
        <p className="text-xl font-medium sm:text-2xl">
          {tt("Point Remaining", "คะแนนคงเหลือ")}
        </p>
        <p className="mt-1 text-4xl font-bold sm:text-5xl">{formatNumber(balance)}</p>
        <p className="mt-2 text-xs text-white/75">
          {tt(
            "Summed from every entry in your points ledger — never a stored total.",
            "คำนวณจากทุกรายการในบัญชีคะแนนของคุณ ไม่ใช่ยอดที่เก็บไว้ล่วงหน้า",
          )}
        </p>
      </div>

      {/* ------------------------------------------------------------ stats */}
      <div className="mt-5 grid gap-5 sm:grid-cols-3">
        <StatTile
          icon={<Star size={20} />}
          label={tt("Total Point", "คะแนนสะสมทั้งหมด")}
          value={formatNumber(totalEarned)}
          hint={tt("Balance + spent", "คงเหลือ + ที่ใช้ไป")}
        />
        <StatTile
          icon={<ShoppingCart size={20} />}
          label={tt("Points Spent", "คะแนนที่ใช้ไป")}
          value={formatNumber(spent)}
          hint={tt("Sum of your redemptions", "ผลรวมของรายการที่แลก")}
        />
        <StatTile
          icon={<Gift size={20} />}
          label={tt("Rewards Redeemed", "ของรางวัลที่แลกแล้ว")}
          value={String(redeemedCount)}
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
          {rewards.map((r) => {
            const affordable = balance >= r.points;
            const disabled = !affordable || r.stock === 0 || busy;
            const Icon = REWARD_ICON[r.image ?? ""] ?? Gift;
            return (
              <Card key={r.id} className="flex flex-col overflow-hidden">
                <div
                  className={cn(
                    "grid h-36 place-items-center bg-gradient-to-br text-white",
                    r.tone ?? "from-[#006bff] to-[#0b1b3f]",
                  )}
                >
                  <Icon size={52} strokeWidth={1.2} />
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-sm font-medium text-ink">{name(r)}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-base font-medium text-ink">{points(r.points)}</p>
                      <p className="text-xs text-muted">
                        {tt(
                          `${r.stock} ${r.stock === 1 ? "item" : "items"} in Stock`,
                          `คงเหลือ ${r.stock} ชิ้น`,
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
                  {!affordable || r.stock === 0 ? (
                    <p className="mt-2 text-xs text-accent">
                      {r.stock === 0
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
          {rewards.length === 0 ? (
            <Card className="sm:col-span-2 lg:col-span-3">
              <EmptyState
                title={tt("The catalogue is empty", "ยังไม่มีของรางวัลในรายการ")}
                hint={tt(
                  "An administrator has not published any rewards yet.",
                  "ผู้ดูแลระบบยังไม่ได้เพิ่มของรางวัล",
                )}
              />
            </Card>
          ) : null}
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
                placeholder={tt("Search redemption details", "ค้นหารายการที่แลก")}
                aria-label={tt(
                  "Search redemption history",
                  "ค้นหาประวัติการแลกของรางวัล",
                )}
                className="pl-9"
              />
            </div>
            <Pill tone="brand">
              {tt(
                `${visibleHistory.length} records`,
                `${visibleHistory.length} รายการ`,
              )}
            </Pill>
          </div>

          {visibleHistory.length ? (
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="py-2 font-medium">{t("label.date")}</th>
                    <th className="py-2 font-medium">
                      {tt("Redemption details", "รายการที่แลก")}
                    </th>
                    <th className="py-2 font-medium">{tt("Points", "คะแนนที่ใช้")}</th>
                    <th className="py-2 text-right font-medium">{t("label.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleHistory.map((row) => (
                    <tr key={row.id} className="border-b border-line/60 last:border-0">
                      <td className="py-3 text-muted">
                        {row.createdAt.slice(0, 10).split("-").reverse().join(" / ")}
                      </td>
                      <td className="py-3 font-medium text-ink">{name(row)}</td>
                      <td className="py-3 text-muted">{points(row.points)}</td>
                      <td className="py-3 text-right">
                        <Pill
                          tone={
                            row.status === "DELIVERED"
                              ? "success"
                              : row.status === "CANCELLED"
                                ? "danger"
                                : "warn"
                          }
                        >
                          {row.status === "DELIVERED"
                            ? t("status.delivered")
                            : row.status === "CANCELLED"
                              ? tt("Cancelled — refunded", "ยกเลิก — คืนคะแนนแล้ว")
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
          "The points come out of your ledger the moment this succeeds.",
          "คะแนนจะถูกหักจากบัญชีคะแนนของคุณทันทีที่ทำรายการสำเร็จ",
        )}
        footer={
          <>
            <Button variant="outline" onClick={() => setPending(null)}>
              {t("action.cancel")}
            </Button>
            <Button onClick={confirmRedeem} disabled={busy}>
              {tt("Confirm redeem", "ยืนยันการแลก")}
            </Button>
          </>
        }
      >
        {pending ? (
          <div className="space-y-3 text-sm">
            <p className="text-ink">
              {tt("Redeem", "แลก")}{" "}
              <span className="font-bold">{name(pending)}</span> {tt("for", "ด้วย")}{" "}
              <span className="font-bold">{points(pending.points)}</span>
              {tt("?", " ใช่หรือไม่?")}
            </p>
            <div className="rounded-lg bg-surface px-4 py-3 text-muted">
              <div className="flex justify-between gap-3">
                <span>{tt("Current balance", "คะแนนคงเหลือปัจจุบัน")}</span>
                <span className="font-medium text-ink">{formatNumber(balance)}</span>
              </div>
              <div className="mt-1 flex justify-between gap-3">
                <span>{tt("Balance after", "คงเหลือหลังแลก")}</span>
                <span className="font-medium text-brand">
                  {formatNumber(balance - pending.points)}
                </span>
              </div>
              <div className="mt-1 flex justify-between gap-3">
                <span>{tt("Stock left after", "คงเหลือในสต๊อกหลังแลก")}</span>
                <span className="font-medium text-ink">
                  {Math.max(0, pending.stock - 1)}
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
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
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
        {hint ? <p className="text-[11px] text-line-2">{hint}</p> : null}
      </div>
    </Card>
  );
}
