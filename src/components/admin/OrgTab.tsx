"use client";

import { useMemo, useState } from "react";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Button,
  Field,
  Input,
  Modal,
  Select,
} from "@/components/ui";
import {
  IconAction,
  SearchInput,
  TableWrap,
  Td,
  Th,
  downloadCsv,
} from "@/components/admin/shared";
import { useDemo } from "@/lib/store";
import { useT } from "@/lib/i18n";

export type OrgField = {
  key: string;
  label: string;
  type?: "text" | "number" | "select";
  options?: string[];
};

export type OrgRow = { id: string } & Record<string, string | number>;

type Draft = Record<string, string>;

function toDraft(fields: OrgField[], row?: OrgRow): Draft {
  const d: Draft = {};
  fields.forEach((f) => {
    d[f.key] = row ? String(row[f.key] ?? "") : f.type === "number" ? "0" : "";
  });
  return d;
}

/**
 * Generic tab used by Position / Role / Department / Division. The store only
 * tracks employees, so these rows live in the page's local state seeded from
 * the org constants — add / edit / delete all work against that state.
 */
export function OrgTab({
  entity,
  noun,
  addLabel,
  fields,
  rows,
  onChange,
  filterKey,
  filterLabel,
}: {
  /** Stable English slug used for ids, CSV file names and the activity log. */
  entity: string;
  /** Singular name in the active language, e.g. "Position" / "ตำแหน่ง". */
  noun: string;
  /** Button copy from Figma, e.g. "Create New Position". */
  addLabel: string;
  fields: OrgField[];
  rows: OrgRow[];
  onChange: (next: OrgRow[]) => void;
  filterKey?: string;
  /** Accessible name for the filter dropdown, already translated. */
  filterLabel?: string;
}) {
  const { notify, logActivity } = useDemo();
  const { t, tt } = useT();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<OrgRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const [confirm, setConfirm] = useState<OrgRow | null>(null);

  const filterOptions = useMemo(() => {
    if (!filterKey) return [];
    return Array.from(new Set(rows.map((r) => String(r[filterKey] ?? "")))).filter(
      Boolean,
    );
  }, [rows, filterKey]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const matchQ =
        !q ||
        fields.some((f) => String(r[f.key] ?? "").toLowerCase().includes(q));
      const matchF =
        !filterKey || filter === "all" || String(r[filterKey] ?? "") === filter;
      return matchQ && matchF;
    });
  }, [rows, query, filter, filterKey, fields]);

  function openAdd() {
    setDraft(toDraft(fields));
    setAdding(true);
  }

  function openEdit(row: OrgRow) {
    setDraft(toDraft(fields, row));
    setEditing(row);
  }

  function closeForm() {
    setAdding(false);
    setEditing(null);
  }

  function buildRow(id: string): OrgRow {
    const row: OrgRow = { id };
    fields.forEach((f) => {
      row[f.key] =
        f.type === "number" ? Number(draft[f.key] ?? 0) || 0 : (draft[f.key] ?? "");
    });
    return row;
  }

  function save() {
    const nameKey = fields[0]!.key;
    const value = String(draft[nameKey] ?? "").trim();
    if (!value) {
      notify(tt(`${noun} name is required`, `กรุณากรอกชื่อ${noun}`));
      return;
    }
    if (editing) {
      const next = rows.map((r) => (r.id === editing.id ? buildRow(editing.id) : r));
      onChange(next);
      logActivity(`Updated ${entity}`, value);
      notify(tt(`${noun} updated`, `อัปเดต${noun}แล้ว`));
    } else {
      const id = `${entity}-${Date.now()}`;
      onChange([...rows, buildRow(id)]);
      logActivity(`Added ${entity}`, value);
      notify(tt(`${noun} “${value}” added`, `เพิ่ม${noun} “${value}” แล้ว`));
    }
    closeForm();
  }

  function remove(row: OrgRow) {
    const value = String(row[fields[0]!.key] ?? "");
    onChange(rows.filter((r) => r.id !== row.id));
    logActivity(`Removed ${entity}`, value);
    notify(tt(`${noun} “${value}” removed`, `ลบ${noun} “${value}” แล้ว`));
    setConfirm(null);
  }

  function exportList() {
    downloadCsv(
      `1moby-${entity}-list.csv`,
      fields.map((f) => f.label),
      visible.map((r) => fields.map((f) => r[f.key] ?? "")),
    );
    notify(
      tt(
        `${noun} list exported as CSV (${visible.length} rows)`,
        `ส่งออกรายการ${noun}เป็น CSV แล้ว (${visible.length} แถว)`,
      ),
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 p-5">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder={tt(`Search ${noun.toLowerCase()}...`, `ค้นหา${noun}...`)}
          className="w-full sm:w-64"
        />
        {filterKey ? (
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full sm:w-52"
            aria-label={filterLabel ?? filterKey}
          >
            <option value="all">{t("label.all")}</option>
            {filterOptions.map((o) => (
              <option key={o} value={o}>
                {o}
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
            {addLabel}
          </Button>
        </div>
      </div>

      <TableWrap>
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-y border-line/70 bg-surface/60">
              {fields.map((f) => (
                <Th key={f.key}>{f.label}</Th>
              ))}
              <Th className="text-right">{t("label.actions")}</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className="border-b border-line/60 last:border-0">
                {fields.map((f, i) => (
                  <Td key={f.key} className={i === 0 ? "font-bold" : "text-muted"}>
                    {String(r[f.key] ?? "")}
                  </Td>
                ))}
                <Td>
                  <div className="flex justify-end gap-2">
                    <IconAction
                      tone="brand"
                      aria-label={t("action.edit")}
                      onClick={() => openEdit(r)}
                    >
                      <Pencil size={14} />
                    </IconAction>
                    <IconAction
                      tone="danger"
                      aria-label={t("action.delete")}
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
                <Td colSpan={fields.length + 1} className="py-10 text-center text-muted">
                  {tt(
                    `Nothing here yet — use “${addLabel}” to create one.`,
                    `ยังไม่มีข้อมูล — กด “${addLabel}” เพื่อสร้างรายการใหม่`,
                  )}
                </Td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </TableWrap>

      <Modal
        open={adding || Boolean(editing)}
        onClose={closeForm}
        title={
          editing
            ? tt(`Edit ${noun}`, `แก้ไข${noun}`)
            : tt(`Add New ${noun}`, `เพิ่ม${noun}ใหม่`)
        }
        subtitle={
          editing
            ? tt("Update the details below.", "แก้ไขรายละเอียดด้านล่าง")
            : tt(`Create a new ${noun.toLowerCase()}.`, `สร้าง${noun}ใหม่`)
        }
        footer={
          <>
            <Button variant="outline" onClick={closeForm}>
              {t("action.cancel")}
            </Button>
            <Button onClick={save}>
              {editing ? t("action.saveChanges") : t("action.add")}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <Field key={f.key} label={f.label}>
              {f.type === "select" ? (
                <Select
                  value={draft[f.key] ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [f.key]: e.target.value }))
                  }
                >
                  <option value="">
                    {tt(`Select ${f.label.toLowerCase()}`, `เลือก${f.label}`)}
                  </option>
                  {(f.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  type={f.type === "number" ? "number" : "text"}
                  value={draft[f.key] ?? ""}
                  placeholder={tt(`Enter ${f.label.toLowerCase()}`, `กรอก${f.label}`)}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [f.key]: e.target.value }))
                  }
                />
              )}
            </Field>
          ))}
        </div>
      </Modal>

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={tt(`Delete ${noun}`, `ลบ${noun}`)}
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
          <span className="font-medium text-ink">
            {confirm ? String(confirm[fields[0]!.key] ?? "") : ""}
          </span>{" "}
          {tt(
            `from the ${noun.toLowerCase()} list?`,
            `ออกจากรายการ${noun}หรือไม่?`,
          )}{" "}
          {t("admin.onlyDemoData")}
        </p>
      </Modal>
    </div>
  );
}
