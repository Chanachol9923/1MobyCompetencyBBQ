"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Bell,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  KeyRound,
  Link2,
  Link2Off,
  Lock,
  Mail,
  PauseCircle,
  PlayCircle,
  Settings2,
  ShieldCheck,
  Unlock,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
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
  downloadCsv,
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
  IssuedLink,
  LinkResult,
  RoleSummary,
  UsersScreenData,
} from "@/components/admin/admin-types";
import {
  changeLoginId,
  createAccount,
  createMissingAccounts,
  issueAccessLink,
  linkEmployee,
  proposeAccount,
  requestPasswordReset,
  searchLinkableEmployees,
  setUserRole,
  setUserStatus,
  unlinkUser,
  unlockAccount,
} from "@/server/admin-users";
import { isValidLoginId, normaliseLoginId } from "@/lib/login-id";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "PENDING" | "ACTIVE" | "SUSPENDED";

/**
 * Company accounts — single sign-on for every module.
 *
 * Nobody signs themselves up. HROD creates the account here with the company
 * login id (name.sur@1moby.com), links the staff record and picks the role,
 * then hands the person a one-time link to set their own password. Every
 * button below is a guarded server action; the screen only decides what to offer.
 */
export function UsersScreen({ data }: { data: UsersScreenData }) {
  const { t, tt } = useT();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [issued, setIssued] = useState<IssuedLink | null>(null);
  const [bulk, setBulk] = useState<"confirm" | "running" | IssuedLink[] | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState<AdminUserRow | null>(null);
  const [resetting, setResetting] = useState<AdminUserRow | null>(null);
  const [confirm, setConfirm] = useState<
    { kind: "suspend" | "reactivate" | "link"; user: AdminUserRow } | null
  >(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const { rows, roles, counts, loginDomain } = data;

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

  // keep the manage dialog showing fresh data after an action revalidates
  const managingRow = managing ? (rows.find((r) => r.id === managing.id) ?? managing) : null;

  function run(userId: string, fn: () => Promise<ActionResult>) {
    setBusyId(userId);
    startTransition(async () => {
      const res = await fn();
      setResult(res);
      setBusyId(null);
    });
  }

  function runLink(userId: string, fn: () => Promise<LinkResult>) {
    setBusyId(userId);
    startTransition(async () => {
      const res = await fn();
      setBusyId(null);
      if (res.ok) {
        setIssued(res.link);
        setResult({ ok: true, message: res.message });
      } else {
        setResult(res);
      }
    });
  }

  const intro = tt(
    `One company account per person, name.sur@${loginDomain}, for every module. You assign the ID and the role; the person sets their own password.`,
    `หนึ่งคนหนึ่งบัญชี name.sur@${loginDomain} ใช้ได้ทุกโมดูล ผู้ดูแลกำหนดไอดีและบทบาท ส่วนรหัสผ่านเจ้าของบัญชีตั้งเอง`,
  );
  const createButton = (
    <Button onClick={() => setCreating(true)}>
      <UserPlus size={16} />
      {tt("Create account", "สร้างบัญชี")}
    </Button>
  );

  const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
    { value: "all", label: `${t("label.all")} (${counts.total})` },
    { value: "PENDING", label: `${tt("Awaiting activation", "รอเปิดใช้งาน")} (${counts.pending})` },
    { value: "ACTIVE", label: `${tt("Active", "ใช้งานอยู่")} (${counts.active})` },
    { value: "SUSPENDED", label: `${tt("Suspended", "ถูกระงับ")} (${counts.suspended})` },
  ];

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading title={tt("Accounts", "บัญชีผู้ใช้")} subtitle={intro} right={createButton} />

      <ResultBanner result={result} onDismiss={() => setResult(null)} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <CountTile
          value={counts.active}
          label={tt("Active accounts", "บัญชีที่ใช้งานอยู่")}
          tone="success"
          icon={<UserCheck size={20} />}
        />
        <CountTile
          value={counts.pending}
          label={tt("Awaiting activation", "รอเปิดใช้งาน")}
          tone="amber"
          icon={<Clock3 size={20} />}
        />
        <CountTile
          value={counts.suspended}
          label={tt("Suspended", "ถูกระงับ")}
          tone="ink"
          icon={<PauseCircle size={20} />}
        />
        <CountTile
          value={counts.withoutAccount}
          label={tt("Staff with no account yet", "พนักงานที่ยังไม่มีบัญชี")}
          icon={<UserX size={20} />}
        />
      </div>

      {counts.withoutAccount > 0 ? (
        <Card className="mt-5 flex flex-wrap items-center gap-3 border-brand/30 bg-brand-tint/40 p-4">
          <UserX size={18} className="shrink-0 text-brand" />
          <p className="min-w-0 flex-1 text-sm text-ink">
            {tt(
              `${counts.withoutAccount} active staff member(s) have no account yet.`,
              `มีพนักงาน ${counts.withoutAccount} คนที่ยังไม่มีบัญชี`,
            )}
          </p>
          <Button size="sm" variant="secondary" onClick={() => setBulk("confirm")}>
            <UserPlus size={14} />
            {tt("Create accounts for all", "สร้างบัญชีให้ทุกคน")}
          </Button>
        </Card>
      ) : null}

      <Card className="mt-5 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="scroll-thin -mx-1 overflow-x-auto px-1">
            <Tabs value={status} onChange={setStatus} options={STATUS_OPTIONS} className="min-w-max" />
          </div>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={tt(
              "Search login ID, name or employee ID...",
              "ค้นหาไอดี ชื่อ หรือรหัสพนักงาน...",
            )}
            className="ml-auto w-full sm:w-72"
          />
        </div>
      </Card>

      <Card className="mt-5">
        <TableWrap>
          <table className="w-full min-w-[920px] xl:min-w-0 border-collapse">
            <thead>
              <tr className="border-b border-line/70 bg-surface/60">
                <Th>{tt("Account", "บัญชี")}</Th>
                <Th className="w-52">{t("label.status")}</Th>
                <Th className="w-48">{t("label.role")}</Th>
                <Th className="w-52">{t("label.employee")}</Th>
                <Th className="w-60">{t("label.actions")}</Th>
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
                    <span className="block text-[11px] text-muted">{u.email}</span>
                    {u.isSelf ? (
                      <Pill tone="brand" className="mt-1">
                        {tt("This is you", "บัญชีของคุณ")}
                      </Pill>
                    ) : null}
                  </Td>
                  <Td>
                    <StatusPill status={u.status} />
                    <StatusDetail row={u} />
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
                      {!u.roleId ? <option value="">{tt("No role", "ยังไม่มีบทบาท")}</option> : null}
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
                        <span className="block text-[11px] text-muted">
                          {u.employeeCode} · {u.jobRoleName}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted">
                        {tt("No staff record", "ไม่ผูกกับข้อมูลพนักงาน")}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      {u.status !== "SUSPENDED" ? (
                        <Button
                          size="sm"
                          variant={u.status === "PENDING" ? "secondary" : "outline"}
                          disabled={busyId === u.id}
                          onClick={() =>
                            u.hasPassword
                              ? setResetting(u)
                              : runLink(u.id, () => issueAccessLink({ userId: u.id }))
                          }
                        >
                          {u.hasPassword ? <KeyRound size={14} /> : <Mail size={14} />}
                          {u.hasPassword
                            ? tt("Reset password", "รีเซ็ตรหัสผ่าน")
                            : tt("Activation link", "ลิงก์เปิดใช้งาน")}
                        </Button>
                      ) : null}
                      {u.lockedUntil ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === u.id}
                          onClick={() => run(u.id, () => unlockAccount({ userId: u.id }))}
                        >
                          <Unlock size={14} />
                          {tt("Unlock", "ปลดล็อก")}
                        </Button>
                      ) : null}
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
                        <IconAction
                          tone="danger"
                          disabled={busyId === u.id || u.isSelf}
                          title={
                            u.isSelf
                              ? tt("You cannot suspend yourself", "ระงับบัญชีตนเองไม่ได้")
                              : tt("Suspend", "ระงับ")
                          }
                          aria-label={tt(`Suspend ${u.email}`, `ระงับ ${u.email}`)}
                          onClick={() => setConfirm({ kind: "suspend", user: u })}
                          className="disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <PauseCircle size={15} />
                        </IconAction>
                      )}
                      <IconAction
                        tone="brand"
                        disabled={busyId === u.id}
                        title={tt("Manage login ID and staff record", "จัดการไอดีและข้อมูลพนักงาน")}
                        aria-label={tt(`Manage ${u.email}`, `จัดการ ${u.email}`)}
                        onClick={() => setManaging(u)}
                      >
                        <Settings2 size={15} />
                      </IconAction>
                    </div>
                  </Td>
                </tr>
              ))}
              {visible.length === 0 ? (
                <tr>
                  <Td colSpan={5}>
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
              {tt("Account safety", "ความปลอดภัยของบัญชี")}
            </Pill>
            <span className="text-xs text-muted">
              {tt(
                "Passwords are never shown to administrators. Five wrong passwords lock an account for 15 minutes. You cannot suspend yourself or move yourself to a role that cannot manage accounts.",
                "ผู้ดูแลระบบไม่เห็นรหัสผ่านของใคร ใส่รหัสผิด 5 ครั้งบัญชีจะถูกล็อก 15 นาที และคุณไม่สามารถระงับบัญชีตนเอง หรือย้ายตนเองไปบทบาทที่จัดการบัญชีไม่ได้",
              )}
            </span>
          </div>
          <PropagationNote />
        </div>
      </Card>

      {creating ? (
        <CreateAccountModal
          roles={roles}
          loginDomain={loginDomain}
          onClose={() => setCreating(false)}
          onCreated={(res) => {
            setCreating(false);
            setIssued(res.link);
            setResult({ ok: true, message: res.message });
          }}
        />
      ) : null}

      {managingRow ? (
        <ManageModal
          user={managingRow}
          loginDomain={loginDomain}
          busy={busyId === managingRow.id}
          onClose={() => setManaging(null)}
          onRun={(fn) => run(managingRow.id, fn)}
          onPickEmployee={() => {
            setConfirm({ kind: "link", user: managingRow });
            setManaging(null);
          }}
        />
      ) : null}

      {confirm?.kind === "link" ? (
        <LinkEmployeeModal
          user={confirm.user}
          onClose={() => setConfirm(null)}
          onResult={(res) => {
            setResult(res);
            if (res.ok) setConfirm(null);
          }}
        />
      ) : confirm ? (
        <ConfirmModal
          kind={confirm.kind}
          user={confirm.user}
          busy={busyId === confirm.user.id}
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            const u = confirm.user;
            setConfirm(null);
            run(u.id, () =>
              setUserStatus({
                userId: u.id,
                status: confirm.kind === "suspend" ? "SUSPENDED" : "ACTIVE",
              }),
            );
          }}
        />
      ) : null}

      {issued ? <IssuedLinkModal link={issued} onClose={() => setIssued(null)} /> : null}

      {resetting ? (
        <ResetModal
          user={resetting}
          busy={busyId === resetting.id}
          onClose={() => setResetting(null)}
          onNotify={() => {
            const u = resetting;
            setResetting(null);
            run(u.id, () => requestPasswordReset({ userId: u.id }));
          }}
          onLink={() => {
            const u = resetting;
            setResetting(null);
            runLink(u.id, () => issueAccessLink({ userId: u.id }));
          }}
        />
      ) : null}

      {bulk === "confirm" || bulk === "running" ? (
        <Modal
          open
          onClose={() => setBulk(null)}
          title={tt("Create accounts for all?", "สร้างบัญชีให้ทุกคน?")}
          width="max-w-md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setBulk(null)}>
                {t("action.cancel")}
              </Button>
              <Button
                disabled={bulk === "running"}
                onClick={() => {
                  setBulk("running");
                  startTransition(async () => {
                    const res = await createMissingAccounts();
                    if (res.ok) {
                      setBulk(res.links);
                      setResult({ ok: true, message: res.message });
                    } else {
                      setBulk(null);
                      setResult(res);
                    }
                  });
                }}
              >
                <UserPlus size={15} />
                {bulk === "running"
                  ? tt("Creating…", "กำลังสร้าง…")
                  : tt(`Create ${counts.withoutAccount}`, `สร้าง ${counts.withoutAccount} บัญชี`)}
              </Button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-muted">
            {tt(
              `Each person gets the login ID the naming rule gives (name.sur@${loginDomain}) and the Employee or Manager role their position implies. You get a list of activation links to send out, valid for 72 hours. IDs and roles can be changed afterwards.`,
              `แต่ละคนจะได้ไอดีตามกฎการตั้งชื่อ (name.sur@${loginDomain}) และบทบาทพนักงานหรือหัวหน้างานตามตำแหน่ง คุณจะได้รายการลิงก์เปิดใช้งานเพื่อส่งต่อ ใช้ได้ 72 ชั่วโมง และแก้ไขไอดีหรือบทบาทได้ภายหลัง`,
            )}
          </p>
        </Modal>
      ) : Array.isArray(bulk) ? (
        <BulkLinksModal links={bulk} onClose={() => setBulk(null)} />
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------- status detail */

function StatusDetail({ row }: { row: AdminUserRow }) {
  const { tt } = useT();
  if (row.lockedUntil) {
    return (
      <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-accent">
        <Lock size={11} />
        {tt(
          `Locked until ${formatDateTime(row.lockedUntil).slice(11)}`,
          `ถูกล็อกถึง ${formatDateTime(row.lockedUntil).slice(11)} น.`,
        )}
      </span>
    );
  }
  let text: string | null = null;
  if (row.status === "PENDING") {
    text = !row.openLink
      ? tt("No link issued yet", "ยังไม่ได้ออกลิงก์")
      : row.openLink.expired
        ? tt("Link expired — issue a new one", "ลิงก์หมดอายุแล้ว กรุณาออกลิงก์ใหม่")
        : tt(
            `Link valid until ${formatDateTime(row.openLink.expiresAt)}`,
            `ลิงก์ใช้ได้ถึง ${formatDateTime(row.openLink.expiresAt)}`,
          );
  } else if (row.status === "ACTIVE") {
    text = row.lastLoginAt
      ? tt(
          `Last sign-in ${formatDateTime(row.lastLoginAt)}`,
          `เข้าสู่ระบบล่าสุด ${formatDateTime(row.lastLoginAt)}`,
        )
      : tt("Has not signed in yet", "ยังไม่เคยเข้าสู่ระบบ");
    if (row.openLink && !row.openLink.expired) {
      text += tt(" · password reset requested", " · รอตั้งรหัสผ่านใหม่");
    }
  }
  return text ? <span className="mt-1 block text-[11px] text-muted">{text}</span> : null;
}

/* --------------------------------------------------------- employee picker */

/**
 * Staff records without an account. The search runs on the server; so does
 * the "email matches" hint, which is worked out from the account's own email.
 */
function EmployeePicker({
  userId,
  picked,
  onPick,
}: {
  userId?: string;
  picked: string;
  onPick: (id: string, suggested: boolean) => void;
}) {
  const { tt } = useT();
  const [query, setQuery] = useState("");
  const [picker, setPicker] = useState<EmployeePickerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const handle = window.setTimeout(
      () => {
        void searchLinkableEmployees({ userId: userId ?? "", query }).then((res) => {
          if (cancelled) return;
          setPicker(res);
          setLoading(false);
          if (!picked && res.suggestedId) onPick(res.suggestedId, true);
        });
      },
      query ? 250 : 0,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
    // onPick/picked are read once per search on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, query]);

  const options = picker?.options ?? [];

  return (
    <div>
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder={tt("Search name, email or employee ID...", "ค้นหาชื่อ อีเมล หรือรหัสพนักงาน...")}
      />
      <div className="scroll-thin mt-3 max-h-[34vh] space-y-2 overflow-y-auto pr-1">
        {loading && !picker ? (
          <p className="py-8 text-center text-sm text-muted">{tt("Searching...", "กำลังค้นหา...")}</p>
        ) : options.length === 0 ? (
          <EmptyState
            title={tt("Everyone matching already has an account", "ทุกคนที่ตรงกับคำค้นหามีบัญชีแล้ว")}
            hint={tt(
              "Add the person under Employee → Staff records first, or widen the search.",
              "เพิ่มพนักงานที่ Employee → ข้อมูลพนักงาน ก่อน หรือลองค้นหาให้กว้างขึ้น",
            )}
          />
        ) : (
          options.map((e) => (
            <label
              key={e.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                picked === e.id ? "border-brand bg-brand-tint" : "border-line hover:bg-surface",
              )}
            >
              <input
                type="radio"
                name="employee"
                className="size-4 accent-[#006bff]"
                checked={picked === e.id}
                onChange={() => onPick(e.id, false)}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-ink">{e.name}</span>
                  {e.id === picker?.suggestedId ? (
                    <Pill tone="success">{tt("Email matches", "อีเมลตรงกัน")}</Pill>
                  ) : null}
                </span>
                <span className="block truncate text-xs text-muted">
                  {e.employeeCode} · {e.jobRoleName}
                  {e.departmentName ? ` · ${e.departmentName}` : ""}
                </span>
              </span>
            </label>
          ))
        )}
        {picker?.truncated ? (
          <p className="pt-1 text-center text-[11px] text-muted">
            {tt("More people match — narrow the search.", "ยังมีรายชื่ออีก กรุณาค้นหาให้แคบลง")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- login id */

function LoginIdField({
  value,
  onChange,
  loginDomain,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  loginDomain: string;
  hint?: string;
}) {
  const { tt } = useT();
  const normalised = normaliseLoginId(value);
  const ok = isValidLoginId(normalised);
  return (
    <Field
      label={tt("Login ID", "ไอดีเข้าสู่ระบบ")}
      hint={
        value && !ok
          ? tt(
              `Use name.sur@${loginDomain} — lower-case English letters, one dot, optionally a number before the @.`,
              `ใช้รูปแบบ name.sur@${loginDomain} ตัวอักษรภาษาอังกฤษพิมพ์เล็ก จุดหนึ่งตัว และตัวเลขก่อน @ ได้`,
            )
          : hint
      }
    >
      <span className="relative block">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            const v = normaliseLoginId(value);
            onChange(v && !v.includes("@") ? `${v}@${loginDomain}` : v);
          }}
          placeholder={`name.sur@${loginDomain}`}
          autoCapitalize="none"
          spellCheck={false}
          className={cn("pr-9", value && !ok && "border-accent focus:border-accent")}
        />
        {ok ? (
          <CheckCircle2
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-success"
          />
        ) : null}
      </span>
    </Field>
  );
}

/* ---------------------------------------------------------- create account */

function CreateAccountModal({
  roles,
  loginDomain,
  onClose,
  onCreated,
}: {
  roles: RoleSummary[];
  loginDomain: string;
  onClose: () => void;
  onCreated: (res: Extract<LinkResult, { ok: true }>) => void;
}) {
  const { t, tt } = useT();
  const [kind, setKind] = useState<"staff" | "standalone">("staff");
  const [employeeId, setEmployeeId] = useState("");
  const [loginId, setLoginId] = useState("");
  const [roleId, setRoleId] = useState(roles.find((r) => r.key === "employee")?.id ?? "");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [proposing, setProposing] = useState(false);
  const [pending, startTransition] = useTransition();

  function pickEmployee(id: string) {
    setEmployeeId(id);
    setProposing(true);
    void proposeAccount({ employeeId: id }).then((p) => {
      setProposing(false);
      if (!p) return;
      setLoginId(p.loginId);
      if (p.roleId) setRoleId(p.roleId);
    });
  }

  const canSubmit =
    isValidLoginId(normaliseLoginId(loginId)) &&
    Boolean(roleId) &&
    (kind === "staff" ? Boolean(employeeId) : displayName.trim().length > 0);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createAccount({
        employeeId: kind === "staff" ? employeeId : "",
        loginId: normaliseLoginId(loginId),
        displayName: kind === "standalone" ? displayName : "",
        roleId,
      });
      if (res.ok) onCreated(res);
      else setError(tt(res.error.en, res.error.th));
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={tt("Create account", "สร้างบัญชี")}
      subtitle={tt(
        "The person gets a one-time link to set their own password.",
        "เจ้าของบัญชีจะได้รับลิงก์ใช้ครั้งเดียวเพื่อตั้งรหัสผ่านเอง",
      )}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button disabled={!canSubmit || pending || proposing} onClick={submit}>
            <UserPlus size={15} />
            {pending ? tt("Creating…", "กำลังสร้าง…") : tt("Create and get link", "สร้างและรับลิงก์")}
          </Button>
        </>
      }
    >
      <Tabs
        value={kind}
        onChange={(k) => {
          setKind(k);
          setError(null);
        }}
        options={[
          { value: "staff", label: tt("For a staff member", "สำหรับพนักงาน") },
          { value: "standalone", label: tt("Without a staff record", "ไม่ผูกกับข้อมูลพนักงาน") },
        ]}
      />

      <div className="mt-4 space-y-4">
        {kind === "staff" ? (
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">{tt("Staff member", "พนักงาน")}</p>
            <EmployeePicker picked={employeeId} onPick={(id) => pickEmployee(id)} />
          </div>
        ) : (
          <Field
            label={tt("Display name", "ชื่อที่แสดง")}
            hint={tt(
              "For people who run the system but are not assessed in it, such as HROD administrators.",
              "สำหรับผู้ดูแลระบบที่ไม่ได้อยู่ในรายชื่อผู้ถูกประเมิน เช่น เจ้าหน้าที่ HROD",
            )}
          >
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <LoginIdField
            value={loginId}
            onChange={setLoginId}
            loginDomain={loginDomain}
            hint={
              proposing
                ? tt("Working out the ID…", "กำลังสร้างไอดี…")
                : tt(
                    "First name, a dot, the first three letters of the surname. Add a digit if two people clash.",
                    "ชื่อ จุด และอักษร 3 ตัวแรกของนามสกุล หากซ้ำให้เติมตัวเลข",
                  )
            }
          />
          <Field label={t("label.role")}>
            <Select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {tt(r.nameEn, r.nameTh)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {error ? (
          <p role="alert" className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-ink">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------- issued link */

function IssuedLinkModal({ link, onClose }: { link: IssuedLink; onClose: () => void }) {
  const { tt, lang } = useT();
  const [copied, setCopied] = useState<"link" | "message" | null>(null);
  const until = formatDateTime(link.expiresAt);

  const message =
    lang === "th"
      ? link.purpose === "ACTIVATE"
        ? `สวัสดีคุณ ${link.name}\n\nบัญชีระบบประเมินสมรรถนะ 1Moby ของคุณพร้อมแล้ว\nไอดีเข้าสู่ระบบ: ${link.loginId}\n\nตั้งรหัสผ่านได้ที่ลิงก์นี้ (ใช้ได้ครั้งเดียว ถึง ${until}):\n${link.url}`
        : `สวัสดีคุณ ${link.name}\n\nลิงก์สำหรับตั้งรหัสผ่านใหม่ของระบบประเมินสมรรถนะ 1Moby\nไอดีเข้าสู่ระบบ: ${link.loginId}\n\n(ใช้ได้ครั้งเดียว ถึง ${until}):\n${link.url}`
      : link.purpose === "ACTIVATE"
        ? `Hi ${link.name},\n\nYour 1Moby Assessment System account is ready.\nLogin ID: ${link.loginId}\n\nSet your password here (single use, valid until ${until}):\n${link.url}`
        : `Hi ${link.name},\n\nHere is a link to set a new password for the 1Moby Assessment System.\nLogin ID: ${link.loginId}\n\n(single use, valid until ${until}):\n${link.url}`;

  async function copy(what: "link" | "message") {
    try {
      await navigator.clipboard.writeText(what === "link" ? link.url : message);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        link.purpose === "ACTIVATE"
          ? tt("Activation link", "ลิงก์เปิดใช้งาน")
          : tt("Password reset link", "ลิงก์ตั้งรหัสผ่านใหม่")
      }
      subtitle={`${link.name} · ${link.loginId}`}
      width="max-w-xl"
      footer={
        <>
          <Button variant="outline" onClick={() => copy("message")}>
            <Copy size={15} />
            {copied === "message" ? tt("Copied", "คัดลอกแล้ว") : tt("Copy message", "คัดลอกข้อความ")}
          </Button>
          <Button onClick={onClose}>{tt("Done", "เสร็จสิ้น")}</Button>
        </>
      }
    >
      <p className="text-sm text-muted">
        {tt(
          "Send this to the person through company email or chat. It works once, and only until it expires.",
          "ส่งลิงก์นี้ให้เจ้าของบัญชีทางอีเมลหรือแชตของบริษัท ใช้ได้ครั้งเดียวและภายในเวลาที่กำหนด",
        )}
      </p>
      <div className="mt-4 flex gap-2">
        <Input readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
        <Button variant="secondary" onClick={() => copy("link")} className="shrink-0">
          {copied === "link" ? <CheckCircle2 size={15} /> : <Link2 size={15} />}
          {copied === "link" ? tt("Copied", "คัดลอกแล้ว") : tt("Copy", "คัดลอก")}
        </Button>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
        <Clock3 size={13} />
        {tt(`Valid until ${until}`, `ใช้ได้ถึง ${until}`)}
      </p>
      <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-surface px-3 py-2.5 font-sans text-xs leading-relaxed text-ink">
        {message}
      </pre>
      <p className="mt-3 text-[11px] text-muted">
        {tt(
          "For security the link is shown only once. If it gets lost, issue a new one — the old one stops working.",
          "เพื่อความปลอดภัย ลิงก์จะแสดงเพียงครั้งเดียว หากลิงก์หาย ให้ออกลิงก์ใหม่ ลิงก์เดิมจะใช้ไม่ได้ทันที",
        )}
      </p>
    </Modal>
  );
}

function BulkLinksModal({ links, onClose }: { links: IssuedLink[]; onClose: () => void }) {
  const { tt } = useT();
  const download = () =>
    downloadCsv(
      `activation-links-${new Date().toISOString().slice(0, 10)}.csv`,
      ["name", "login_id", "activation_link", "valid_until"],
      links.map((l) => [l.name, l.loginId, l.url, formatDateTime(l.expiresAt)]),
    );
  return (
    <Modal
      open
      onClose={onClose}
      title={tt("Activation links", "ลิงก์เปิดใช้งาน")}
      subtitle={tt(
        `${links.length} new account${links.length === 1 ? "" : "s"}`,
        `บัญชีใหม่ ${links.length} บัญชี`,
      )}
      width="max-w-3xl"
      footer={
        <>
          <Button variant="outline" onClick={download}>
            <Download size={15} />
            {tt("Download CSV", "ดาวน์โหลด CSV")}
          </Button>
          <Button onClick={onClose}>{tt("Done", "เสร็จสิ้น")}</Button>
        </>
      }
    >
      <p className="text-sm text-muted">
        {tt(
          "Download the list now and send each person their own link — the links cannot be shown again. A lost link is replaced from the person's row.",
          "ดาวน์โหลดรายการตอนนี้แล้วส่งลิงก์ให้แต่ละคน ลิงก์จะแสดงซ้ำไม่ได้ หากลิงก์หายให้ออกใหม่จากแถวของบัญชีนั้น",
        )}
      </p>
      <ul className="scroll-thin mt-4 max-h-[46vh] divide-y divide-line overflow-y-auto rounded-lg border border-line">
        {links.map((l) => (
          <li key={l.loginId} className="flex items-center gap-3 px-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{l.name}</span>
              <span className="block truncate text-xs text-muted">{l.loginId}</span>
            </span>
            <CopyButton text={l.url} />
          </li>
        ))}
      </ul>
    </Modal>
  );
}

function CopyButton({ text }: { text: string }) {
  const { tt } = useT();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <CheckCircle2 size={14} /> : <Link2 size={14} />}
      {copied ? tt("Copied", "คัดลอกแล้ว") : tt("Copy link", "คัดลอกลิงก์")}
    </Button>
  );
}

/* ------------------------------------------------------------ manage modal */

function ManageModal({
  user,
  loginDomain,
  busy,
  onClose,
  onRun,
  onPickEmployee,
}: {
  user: AdminUserRow;
  loginDomain: string;
  busy: boolean;
  onClose: () => void;
  onRun: (fn: () => Promise<ActionResult>) => void;
  onPickEmployee: () => void;
}) {
  const { tt } = useT();
  const [loginId, setLoginId] = useState(user.email);
  const changed = normaliseLoginId(loginId) !== user.email;

  return (
    <Modal
      open
      onClose={onClose}
      title={user.name ?? user.email}
      subtitle={user.email}
      width="max-w-xl"
      footer={
        <Button variant="outline" onClick={onClose}>
          {tt("Close", "ปิด")}
        </Button>
      }
    >
      <dl className="grid grid-cols-2 gap-3 rounded-lg bg-surface p-3 text-xs">
        <div>
          <dt className="text-muted">{tt("Created", "สร้างเมื่อ")}</dt>
          <dd className="font-medium text-ink">{formatDateTime(user.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-muted">{tt("Last sign-in", "เข้าสู่ระบบล่าสุด")}</dt>
          <dd className="font-medium text-ink">
            {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : tt("Never", "ยังไม่เคย")}
          </dd>
        </div>
        <div>
          <dt className="text-muted">{tt("Password", "รหัสผ่าน")}</dt>
          <dd className="flex items-center gap-1 font-medium text-ink">
            <KeyRound size={12} />
            {user.hasPassword ? tt("Set by the owner", "เจ้าของบัญชีตั้งแล้ว") : tt("Not set yet", "ยังไม่ได้ตั้ง")}
          </dd>
        </div>
        <div>
          <dt className="text-muted">{tt("Status", "สถานะ")}</dt>
          <dd>
            <StatusPill status={user.status} />
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        <LoginIdField
          value={loginId}
          onChange={setLoginId}
          loginDomain={loginDomain}
          hint={tt(
            "Changing it also changes the linked staff record's email. The person keeps their password.",
            "การเปลี่ยนไอดีจะเปลี่ยนอีเมลในข้อมูลพนักงานที่ผูกไว้ด้วย รหัสผ่านเดิมยังใช้ได้",
          )}
        />
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            variant="outline"
            disabled={!changed || !isValidLoginId(normaliseLoginId(loginId)) || busy}
            onClick={() => onRun(() => changeLoginId({ userId: user.id, loginId }))}
          >
            {tt("Change login ID", "เปลี่ยนไอดีเข้าสู่ระบบ")}
          </Button>
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <p className="text-sm font-medium text-ink">{tt("Staff record", "ข้อมูลพนักงาน")}</p>
        {user.employeeId ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3">
            <span className="min-w-0">
              <span className="block text-sm font-bold text-ink">{user.employeeName}</span>
              <span className="block text-xs text-muted">
                {user.employeeCode} · {user.jobRoleName}
              </span>
            </span>
            <span className="flex gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={onPickEmployee}>
                <Link2 size={14} />
                {tt("Change", "เปลี่ยน")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy || user.isSelf}
                onClick={() => onRun(() => unlinkUser({ userId: user.id }))}
              >
                <Link2Off size={14} />
                {tt("Unlink", "ยกเลิกการเชื่อม")}
              </Button>
            </span>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-line p-3">
            <span className="text-xs text-muted">
              {tt(
                "Not linked. Without a staff record the account only reaches what its role grants — no assessment, IDP or learning of its own.",
                "ยังไม่ได้เชื่อม บัญชีที่ไม่มีข้อมูลพนักงานเข้าได้เฉพาะส่วนที่บทบาทอนุญาต ไม่มีแบบประเมิน แผนพัฒนา หรือการเรียนของตนเอง",
              )}
            </span>
            <Button size="sm" variant="outline" disabled={busy} onClick={onPickEmployee}>
              <Link2 size={14} />
              {tt("Link staff record", "เชื่อมข้อมูลพนักงาน")}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function LinkEmployeeModal({
  user,
  onClose,
  onResult,
}: {
  user: AdminUserRow;
  onClose: () => void;
  onResult: (result: ActionResult) => void;
}) {
  const { t, tt } = useT();
  const [picked, setPicked] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <Modal
      open
      onClose={onClose}
      title={tt("Link staff record", "เชื่อมข้อมูลพนักงาน")}
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
                onResult(await linkEmployee({ userId: user.id, employeeId: picked }));
              })
            }
          >
            <Link2 size={15} />
            {tt("Link", "เชื่อม")}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">
        {tt(
          "Only staff without an account of their own are listed.",
          "แสดงเฉพาะพนักงานที่ยังไม่มีบัญชีของตนเอง",
        )}
      </p>
      <EmployeePicker userId={user.id} picked={picked} onPick={(id) => setPicked(id)} />
    </Modal>
  );
}

/* ---------------------------------------------------------- reset password */

/**
 * Two ways to reset, because they suit different situations. The default goes
 * to the person's notifications: nothing for the administrator to pass on, and
 * the link is only made when they press Start. Someone who cannot sign in on
 * any device never sees a notification, so for them there is a link to send.
 */
function ResetModal({
  user,
  busy,
  onClose,
  onNotify,
  onLink,
}: {
  user: AdminUserRow;
  busy: boolean;
  onClose: () => void;
  onNotify: () => void;
  onLink: () => void;
}) {
  const { t, tt } = useT();
  const canNotify = user.employeeId !== null && user.status === "ACTIVE";
  const name = user.name ?? user.email;
  return (
    <Modal
      open
      onClose={onClose}
      title={tt("Reset password", "รีเซ็ตรหัสผ่าน")}
      subtitle={`${name} · ${user.email}`}
      width="max-w-lg"
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t("action.cancel")}
        </Button>
      }
    >
      <div className="space-y-3">
        <button
          type="button"
          disabled={!canNotify || busy}
          onClick={onNotify}
          className="flex w-full items-start gap-3 rounded-xl border border-brand/40 bg-brand-tint/40 p-4 text-left transition-colors hover:bg-brand-tint disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand text-white">
            <Bell size={17} />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
              {tt("Send to their notifications", "ส่งไปที่การแจ้งเตือน")}
              {canNotify ? <Pill tone="brand">{tt("Recommended", "แนะนำ")}</Pill> : null}
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-muted">
              {canNotify
                ? tt(
                    `${name} sees it in the bell and as a banner until they press Start, which opens the screen to choose a new password. Nothing for you to pass on.`,
                    `${name} จะเห็นในการแจ้งเตือนและแถบด้านบนจนกว่าจะกดเริ่ม แล้วตั้งรหัสผ่านใหม่ได้ทันที คุณไม่ต้องส่งอะไรต่อ`,
                  )
                : tt(
                    "Not available: this account has no staff record, so it has no notifications.",
                    "ใช้ไม่ได้ เพราะบัญชีนี้ไม่มีข้อมูลพนักงาน จึงไม่มีการแจ้งเตือน",
                  )}
            </span>
          </span>
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={onLink}
          className="flex w-full items-start gap-3 rounded-xl border border-line p-4 text-left transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-ink">
            <Link2 size={17} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-ink">
              {tt("Get a link to send yourself", "รับลิงก์ไปส่งเอง")}
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-muted">
              {tt(
                "For someone who cannot sign in on any device — they forgot the password everywhere. Send it by company chat or email. Valid 24 hours.",
                "สำหรับคนที่เข้าสู่ระบบไม่ได้เลยจากทุกอุปกรณ์ เช่น ลืมรหัสผ่าน ส่งให้ทางแชตหรืออีเมลบริษัท ใช้ได้ 24 ชั่วโมง",
              )}
            </span>
          </span>
        </button>
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        {tt(
          "Their current password keeps working until they set the new one. Either way, only the newest request works.",
          "รหัสผ่านเดิมยังใช้ได้จนกว่าจะตั้งรหัสใหม่ ไม่ว่าทางไหน คำขอล่าสุดเท่านั้นที่ใช้ได้",
        )}
      </p>
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
  kind: "suspend" | "reactivate";
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
        "They are signed out everywhere and cannot sign in until an administrator reactivates them. Their staff record and history stay as they are.",
        "ผู้ใช้จะถูกออกจากระบบทุกอุปกรณ์และเข้าสู่ระบบไม่ได้จนกว่าผู้ดูแลระบบจะเปิดใช้งานอีกครั้ง ข้อมูลพนักงานและประวัติยังอยู่ครบ",
      ),
      confirm: tt("Suspend", "ระงับ"),
      danger: true,
    },
    reactivate: {
      title: tt("Reactivate this account?", "เปิดใช้งานบัญชีนี้อีกครั้ง?"),
      body: user.hasPassword
        ? tt(
            "They can sign in again with their existing password and the role shown on the row.",
            "ผู้ใช้จะเข้าสู่ระบบได้อีกครั้งด้วยรหัสผ่านเดิมและบทบาทที่แสดงในแถวนี้",
          )
        : tt(
            "The account never set a password, so it goes back to awaiting activation — send a new link afterwards.",
            "บัญชีนี้ยังไม่เคยตั้งรหัสผ่าน จึงจะกลับไปเป็นสถานะรอเปิดใช้งาน กรุณาส่งลิงก์ใหม่หลังจากนี้",
          ),
      confirm: tt("Reactivate", "เปิดใช้งาน"),
      danger: false,
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
          <Button variant={copy.danger ? "danger" : "primary"} disabled={busy} onClick={onConfirm}>
            {copy.confirm}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-muted">{copy.body}</p>
    </Modal>
  );
}
