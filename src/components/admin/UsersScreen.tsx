"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  CheckCircle2,
  Link2Off,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  Modal,
  PageHeading,
  Pill,
  Select,
  Tabs,
} from "@/components/ui";
import {
  CountTile,
  SearchInput,
  TableWrap,
  Td,
  Th,
  formatDateTime,
} from "@/components/admin/shared";
import {
  PropagationNote,
  ResultBanner,
  StatusPill,
} from "@/components/admin/rbac-shared";
import type {
  ActionResult,
  AdminUserRow,
  EmployeePickerData,
  UsersScreenData,
} from "@/components/admin/admin-types";
import {
  approveUser,
  searchLinkableEmployees,
  setUserRole,
  setUserStatus,
  unlinkUser,
} from "@/server/admin-users";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "PENDING" | "ACTIVE" | "SUSPENDED";

/**
 * Account lifecycle.
 *
 * Signing in with Google creates a PENDING user with no staff record attached;
 * nothing about that makes the person an employee. This screen is where a human
 * decides: link them to an Employee, give them a role, suspend them, or detach
 * the link again. Every one of those is a guarded server action — the buttons
 * below only decide what to *offer*.
 */
export function UsersScreen({ data }: { data: UsersScreenData }) {
  const { t, tt } = useT();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [approving, setApproving] = useState<AdminUserRow | null>(null);
  const [confirm, setConfirm] = useState<
    { kind: "suspend" | "reactivate" | "unlink"; user: AdminUserRow } | null
  >(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const { rows, roles, counts } = data;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!q) return true;
      return [r.email, r.name ?? "", r.employeeName ?? "", r.employeeCode ?? "", r.roleNameEn ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, query, status]);

  function run(userId: string, fn: () => Promise<ActionResult>) {
    setBusyId(userId);
    startTransition(async () => {
      const res = await fn();
      setResult(res);
      setBusyId(null);
    });
  }

  const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
    { value: "all", label: `${t("label.all")} (${counts.total})` },
    { value: "PENDING", label: `${tt("Pending", "รออนุมัติ")} (${counts.pending})` },
    { value: "ACTIVE", label: `${tt("Active", "ใช้งานอยู่")} (${counts.active})` },
    {
      value: "SUSPENDED",
      label: `${tt("Suspended", "ถูกระงับ")} (${counts.suspended})`,
    },
  ];

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading
        title={tt("Accounts", "บัญชีผู้ใช้")}
        subtitle={tt(
          "Anyone can sign in with Google. Only an administrator can turn that into a staff account.",
          "ใครก็เข้าสู่ระบบด้วย Google ได้ แต่มีเพียงผู้ดูแลระบบเท่านั้นที่เปลี่ยนบัญชีนั้นให้เป็นบัญชีพนักงานได้",
        )}
      />

      <ResultBanner result={result} onDismiss={() => setResult(null)} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CountTile
          value={counts.pending}
          label={tt("Waiting for approval", "รอการอนุมัติ")}
          tone="amber"
          icon={<UserPlus size={20} />}
        />
        <CountTile
          value={counts.active}
          label={tt("Active accounts", "บัญชีที่ใช้งานอยู่")}
          tone="success"
          icon={<UserCheck size={20} />}
        />
        <CountTile
          value={counts.suspended}
          label={tt("Suspended", "ถูกระงับ")}
          tone="ink"
          icon={<PauseCircle size={20} />}
        />
        <CountTile
          value={counts.total}
          label={tt("Total logins", "บัญชีทั้งหมด")}
          icon={<Users size={20} />}
        />
      </div>

      <Card className="mt-5 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="scroll-thin -mx-1 overflow-x-auto px-1">
            <Tabs
              value={status}
              onChange={setStatus}
              options={STATUS_OPTIONS}
              className="min-w-max"
            />
          </div>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={tt(
              "Search email, name or employee code...",
              "ค้นหาอีเมล ชื่อ หรือรหัสพนักงาน...",
            )}
            className="ml-auto w-full sm:w-72"
          />
        </div>
      </Card>

      <Card className="mt-5">
        <TableWrap>
          <table className="w-full min-w-[980px] border-collapse">
            <thead>
              <tr className="border-b border-line/70 bg-surface/60">
                <Th>{tt("Account", "บัญชี")}</Th>
                <Th className="w-36">{t("label.status")}</Th>
                <Th className="w-44">{t("label.role")}</Th>
                <Th className="w-56">{t("label.employee")}</Th>
                <Th className="w-40">{tt("First signed in", "เข้าสู่ระบบครั้งแรก")}</Th>
                <Th className="w-64">{t("label.actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <tr
                  key={u.id}
                  className={cn(
                    "border-b border-line/60 last:border-0",
                    u.status === "PENDING" && "bg-amber/[.04]",
                    busyId === u.id && "opacity-50",
                  )}
                >
                  <Td>
                    <span className="block font-bold">{u.name ?? u.email}</span>
                    <span className="block text-[10px] text-muted">{u.email}</span>
                    {u.isSelf ? (
                      <Pill tone="brand" className="mt-1">
                        {tt("This is you", "บัญชีของคุณ")}
                      </Pill>
                    ) : null}
                  </Td>
                  <Td>
                    <StatusPill status={u.status} />
                  </Td>
                  <Td>
                    <Select
                      aria-label={tt("Role", "บทบาท")}
                      value={u.roleId ?? ""}
                      disabled={busyId === u.id}
                      onChange={(e) => {
                        const roleId = e.target.value;
                        if (!roleId || roleId === u.roleId) return;
                        run(u.id, () => setUserRole({ userId: u.id, roleId }));
                      }}
                    >
                      <option value="">{tt("No role", "ยังไม่มีบทบาท")}</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {tt(r.nameEn, r.nameTh)}
                        </option>
                      ))}
                    </Select>
                  </Td>
                  <Td>
                    {u.employeeId ? (
                      <>
                        <span className="block font-bold">{u.employeeName}</span>
                        <span className="block text-[10px] text-muted">
                          {u.employeeCode} · {u.jobRoleName}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted">
                        {tt("Not linked", "ยังไม่ได้เชื่อม")}
                      </span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-muted">
                    {formatDateTime(u.createdAt)}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant={u.employeeId ? "outline" : "primary"}
                        disabled={busyId === u.id}
                        onClick={() => setApproving(u)}
                      >
                        <CheckCircle2 size={14} />
                        {u.employeeId
                          ? tt("Relink", "เปลี่ยนการเชื่อม")
                          : tt("Approve", "อนุมัติ")}
                      </Button>
                      {u.status === "SUSPENDED" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === u.id}
                          onClick={() => setConfirm({ kind: "reactivate", user: u })}
                        >
                          <PlayCircle size={14} />
                          {tt("Reactivate", "เปิดใช้งานอีกครั้ง")}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === u.id}
                          onClick={() => setConfirm({ kind: "suspend", user: u })}
                        >
                          <PauseCircle size={14} />
                          {tt("Suspend", "ระงับ")}
                        </Button>
                      )}
                      {u.employeeId ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === u.id}
                          onClick={() => setConfirm({ kind: "unlink", user: u })}
                        >
                          <Link2Off size={14} />
                          {tt("Unlink", "ยกเลิกการเชื่อม")}
                        </Button>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              ))}
              {visible.length === 0 ? (
                <tr>
                  <Td colSpan={6}>
                    <EmptyState
                      title={t("admin.noMatch")}
                      hint={tt(
                        "Clear the search or pick another status.",
                        "ลองล้างคำค้นหาหรือเลือกสถานะอื่น",
                      )}
                    />
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableWrap>
        <div className="space-y-3 border-t border-line/70 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="brand">
              <ShieldCheck size={13} className="mr-1" />
              {tt("Enforced on the server", "บังคับใช้ที่ฝั่งเซิร์ฟเวอร์")}
            </Pill>
            <span className="text-xs text-muted">
              {tt(
                "You cannot suspend your own account or move it to a role that cannot manage roles — the action refuses it, not just this screen.",
                "คุณไม่สามารถระงับบัญชีของตนเอง หรือย้ายบัญชีตนเองไปยังบทบาทที่จัดการสิทธิ์ไม่ได้ — เซิร์ฟเวอร์จะปฏิเสธเอง ไม่ใช่แค่ซ่อนปุ่มในหน้านี้",
              )}
            </span>
          </div>
          <PropagationNote />
        </div>
      </Card>

      {approving ? (
        <ApproveModal
          user={approving}
          onClose={() => setApproving(null)}
          onResult={(res) => {
            setResult(res);
            if (res.ok) setApproving(null);
          }}
        />
      ) : null}

      {confirm ? (
        <ConfirmModal
          kind={confirm.kind}
          user={confirm.user}
          busy={busyId === confirm.user.id}
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            const u = confirm.user;
            const fn =
              confirm.kind === "unlink"
                ? () => unlinkUser({ userId: u.id })
                : () =>
                    setUserStatus({
                      userId: u.id,
                      status: confirm.kind === "suspend" ? "SUSPENDED" : "ACTIVE",
                    });
            setConfirm(null);
            run(u.id, fn);
          }}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- approve flow */

/**
 * The employee picker. Searching runs as a server query over employees who have
 * no login yet, and the suggestion is resolved server-side from this user's own
 * email — the browser never says which employee "matches".
 */
function ApproveModal({
  user,
  onClose,
  onResult,
}: {
  user: AdminUserRow;
  onClose: () => void;
  onResult: (result: ActionResult) => void;
}) {
  const { t, tt } = useT();
  const [query, setQuery] = useState("");
  const [picker, setPicker] = useState<EmployeePickerData | null>(null);
  const [picked, setPicked] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const handle = window.setTimeout(
      () => {
        void searchLinkableEmployees({ userId: user.id, query }).then((res) => {
          if (cancelled) return;
          setPicker(res);
          setPicked((current) => current || res.suggestedId || "");
          setLoading(false);
        });
      },
      query ? 250 : 0,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [user.id, query]);

  const options = picker?.options ?? [];

  return (
    <Modal
      open
      onClose={onClose}
      title={tt("Approve account", "อนุมัติบัญชี")}
      subtitle={user.email}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button
            disabled={!picked || pending}
            onClick={() =>
              startTransition(async () => {
                onResult(await approveUser({ userId: user.id, employeeId: picked }));
              })
            }
          >
            <CheckCircle2 size={15} />
            {tt("Link and activate", "เชื่อมและเปิดใช้งาน")}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">
        {tt(
          "Pick the staff record this login belongs to. Only employees without a login of their own are listed.",
          "เลือกข้อมูลพนักงานที่ตรงกับบัญชีนี้ รายการแสดงเฉพาะพนักงานที่ยังไม่มีบัญชีเข้าใช้งาน",
        )}
      </p>

      <SearchInput
        className="mt-4"
        value={query}
        onChange={setQuery}
        placeholder={tt(
          "Search name, email or employee code...",
          "ค้นหาชื่อ อีเมล หรือรหัสพนักงาน...",
        )}
      />

      <div className="scroll-thin mt-3 max-h-[46vh] space-y-2 overflow-y-auto pr-1">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted">
            {tt("Searching...", "กำลังค้นหา...")}
          </p>
        ) : options.length === 0 ? (
          <EmptyState
            title={tt("No unlinked employee matches", "ไม่พบพนักงานที่ยังไม่ได้เชื่อม")}
            hint={tt(
              "Every employee may already have a login, or the search is too narrow.",
              "พนักงานทุกคนอาจมีบัญชีอยู่แล้ว หรือคำค้นหาแคบเกินไป",
            )}
          />
        ) : (
          options.map((e) => {
            const suggested = e.id === picker?.suggestedId;
            return (
              <label
                key={e.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                  picked === e.id
                    ? "border-brand bg-brand-tint"
                    : "border-line hover:bg-surface",
                )}
              >
                <input
                  type="radio"
                  name="employee"
                  className="size-4 accent-[#006bff]"
                  checked={picked === e.id}
                  onChange={() => setPicked(e.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-ink">{e.name}</span>
                    {suggested ? (
                      <Pill tone="success">
                        {tt("Email matches", "อีเมลตรงกัน")}
                      </Pill>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {e.employeeCode} · {e.email}
                  </span>
                  <span className="block truncate text-[11px] text-muted">
                    {e.jobRoleName}
                    {e.departmentName ? ` · ${e.departmentName}` : ""}
                  </span>
                </span>
              </label>
            );
          })
        )}
        {picker?.truncated ? (
          <p className="pt-1 text-center text-[11px] text-muted">
            {tt(
              "More employees match — narrow the search.",
              "ยังมีพนักงานที่ตรงกับคำค้นหาอีก กรุณาระบุให้แคบลง",
            )}
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-sm font-medium text-ink">
          {tt("What this does", "การอนุมัตินี้ทำอะไร")}
        </p>
        <p className="rounded-lg bg-surface px-3 py-2 text-[11px] leading-relaxed text-muted">
          {tt(
            "The account is set to ACTIVE and attached to that employee. If it has no role yet it is given Employee, or Manager when the person has direct reports — you can change it on the row afterwards.",
            "บัญชีจะถูกตั้งเป็นสถานะใช้งานและเชื่อมกับพนักงานคนนั้น หากยังไม่มีบทบาท ระบบจะกำหนดเป็นพนักงาน หรือหัวหน้างานหากมีลูกทีม และคุณเปลี่ยนได้ภายหลังจากแถวในตาราง",
          )}
        </p>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------------- confirm */

function ConfirmModal({
  kind,
  user,
  busy,
  onClose,
  onConfirm,
}: {
  kind: "suspend" | "reactivate" | "unlink";
  user: AdminUserRow;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t, tt } = useT();

  const copy = {
    suspend: {
      title: tt("Suspend this account?", "ระงับบัญชีนี้?"),
      body: tt(
        "They keep their staff record and their history, but they are bounced at sign-in until an administrator reactivates them.",
        "ข้อมูลพนักงานและประวัติยังอยู่ครบ แต่จะไม่สามารถเข้าสู่ระบบได้จนกว่าผู้ดูแลระบบจะเปิดใช้งานอีกครั้ง",
      ),
      confirm: tt("Suspend", "ระงับ"),
      danger: true,
    },
    reactivate: {
      title: tt("Reactivate this account?", "เปิดใช้งานบัญชีนี้อีกครั้ง?"),
      body: tt(
        "They can sign in again with the role shown on the row.",
        "ผู้ใช้จะเข้าสู่ระบบได้อีกครั้งด้วยบทบาทที่แสดงในแถวนี้",
      ),
      confirm: tt("Reactivate", "เปิดใช้งาน"),
      danger: false,
    },
    unlink: {
      title: tt("Unlink the employee record?", "ยกเลิกการเชื่อมข้อมูลพนักงาน?"),
      body: tt(
        "Neither side is deleted. The login drops back to pending and the employee becomes available to link to another account.",
        "ไม่มีข้อมูลใดถูกลบ บัญชีจะกลับไปเป็นสถานะรออนุมัติ และข้อมูลพนักงานจะพร้อมให้เชื่อมกับบัญชีอื่น",
      ),
      confirm: tt("Unlink", "ยกเลิกการเชื่อม"),
      danger: true,
    },
  }[kind];

  return (
    <Modal
      open
      onClose={onClose}
      title={copy.title}
      subtitle={user.email}
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button
            variant={copy.danger ? "danger" : "primary"}
            disabled={busy}
            onClick={onConfirm}
          >
            {copy.confirm}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-muted">{copy.body}</p>
      {kind === "suspend" && user.isSelf ? (
        <p className="mt-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-ink">
          {tt(
            "This is your own account — the server will refuse this, so that an administrator cannot lock the organisation out.",
            "นี่คือบัญชีของคุณเอง เซิร์ฟเวอร์จะปฏิเสธคำสั่งนี้ เพื่อไม่ให้ผู้ดูแลระบบล็อกตัวเองออกจากระบบ",
          )}
        </p>
      ) : null}
    </Modal>
  );
}
