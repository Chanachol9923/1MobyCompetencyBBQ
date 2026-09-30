"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Field, Input, Modal, Select } from "@/components/ui";
import {
  IconAction,
  SearchInput,
  TableWrap,
  Td,
  Th,
  downloadCsv,
} from "@/components/admin/shared";
import type {
  ActionResult,
  OrgEntity,
  OrgUnitRow,
} from "@/components/admin/content-types";
import { deleteOrgUnit, saveOrgUnit } from "@/server/admin-content";
import { useT } from "@/lib/i18n";

/**
 * Department / Division / Position, against the real tables.
 *
 * All three are the same operation — a named unit, optionally filed under a
 * department — so they share one component and one server action. The counts
 * are `_count` from the query, not figures somebody typed in: a department with
 * eleven people says eleven because eleven rows point at it.
 */
export function OrgTab({
  entity,
  rows,
  departments,
  onResult,
}: {
  entity: OrgEntity;
  rows: OrgUnitRow[];
  /** the parent options — empty for the department tab itself */
  departments: OrgUnitRow[];
  onResult: (result: ActionResult) => void;
}) {
  const { t, tt } = useT();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OrgUnitRow | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [confirm, setConfirm] = useState<OrgUnitRow | null>(null);
  const [busy, startTransition] = useTransition();

  const noun =
    entity === "department"
      ? { en: "Department", th: "ฝ่าย", label: t("label.department") }
      : entity === "division"
        ? { en: "Division", th: "แผนก", label: t("label.division") }
        : { en: "Position", th: "ตำแหน่ง", label: t("label.position") };

  const hasParent = entity !== "department";

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (hasParent && filter !== "all" && r.parentId !== filter) return false;
      if (!q) return true;
      return `${r.name} ${r.parentName ?? ""}`.toLowerCase().includes(q);
    });
  }, [rows, query, filter, hasParent]);

  function run(fn: () => Promise<ActionResult>) {
    startTransition(async () => onResult(await fn()));
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
        onResult(res);
      } else {
        setFormError(tt(res.error.en, res.error.th));
      }
    });
  }

  function openAdd() {
    setEditing(null);
    setName("");
    setParentId(hasParent ? (departments[0]?.id ?? "") : "");
    setOpen(true);
  }

  function openEdit(row: OrgUnitRow) {
    setEditing(row);
    setName(row.name);
    setParentId(row.parentId ?? "");
    setOpen(true);
  }

  function save() {
    const payload = {
      entity,
      id: editing?.id ?? "",
      name,
      parentId: hasParent ? parentId : "",
    };
    runForm(() => saveOrgUnit(payload));
  }

  function exportList() {
    downloadCsv(
      `1moby-${entity}-list.csv`,
      hasParent
        ? [noun.label, t("label.department"), t("label.headcount")]
        : [noun.label, tt("Divisions", "แผนก"), t("label.headcount")],
      visible.map((r) => [
        r.name,
        hasParent ? (r.parentName ?? "—") : r.childCount,
        r.employeeCount,
      ]),
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 p-5">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder={tt(`Search ${noun.en.toLowerCase()}...`, `ค้นหา${noun.th}...`)}
          className="w-full sm:w-64"
        />
        {hasParent ? (
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full sm:w-52"
            aria-label={t("label.department")}
          >
            <option value="all">{t("label.all")}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportList}>
            <Download size={14} className="text-brand" />
            {t("action.exportCsv")}
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus size={15} />
            {tt(`New ${noun.en.toLowerCase()}`, `${noun.th}ใหม่`)}
          </Button>
        </div>
      </div>

      <TableWrap>
        <table className="w-full min-w-[720px] xl:min-w-0 border-collapse">
          <thead>
            <tr className="border-y border-line/70 bg-surface/60">
              <Th>{noun.label}</Th>
              <Th>
                {hasParent ? t("label.department") : tt("Divisions", "จำนวนแผนก")}
              </Th>
              <Th>{t("label.headcount")}</Th>
              <Th className="text-right">{t("label.actions")}</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className="border-b border-line/60 last:border-0">
                <Td className="font-bold">{r.name}</Td>
                <Td className="text-muted">
                  {hasParent ? (r.parentName ?? "—") : r.childCount}
                </Td>
                <Td className="text-muted">{r.employeeCount}</Td>
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
                      disabled={busy}
                      aria-label={`${t("action.delete")} ${r.name}`}
                      onClick={() => setConfirm(r)}
                    >
                      <Trash2 size={14} />
                    </IconAction>
                  </div>
                </Td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <Td colSpan={4} className="py-10 text-center text-muted">
                  {tt(
                    `Nothing here yet — use "Create New ${noun.en}".`,
                    `ยังไม่มีข้อมูล — กด "สร้าง${noun.th}ใหม่" เพื่อเพิ่มรายการ`,
                  )}
                </Td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </TableWrap>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          editing
            ? tt(`Edit ${noun.en}`, `แก้ไข${noun.th}`)
            : tt(`Add ${noun.en.toLowerCase()}`, `เพิ่ม${noun.th}`)
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("action.cancel")}
            </Button>
            <Button onClick={save} disabled={busy}>
              {editing ? t("action.saveChanges") : t("action.add")}
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
          <Field label={`${noun.label} *`}>
            <Input
              value={name}
              placeholder={tt(`Enter ${noun.en.toLowerCase()} name`, `กรอกชื่อ${noun.th}`)}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          {hasParent ? (
            <Field
              label={
                entity === "division"
                  ? `${t("label.department")} *`
                  : t("label.department")
              }
              hint={
                entity === "division"
                  ? tt(
                      "A division always belongs to a department.",
                      "แผนกต้องสังกัดฝ่ายเสมอ",
                    )
                  : undefined
              }
            >
              <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
                {entity === "position" ? (
                  <option value="">{tt("Company-wide", "ใช้ได้ทั้งบริษัท")}</option>
                ) : null}
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={tt(`Delete ${noun.en.toLowerCase()}`, `ลบ${noun.th}`)}
        width="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              {t("action.cancel")}
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                const target = confirm;
                setConfirm(null);
                if (target) run(() => deleteOrgUnit({ entity, id: target.id }));
              }}
            >
              {t("action.delete")}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          {tt("Remove", "ลบ")}{" "}
          <span className="font-medium text-ink">{confirm?.name}</span>?{" "}
          {confirm && confirm.employeeCount > 0
            ? tt(
                `${confirm.employeeCount} people are filed under it, so this will be refused until they are moved.`,
                `มีพนักงาน ${confirm.employeeCount} คนอยู่ภายใต้รายการนี้ ระบบจะปฏิเสธจนกว่าจะย้ายออกก่อน`,
              )
            : tt(
                "Nothing is filed under it, so this is safe.",
                "ไม่มีข้อมูลใดอยู่ภายใต้รายการนี้ จึงลบได้อย่างปลอดภัย",
              )}
        </p>
      </Modal>
    </div>
  );
}
