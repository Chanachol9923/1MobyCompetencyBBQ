"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Field, Input, Modal, Pill } from "@/components/ui";
import {
  IconAction,
  Note,
  SearchInput,
  TableWrap,
  Td,
  Th,
  downloadCsv,
} from "@/components/admin/shared";
import type { ActionResult, JobRoleRow } from "@/components/admin/content-types";
import { createJobRole, deleteJobRole, updateJobRole } from "@/server/admin-content";
import { useT } from "@/lib/i18n";

type Draft = {
  name: string;
  level: string;
  levelRank: string;
  gradeFrom: string;
  gradeTo: string;
};

const emptyDraft = (nextRank: number): Draft => ({
  name: "",
  level: "",
  levelRank: String(nextRank),
  gradeFrom: "",
  gradeTo: "",
});

/**
 * The career ladder — the job roles the expected-level matrix is keyed on.
 *
 * "Assessed on" is the real count of non-null `ExpectedLevel` cells for that
 * role, which is why a brand new role reads 0: it exists, people can hold it,
 * and it is measured against nothing until the framework says otherwise.
 */
export function JobRolesTab({
  rows,
  onResult,
}: {
  rows: JobRoleRow[];
  onResult: (result: ActionResult) => void;
}) {
  const { t, tt } = useT();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JobRoleRow | null>(null);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(rows.length + 1));
  const [confirm, setConfirm] = useState<JobRoleRow | null>(null);
  const [busy, startTransition] = useTransition();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.name} ${r.level} ${r.key}`.toLowerCase().includes(q));
  }, [rows, query]);

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

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function openAdd() {
    setDraft(emptyDraft(Math.max(0, ...rows.map((r) => r.levelRank)) + 1));
    setEditing(null);
    setOpen(true);
  }

  function openEdit(r: JobRoleRow) {
    setDraft({
      name: r.name,
      level: r.level,
      levelRank: String(r.levelRank),
      gradeFrom: r.gradeFrom,
      gradeTo: r.gradeTo,
    });
    setEditing(r);
    setOpen(true);
  }

  function save() {
    const payload = { ...draft };
    const target = editing;
    runForm(() =>
      target ? updateJobRole({ ...payload, jobRoleId: target.id }) : createJobRole(payload),
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 p-5">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder={tt("Search career roles...", "ค้นหาบทบาทสายอาชีพ...")}
          className="w-full sm:w-64"
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv(
                "1moby-career-roles.csv",
                [
                  t("label.role"),
                  t("label.level"),
                  tt("Rank", "ลำดับ"),
                  tt("Grade from", "เกรดเริ่ม"),
                  tt("Grade to", "เกรดสิ้นสุด"),
                  t("label.headcount"),
                  tt("Competencies assessed", "สมรรถนะที่ประเมิน"),
                ],
                visible.map((r) => [
                  r.name,
                  r.level,
                  r.levelRank,
                  r.gradeFrom,
                  r.gradeTo,
                  r.employeeCount,
                  r.assessedCount,
                ]),
              )
            }
          >
            <Download size={14} className="text-brand" />
            {t("action.exportCsv")}
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus size={15} />
            {tt("New role", "บทบาทใหม่")}
          </Button>
        </div>
      </div>

      <TableWrap>
        <table className="w-full min-w-[820px] xl:min-w-0 border-collapse">
          <thead>
            <tr className="border-y border-line/70 bg-surface/60">
              <Th>{t("label.role")}</Th>
              <Th>{t("label.level")}</Th>
              <Th>{t("label.grade")}</Th>
              <Th>{t("label.headcount")}</Th>
              <Th>{tt("Assessed on", "ประเมินสมรรถนะ")}</Th>
              <Th className="text-right">{t("label.actions")}</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className="border-b border-line/60 last:border-0">
                <Td className="font-bold">{r.name}</Td>
                <Td className="whitespace-nowrap text-muted">{r.level}</Td>
                <Td className="text-muted">
                  {r.gradeFrom === r.gradeTo ? r.gradeFrom : `${r.gradeFrom}–${r.gradeTo}`}
                </Td>
                <Td className="font-bold">{r.employeeCount}</Td>
                <Td>
                  <Pill tone={r.assessedCount ? "brand" : "warn"}>
                    {tt(
                      `${r.assessedCount} competencies`,
                      `${r.assessedCount} สมรรถนะ`,
                    )}
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
                <Td colSpan={6} className="py-10 text-center text-muted">
                  {t("admin.noMatch")}
                </Td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </TableWrap>

      <div className="p-5">
        <Note>
          {tt("A career role decides which competencies someone is assessed on and the level expected for each. Moving someone to another role changes both; a role with no expected levels is not assessed at all.",
            "บทบาทสายอาชีพเป็นตัวกำหนดว่าพนักงานถูกประเมินสมรรถนะใด และคาดหวังระดับเท่าไร การย้ายบทบาทจะเปลี่ยนทั้งสองอย่าง บทบาทที่ยังไม่กำหนดระดับที่คาดหวังจะไม่ถูกประเมินเลย",
          )}
        </Note>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          editing
            ? tt("Edit career role", "แก้ไขบทบาทสายอาชีพ")
            : tt("Create career role", "สร้างบทบาทสายอาชีพ")
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`${t("label.role")} *`} className="sm:col-span-2">
            <Input
              value={draft.name}
              placeholder="Team Lead"
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <Field label={`${t("label.level")} *`}>
            <Input
              value={draft.level}
              placeholder="Level 3: Supervise"
              onChange={(e) => set("level", e.target.value)}
            />
          </Field>
          <Field
            label={tt("Rank", "ลำดับขั้น")}
            hint={tt("1 is the most junior.", "1 คือระดับต่ำสุด")}
          >
            <Input
              type="number"
              min={1}
              value={draft.levelRank}
              onChange={(e) => set("levelRank", e.target.value)}
            />
          </Field>
          <Field label={tt("Grade from", "เกรดเริ่มต้น")}>
            <Input
              value={draft.gradeFrom}
              placeholder="EX1"
              onChange={(e) => set("gradeFrom", e.target.value)}
            />
          </Field>
          <Field label={tt("Grade to", "เกรดสิ้นสุด")}>
            <Input
              value={draft.gradeTo}
              placeholder="EX3"
              onChange={(e) => set("gradeTo", e.target.value)}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={tt("Delete career role", "ลบบทบาทสายอาชีพ")}
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
                if (target) run(() => deleteJobRole({ jobRoleId: target.id }));
              }}
            >
              {t("action.delete")}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          {tt("Delete", "ลบ")}{" "}
          <span className="font-medium text-ink">{confirm?.name}</span>?{" "}
          {confirm && confirm.employeeCount > 0
            ? tt(
                `${confirm.employeeCount} people hold it, so this will be refused until they are moved to another role.`,
                `มีพนักงาน ${confirm.employeeCount} คนอยู่ในบทบาทนี้ ระบบจะปฏิเสธจนกว่าจะย้ายไปบทบาทอื่นก่อน`,
              )
            : tt(
                `Its ${confirm?.assessedCount ?? 0} expected-level cells go with it.`,
                `ระดับที่คาดหวัง ${confirm?.assessedCount ?? 0} ช่องของบทบาทนี้จะถูกลบไปด้วย`,
              )}
        </p>
      </Modal>
    </div>
  );
}
