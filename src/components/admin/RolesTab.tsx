"use client";

import { Fragment, useMemo, useOptimistic, useTransition } from "react";
import { Lock } from "lucide-react";
import { Pill } from "@/components/ui";
import { TableWrap, Td, Th, Toggle } from "@/components/admin/shared";
import { PERMISSIONS } from "@/lib/permissions";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type {
  ActionResult,
  PermissionRow,
  RoleSummary,
} from "@/components/admin/admin-types";
import { setRolePermission } from "@/server/admin-users";

/**
 * The permission matrix — every Permission row against every Role column.
 *
 * This used to be component state seeded from a constant, which meant an admin
 * could "grant" a permission, reload the page, and find nothing had happened.
 * Every cell is now a `RolePermission` row: flipping one writes or deletes it
 * through a guarded server action straight away. The switch moves optimistically
 * and snaps back on its own if the server refuses, which is what makes a
 * refusal legible rather than mysterious.
 */

/** Cells the server will refuse, so the UI does not invite the click. */
const CRITICAL: string[] = [PERMISSIONS.MANAGE_ROLES, PERMISSIONS.MANAGE_USERS];

const CATEGORY_LABEL: Record<string, { en: string; th: string }> = {
  own: { en: "Own data", th: "ข้อมูลของตนเอง" },
  team: { en: "Team", th: "ทีม" },
  organisation: { en: "Organisation", th: "ระดับองค์กร" },
  administration: { en: "Administration", th: "การดูแลระบบ" },
  general: { en: "General", th: "ทั่วไป" },
};

export function RolesTab({
  roles,
  permissions,
  viewerRoleId,
  onResult,
}: {
  roles: RoleSummary[];
  permissions: PermissionRow[];
  viewerRoleId: string | null;
  onResult: (result: ActionResult) => void;
}) {
  const { tt } = useT();
  const [, startTransition] = useTransition();

  /** `roleId:permissionId` for every grant that exists in the database. */
  const granted = useMemo(() => {
    const set = new Set<string>();
    for (const role of roles) {
      for (const permissionId of role.permissionIds) {
        set.add(`${role.id}:${permissionId}`);
      }
    }
    return set;
  }, [roles]);

  const [optimistic, applyOptimistic] = useOptimistic(
    granted,
    (state: Set<string>, patch: { cell: string; granted: boolean }) => {
      const next = new Set(state);
      if (patch.granted) next.add(patch.cell);
      else next.delete(patch.cell);
      return next;
    },
  );

  /** Permissions in catalogue order, banded by category. */
  const groups = useMemo(() => {
    const out: { category: string; rows: PermissionRow[] }[] = [];
    for (const p of permissions) {
      const last = out[out.length - 1];
      if (last && last.category === p.category) last.rows.push(p);
      else out.push({ category: p.category, rows: [p] });
    }
    return out;
  }, [permissions]);

  /** Why a given cell is not clickable — null when it is. */
  function lockedReason(role: RoleSummary, permission: PermissionRow, on: boolean) {
    if (!on || !CRITICAL.includes(permission.key)) return null;
    if (viewerRoleId && role.id === viewerRoleId) {
      return tt(
        "Your own role needs this permission to reach this screen.",
        "บทบาทของคุณต้องใช้สิทธิ์นี้เพื่อเข้าถึงหน้านี้",
      );
    }
    return null;
  }

  function toggle(role: RoleSummary, permission: PermissionRow, next: boolean) {
    const cell = `${role.id}:${permission.id}`;
    startTransition(async () => {
      applyOptimistic({ cell, granted: next });
      onResult(
        await setRolePermission({
          roleId: role.id,
          permissionId: permission.id,
          granted: next,
        }),
      );
    });
  }

  const columnCount = roles.length + 1;

  return (
    <TableWrap>
      <table
        className="w-full border-collapse"
        style={{ minWidth: 340 + roles.length * 150 }}
      >
        <thead>
          <tr className="border-y border-line/70 bg-surface/60">
            <Th>{tt("Permission", "สิทธิ์การใช้งาน")}</Th>
            {roles.map((r) => (
              <Th key={r.id} className="w-[150px] text-center">
                <span className="block text-ink">{tt(r.nameEn, r.nameTh)}</span>
                <span className="block text-[10px] font-normal text-muted">
                  {r.userCount} {tt(r.userCount === 1 ? "account" : "accounts", "บัญชี")}
                </span>
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const label = CATEGORY_LABEL[group.category] ?? {
              en: group.category,
              th: group.category,
            };
            return (
              <Fragment key={group.category}>
                <tr className="border-y border-line/60 bg-surface/40">
                  <Td
                    colSpan={columnCount}
                    className="py-2 font-bold uppercase tracking-wide text-muted"
                  >
                    {tt(label.en, label.th)}
                  </Td>
                </tr>
                {group.rows.map((p) => (
                  <tr key={p.id} className="border-b border-line/60 last:border-0">
                    <Td>
                      <span className="block font-bold">{tt(p.nameEn, p.nameTh)}</span>
                      <span className="block text-[10px] text-muted">
                        {tt(p.descEn ?? "", p.descTh ?? "")}
                      </span>
                      <span className="mt-1 inline-flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted">
                          {p.key}
                        </span>
                        {p.source ? (
                          <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted">
                            {tt("Requirement", "ข้อกำหนด")} {p.source}
                          </span>
                        ) : null}
                      </span>
                    </Td>
                    {roles.map((r) => {
                      const on = optimistic.has(`${r.id}:${p.id}`);
                      const locked = lockedReason(r, p, on);
                      return (
                        <Td key={r.id}>
                          <span
                            className="flex items-center justify-center gap-2"
                            title={locked ?? undefined}
                          >
                            {locked ? (
                              <Lock size={13} className="text-muted" aria-hidden />
                            ) : null}
                            <Toggle
                              checked={on}
                              disabled={Boolean(locked)}
                              onChange={(next) => toggle(r, p, next)}
                              label={`${tt(p.nameEn, p.nameTh)} — ${tt(r.nameEn, r.nameTh)}`}
                            />
                          </span>
                        </Td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            );
          })}
          {permissions.length === 0 ? (
            <tr>
              <Td colSpan={columnCount} className="text-center text-muted">
                {tt("No permissions are defined.", "ยังไม่มีการกำหนดสิทธิ์ในระบบ")}
              </Td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </TableWrap>
  );
}

/** Legend for the matrix, shown under it. */
export function MatrixLegend({ className }: { className?: string }) {
  const { tt } = useT();
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Pill tone="success">{tt("Saved on toggle", "บันทึกทันทีเมื่อสลับ")}</Pill>
      <span className="inline-flex items-center gap-1 text-xs text-muted">
        <Lock size={12} />
        {tt(
          "locked switches are ones your own role needs to keep managing this screen",
          "สวิตช์ที่ล็อกไว้คือสิทธิ์ที่บทบาทของคุณต้องใช้เพื่อจัดการหน้านี้ต่อ",
        )}
      </span>
    </div>
  );
}
