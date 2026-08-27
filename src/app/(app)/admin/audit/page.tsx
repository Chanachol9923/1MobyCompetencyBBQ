"use client";

import { useCallback, useMemo, useState } from "react";
import { Download, History, RotateCcw, ShieldCheck, User } from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeading,
  Pill,
  Select,
} from "@/components/ui";
import {
  AdminOnly,
  CountTile,
  Note,
  SearchInput,
  TableWrap,
  Td,
  Th,
  downloadCsv,
  formatDateTime,
  isoDatePart,
} from "@/components/admin/shared";
import { PEOPLE } from "@/data/people";
import { useDemo, type ActivityEntry } from "@/lib/store";
import { useT } from "@/lib/i18n";

export default function AuditLogPage() {
  return (
    <AdminOnly>
      <AuditLog />
    </AdminOnly>
  );
}

const NAME_BY_ID = new Map(PEOPLE.map((p) => [p.id, p.name] as const));

function AuditLog() {
  const { state } = useDemo();
  const { t, tt } = useT();

  const [query, setQuery] = useState("");
  const [actor, setActor] = useState("all");
  const [action, setAction] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const log = state.activityLog;

  /** ids that actually appear in the log, so the filter never offers a dead option */
  const actors = useMemo(() => {
    const ids = Array.from(new Set(log.map((e) => e.actor)));
    return ids.map((id) => ({ id, name: NAME_BY_ID.get(id) ?? id }));
  }, [log]);

  const actions = useMemo(
    () => Array.from(new Set(log.map((e) => e.action))).sort(),
    [log],
  );

  const actorName = useCallback(
    (id: string) =>
      id === "system" ? tt("System", "ระบบ") : (NAME_BY_ID.get(id) ?? id),
    [tt],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return log.filter((e) => {
      const day = isoDatePart(e.at);
      const matchQ =
        !q ||
        [e.action, e.target, e.detail ?? "", actorName(e.actor)].some((v) =>
          v.toLowerCase().includes(q),
        );
      const matchActor = actor === "all" || e.actor === actor;
      const matchAction = action === "all" || e.action === action;
      const matchFrom = !from || day >= from;
      const matchTo = !to || day <= to;
      return matchQ && matchActor && matchAction && matchFrom && matchTo;
    });
  }, [log, query, actor, action, from, to, actorName]);

  const filtersOn =
    Boolean(query.trim()) ||
    actor !== "all" ||
    action !== "all" ||
    Boolean(from) ||
    Boolean(to);

  function resetFilters() {
    setQuery("");
    setActor("all");
    setAction("all");
    setFrom("");
    setTo("");
  }

  function exportLog() {
    downloadCsv(
      "1moby-activity-log.csv",
      [
        tt("Timestamp", "เวลา"),
        tt("Actor ID", "รหัสผู้ดำเนินการ"),
        t("label.actor"),
        t("label.action"),
        t("label.target"),
        t("label.detail"),
      ],
      visible.map((e: ActivityEntry) => [
        e.at,
        e.actor,
        actorName(e.actor),
        e.action,
        e.target,
        e.detail ?? "",
      ]),
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading
        title={t("nav.auditLog")}
        subtitle={tt(
          "Every state-changing action in the demo, newest first.",
          "ทุกการกระทำที่เปลี่ยนแปลงข้อมูลในระบบสาธิต เรียงจากใหม่ไปเก่า",
        )}
        right={
          <Button variant="outline" onClick={exportLog} disabled={!visible.length}>
            <Download size={15} className="text-brand" />
            {t("action.exportCsv")}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <CountTile
          value={log.length}
          label={tt("Recorded events", "เหตุการณ์ที่บันทึกไว้")}
          icon={<History size={20} />}
        />
        <CountTile
          value={actors.length}
          label={tt("Distinct actors", "ผู้ดำเนินการ")}
          tone="amber"
          icon={<User size={20} />}
        />
        <CountTile
          value={actions.length}
          label={tt("Action types", "ประเภทการกระทำ")}
          tone="success"
          icon={<ShieldCheck size={20} />}
        />
      </div>

      {/* ------------------------------------------------------- filters */}
      <Card className="mt-5 p-5">
        <div className="grid gap-3 lg:grid-cols-5 sm:grid-cols-2">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink">
              {t("action.search")}
            </span>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder={tt("Search action or target...", "ค้นหาการกระทำหรือเป้าหมาย...")}
            />
          </div>
          <Field label={t("label.actor")}>
            <Select value={actor} onChange={(e) => setActor(e.target.value)}>
              <option value="all">{tt("All actors", "ผู้ดำเนินการทั้งหมด")}</option>
              {actors.map((a) => (
                <option key={a.id} value={a.id}>
                  {actorName(a.id)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("label.action")}>
            <Select value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="all">{tt("All actions", "การกระทำทั้งหมด")}</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={tt("From", "ตั้งแต่วันที่")}>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label={tt("To", "ถึงวันที่")}>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">
            {tt(
              `Showing ${visible.length} of ${log.length} events`,
              `แสดง ${visible.length} จาก ${log.length} เหตุการณ์`,
            )}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            disabled={!filtersOn}
          >
            <RotateCcw size={14} />
            {t("action.reset")}
          </Button>
        </div>
      </Card>

      {/* --------------------------------------------------------- table */}
      <Card className="mt-5">
        <TableWrap>
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr className="border-b border-line/70 bg-surface/60">
                <Th className="w-44">{tt("Timestamp", "เวลา")}</Th>
                <Th className="w-44">{t("label.actor")}</Th>
                <Th>{t("label.action")}</Th>
                <Th>{t("label.target")}</Th>
                <Th>{t("label.detail")}</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => (
                <tr key={e.id} className="border-b border-line/60 last:border-0">
                  <Td className="whitespace-nowrap text-muted">
                    {formatDateTime(e.at)}
                  </Td>
                  <Td>
                    <span className="block font-bold">{actorName(e.actor)}</span>
                    <span className="block text-[10px] text-muted">{e.actor}</span>
                  </Td>
                  <Td>
                    <Pill tone="brand">{e.action}</Pill>
                  </Td>
                  <Td className="font-bold">{e.target}</Td>
                  <Td className="max-w-[280px] text-muted">{e.detail ?? "—"}</Td>
                </tr>
              ))}
              {visible.length === 0 ? (
                <tr>
                  <Td colSpan={5}>
                    <EmptyState
                      title={
                        log.length === 0
                          ? tt("No activity recorded yet", "ยังไม่มีการบันทึกกิจกรรม")
                          : t("admin.noMatch")
                      }
                      hint={
                        log.length === 0
                          ? tt(
                              "Actions taken anywhere in the demo appear here.",
                              "การกระทำต่าง ๆ ในระบบสาธิตจะปรากฏที่นี่",
                            )
                          : tt(
                              "Clear a filter or widen the date range.",
                              "ลองล้างตัวกรองหรือขยายช่วงวันที่",
                            )
                      }
                    />
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableWrap>
        <div className="border-t border-line/70 p-5">
          <Note>
            {tt(
              "Retention: demo only. The trail keeps the last 200 events in this browser's local storage and is cleared when the demo is reset — a production deployment would write to an append-only audit store with a retention policy.",
              "การเก็บข้อมูล: สำหรับเวอร์ชันสาธิตเท่านั้น ระบบเก็บเหตุการณ์ล่าสุด 200 รายการไว้ในเบราว์เซอร์นี้ และจะถูกล้างเมื่อรีเซ็ตระบบสาธิต — ระบบจริงจะบันทึกลงฐานข้อมูลตรวจสอบแบบเพิ่มอย่างเดียวพร้อมนโยบายการเก็บรักษา",
            )}
          </Note>
        </div>
      </Card>
    </div>
  );
}
