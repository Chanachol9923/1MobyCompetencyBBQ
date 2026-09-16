"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
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
  Textarea,
} from "@/components/ui";
import { MatrixLegend, RolesTab } from "@/components/admin/RolesTab";
import { PropagationNote, ResultBanner } from "@/components/admin/rbac-shared";
import type { ActionResult, RolesScreenData, RoleSummary } from "@/components/admin/admin-types";
import { createRole, deleteRole, updateRole } from "@/server/admin-users";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Roles and permissions, persisted.
 *
 * The roles are rows in the database and so are their permissions, so this is
 * the screen that actually decides what every account in the organisation can
 * do. A system role can be renamed but not deleted — `employee`, `manager` and
 * `admin` are keys the sign-in callback reaches for by name — and deleting a
 * custom role makes the admin say where its people go, rather than quietly
 * leaving accounts with no role and therefore no permissions at all.
 */
export function RolesScreen({ data }: { data: RolesScreenData }) {
  const { t, tt } = useT();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<RoleSummary | null>(null);
  const [deleting, setDeleting] = useState<RoleSummary | null>(null);

  const { roles, permissions, viewerRoleId } = data;

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading
        title={tt("Roles & permissions", "บทบาทและสิทธิ์การใช้งาน")}
        subtitle={tt(
          "Roles are data, not code. What you set here is what the server enforces on every request.",
          "บทบาทเป็นข้อมูลในฐานข้อมูล ไม่ใช่โค้ด สิ่งที่กำหนดที่นี่คือสิ่งที่เซิร์ฟเวอร์บังคับใช้ในทุกคำขอ",
        )}
        right={
          <Button onClick={() => setCreating(true)}>
            <Plus size={15} />
            {tt("New role", "สร้างบทบาทใหม่")}
          </Button>
        }
      />

      <ResultBanner result={result} onDismiss={() => setResult(null)} />

      {/* ------------------------------------------------------ role cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((r) => (
          <Card key={r.id} className="flex flex-col gap-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">
                  {tt(r.nameEn, r.nameTh)}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-muted">{r.key}</p>
              </div>
              {r.isSystem ? (
                <Pill tone="neutral">{tt("System", "ของระบบ")}</Pill>
              ) : (
                <Pill tone="brand">{tt("Custom", "กำหนดเอง")}</Pill>
              )}
            </div>

            <p className="min-h-8 text-xs leading-relaxed text-muted">
              {r.description ?? tt("No description.", "ไม่มีคำอธิบาย")}
            </p>

            <div className="flex items-end justify-between gap-3 border-t border-line/60 pt-3">
              <p className="text-2xl font-bold text-brand">
                {r.userCount}
                <span className="ml-1 text-xs font-medium text-muted">
                  {tt(r.userCount === 1 ? "account" : "accounts", "บัญชี")}
                </span>
              </p>
              <p className="text-xs text-muted">
                {r.permissionIds.length}/{permissions.length}{" "}
                {tt("permissions", "สิทธิ์")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
                <Pencil size={13} />
                {t("action.edit")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={r.isSystem || r.id === viewerRoleId}
                title={
                  r.isSystem
                    ? tt("System roles cannot be deleted.", "บทบาทของระบบลบไม่ได้")
                    : r.id === viewerRoleId
                      ? tt(
                          "This is the role your own account holds.",
                          "นี่คือบทบาทที่บัญชีของคุณใช้อยู่",
                        )
                      : undefined
                }
                onClick={() => setDeleting(r)}
              >
                <Trash2 size={13} />
                {t("action.delete")}
              </Button>
              {r.id === viewerRoleId ? (
                <span className="ml-auto text-[10px] text-muted">
                  {tt("your role", "บทบาทของคุณ")}
                </span>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      {/* --------------------------------------------------------- matrix */}
      <Card className="mt-5">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <ShieldCheck size={18} className="text-brand" />
              {tt("Permission matrix", "ตารางสิทธิ์การใช้งาน")}
            </span>
          }
          subtitle={tt(
            "Each switch is a row in the database. Toggling one saves at once — there is no Save button to forget.",
            "สวิตช์แต่ละตัวคือข้อมูลหนึ่งแถวในฐานข้อมูล การสลับจะบันทึกทันที ไม่ต้องกดปุ่มบันทึก",
          )}
        />
        <RolesTab
          roles={roles}
          permissions={permissions}
          viewerRoleId={viewerRoleId}
          onResult={setResult}
        />
        <div className="space-y-3 border-t border-line/70 p-5">
          <MatrixLegend />
          <PropagationNote />
        </div>
      </Card>

      {creating ? (
        <CreateRoleModal
          onClose={() => setCreating(false)}
          onResult={(res) => {
            setResult(res);
            if (res.ok) setCreating(false);
          }}
        />
      ) : null}

      {editing ? (
        <EditRoleModal
          role={editing}
          onClose={() => setEditing(null)}
          onResult={(res) => {
            setResult(res);
            if (res.ok) setEditing(null);
          }}
        />
      ) : null}

      {deleting ? (
        <DeleteRoleModal
          role={deleting}
          roles={roles}
          onClose={() => setDeleting(null)}
          onResult={(res) => {
            setResult(res);
            if (res.ok) setDeleting(null);
          }}
        />
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- create */

function CreateRoleModal({
  onClose,
  onResult,
}: {
  onClose: () => void;
  onResult: (result: ActionResult) => void;
}) {
  const { t, tt } = useT();
  const [key, setKey] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameTh, setNameTh] = useState("");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <Modal
      open
      onClose={onClose}
      title={tt("Create a role", "สร้างบทบาทใหม่")}
      subtitle={tt(
        "It starts with no permissions — grant them in the matrix.",
        "บทบาทใหม่จะยังไม่มีสิทธิ์ใด ๆ กำหนดได้ที่ตารางสิทธิ์",
      )}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                onResult(await createRole({ key, nameEn, nameTh, description }));
              })
            }
          >
            {t("action.create")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field
          label={tt("Key", "คีย์")}
          hint={tt(
            "Lower case letters, digits, - or _. This is what code refers to and it cannot be changed later.",
            "ตัวพิมพ์เล็ก ตัวเลข - หรือ _ เท่านั้น คีย์นี้คือสิ่งที่โค้ดอ้างอิงและแก้ไขภายหลังไม่ได้",
          )}
        >
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value.toLowerCase())}
            placeholder="hr-viewer"
          />
        </Field>
        <Field label={tt("Name (English)", "ชื่อ (อังกฤษ)")}>
          <Input
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder="HR Viewer"
          />
        </Field>
        <Field label={tt("Name (Thai)", "ชื่อ (ไทย)")}>
          <Input
            value={nameTh}
            onChange={(e) => setNameTh(e.target.value)}
            placeholder="ผู้ดูข้อมูลฝ่ายบุคคล"
          />
        </Field>
        <Field label={t("label.description")}>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={tt(
              "Who is this role for?",
              "บทบาทนี้สำหรับใคร",
            )}
          />
        </Field>
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------------- edit */

function EditRoleModal({
  role,
  onClose,
  onResult,
}: {
  role: RoleSummary;
  onClose: () => void;
  onResult: (result: ActionResult) => void;
}) {
  const { t, tt } = useT();
  const [nameEn, setNameEn] = useState(role.nameEn);
  const [nameTh, setNameTh] = useState(role.nameTh);
  const [description, setDescription] = useState(role.description ?? "");
  const [pending, startTransition] = useTransition();

  return (
    <Modal
      open
      onClose={onClose}
      title={tt("Edit role", "แก้ไขบทบาท")}
      subtitle={role.key}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                onResult(
                  await updateRole({ roleId: role.id, nameEn, nameTh, description }),
                );
              })
            }
          >
            {t("action.save")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label={tt("Name (English)", "ชื่อ (อังกฤษ)")}>
          <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        </Field>
        <Field label={tt("Name (Thai)", "ชื่อ (ไทย)")}>
          <Input value={nameTh} onChange={(e) => setNameTh(e.target.value)} />
        </Field>
        <Field label={t("label.description")}>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <p className="rounded-lg bg-surface px-3 py-2 text-[11px] leading-relaxed text-muted">
          {tt(
            `The key "${role.key}" cannot be changed — sign-in and seeding look roles up by it.`,
            `คีย์ "${role.key}" แก้ไขไม่ได้ เพราะระบบเข้าสู่ระบบและการสร้างข้อมูลเริ่มต้นอ้างอิงบทบาทจากคีย์นี้`,
          )}
        </p>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------------- delete */

/**
 * Deleting a role that people hold is a re-homing, not a delete: the schema
 * would happily set those users' `roleId` to null and leave them with no
 * permissions at all, so the admin has to name the role they move to.
 */
function DeleteRoleModal({
  role,
  roles,
  onClose,
  onResult,
}: {
  role: RoleSummary;
  roles: RoleSummary[];
  onClose: () => void;
  onResult: (result: ActionResult) => void;
}) {
  const { t, tt } = useT();
  const alternatives = roles.filter((r) => r.id !== role.id);
  const [target, setTarget] = useState(alternatives[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const needsTarget = role.userCount > 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={tt("Delete this role?", "ลบบทบาทนี้?")}
      subtitle={tt(role.nameEn, role.nameTh)}
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button
            variant="danger"
            disabled={pending || (needsTarget && !target)}
            onClick={() =>
              startTransition(async () => {
                onResult(
                  await deleteRole({
                    roleId: role.id,
                    reassignToRoleId: needsTarget ? target : "",
                  }),
                );
              })
            }
          >
            {t("action.delete")}
          </Button>
        </>
      }
    >
      {needsTarget ? (
        <>
          <p
            className={cn(
              "flex items-center gap-2 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-xs text-ink",
            )}
          >
            <Users size={14} className="shrink-0 text-amber" />
            {tt(
              `${role.userCount} account(s) hold this role. Choose where they go — an account with no role can do nothing at all.`,
              `มี ${role.userCount} บัญชีที่ใช้บทบาทนี้ กรุณาเลือกบทบาทปลายทาง เพราะบัญชีที่ไม่มีบทบาทจะใช้งานอะไรไม่ได้เลย`,
            )}
          </p>
          <Field className="mt-4" label={tt("Move those accounts to", "ย้ายบัญชีเหล่านี้ไปยัง")}>
            <Select value={target} onChange={(e) => setTarget(e.target.value)}>
              {alternatives.map((r) => (
                <option key={r.id} value={r.id}>
                  {tt(r.nameEn, r.nameTh)}
                </option>
              ))}
            </Select>
          </Field>
        </>
      ) : (
        <p className="text-sm leading-relaxed text-muted">
          {tt(
            "No account holds this role, so nothing moves. The permissions attached to it are removed with it.",
            "ไม่มีบัญชีใดใช้บทบาทนี้ จึงไม่มีการย้ายข้อมูล สิทธิ์ที่ผูกกับบทบาทนี้จะถูกลบไปพร้อมกัน",
          )}
        </p>
      )}
    </Modal>
  );
}
