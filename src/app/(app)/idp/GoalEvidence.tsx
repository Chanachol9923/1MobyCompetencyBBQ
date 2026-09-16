"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Award,
  ExternalLink,
  Link2,
  Paperclip,
  Plus,
  StickyNote,
  Trash2,
} from "lucide-react";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { pick } from "@/components/learning/model";
import { useT } from "@/lib/i18n";
import type { CertificateOption, EvidenceItem } from "@/server/learning";
import {
  attachEvidenceAction,
  removeEvidenceAction,
  type AttachEvidenceInput,
  type EvidenceError,
} from "./actions";

type Kind = EvidenceItem["kind"];

const KIND_ICON: Record<Kind, typeof Award> = {
  CERTIFICATE: Award,
  LINK: Link2,
  NOTE: StickyNote,
};

/**
 * "แนบหลักฐานการเรียนรู้" — the employee's own record of what they did to close
 * the gap.
 *
 * The rows are `GoalEvidence` and every change goes through a server action:
 * the certificate picker only ever offers this viewer's real `Certificate`
 * rows, and the server re-checks the goal, the certificate and the link before
 * it writes. Nothing here decides what is allowed, only what to draw.
 */
export function GoalEvidencePanel({
  goalId,
  goalName,
  /** the course the manager put in the plan, for the one-click suggestion */
  planCourseId,
  items,
  certificates,
}: {
  goalId: string;
  goalName: string;
  planCourseId: string | null;
  items: EvidenceItem[];
  certificates: CertificateOption[];
}) {
  const { t, tt, lang } = useT();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("CERTIFICATE");
  const [certId, setCertId] = useState("");
  const [url, setUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<EvidenceError | null>(null);
  const [removing, setRemoving] = useState<EvidenceItem | null>(null);
  const [pending, startTransition] = useTransition();

  const attached = new Set(items.map((e) => `${e.kind}:${e.reference}`));
  /** the certificate this goal's own course already issued */
  const courseCertificate = planCourseId
    ? certificates.find(
        (c) =>
          c.courseId === planCourseId && !attached.has(`CERTIFICATE:${c.id}`),
      )
    : undefined;

  const dateFmt = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const kindLabel = (k: Kind) =>
    k === "CERTIFICATE"
      ? tt("Certificate", "ใบรับรอง")
      : k === "LINK"
        ? tt("Link", "ลิงก์")
        : t("label.notes");

  const errorText = (code: EvidenceError) =>
    ({
      not_authorised: tt(
        "You can only attach evidence to your own plan.",
        "คุณแนบหลักฐานได้เฉพาะในแผนพัฒนาของคุณเอง",
      ),
      invalid: tt("Check the form and try again.", "ตรวจสอบข้อมูลแล้วลองใหม่"),
      not_found: tt("That goal no longer exists.", "ไม่พบเป้าหมายนี้แล้ว"),
      bad_url: tt(
        "Enter a full link starting with http:// or https://",
        "กรุณากรอกลิงก์เต็มที่ขึ้นต้นด้วย http:// หรือ https://",
      ),
      short_note: tt(
        "Write a few words about what you did.",
        "กรุณาเขียนอธิบายสั้น ๆ ว่าคุณทำอะไรไปบ้าง",
      ),
      no_certificate: tt(
        "Choose one of your certificates.",
        "กรุณาเลือกใบรับรองของคุณหนึ่งรายการ",
      ),
      already_attached: tt(
        "That is already attached to this goal.",
        "หลักฐานนี้ถูกแนบกับเป้าหมายนี้อยู่แล้ว",
      ),
    })[code];

  const closeModal = () => {
    setOpen(false);
    setError(null);
    setCertId("");
    setUrl("");
    setLinkLabel("");
    setNote("");
  };

  const run = (input: AttachEvidenceInput, onDone?: () => void) => {
    setError(null);
    startTransition(async () => {
      const result = await attachEvidenceAction(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone?.();
      router.refresh();
    });
  };

  const save = () => {
    if (kind === "CERTIFICATE") {
      if (!certId) {
        setError("no_certificate");
        return;
      }
      run({ kind: "CERTIFICATE", goalId, certificateId: certId }, closeModal);
    } else if (kind === "LINK") {
      run({ kind: "LINK", goalId, url, label: linkLabel }, closeModal);
    } else {
      run({ kind: "NOTE", goalId, note }, closeModal);
    }
  };

  const remove = (item: EvidenceItem) => {
    setError(null);
    startTransition(async () => {
      const result = await removeEvidenceAction({ evidenceId: item.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRemoving(null);
      router.refresh();
    });
  };

  return (
    <div className="mt-4 rounded-lg border border-line/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-bold text-ink">
          <Paperclip size={15} className="shrink-0 text-muted" />
          {tt("Learning evidence", "หลักฐานการเรียนรู้")}
          <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">
            {items.length}
          </span>
        </span>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus size={14} /> {tt("Attach evidence", "แนบหลักฐาน")}
        </Button>
      </div>

      {items.length ? (
        <ul className="mt-3 space-y-2">
          {items.map((item) => {
            const Icon = KIND_ICON[item.kind];
            return (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-lg bg-surface px-3 py-2.5"
              >
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-brand-tint text-brand">
                  <Icon size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  {item.kind === "LINK" ? (
                    <a
                      href={item.reference}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-full items-center gap-1 truncate text-sm font-medium text-brand hover:underline"
                    >
                      <span className="truncate">{item.label}</span>
                      <ExternalLink size={12} className="shrink-0" />
                    </a>
                  ) : (
                    <p className="truncate text-sm font-medium text-ink">
                      {item.label}
                    </p>
                  )}
                  <p className="mt-0.5 text-[11px] text-muted">
                    {kindLabel(item.kind)}
                    {item.certificateScore !== null
                      ? ` · ${tt("Score", "คะแนน")} ${item.certificateScore}%`
                      : ""}
                    {item.certificateCode ? ` · ${item.certificateCode}` : ""}
                    {" · "}
                    {dateFmt(item.createdAt)}
                  </p>
                  {item.kind === "NOTE" ? (
                    <p className="mt-1 whitespace-pre-line text-xs text-muted">
                      {item.reference}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setRemoving(item)}
                  aria-label={tt(`Remove ${item.label}`, `ลบ ${item.label}`)}
                  className="grid size-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-white hover:text-accent max-lg:size-11"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted">
          {tt(
            "Nothing attached yet — add the certificate, a link or a short note describing what you did.",
            "ยังไม่มีหลักฐานแนบ — เพิ่มใบรับรอง ลิงก์ หรือบันทึกสั้น ๆ ว่าคุณทำอะไรไปบ้าง",
          )}
        </p>
      )}

      {/* the certificate this course already issued is the strongest evidence */}
      {courseCertificate && items.length === 0 ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-brand-tint px-3 py-2.5">
          <p className="min-w-0 text-xs text-brand">
            {tt(
              `You already earned a certificate for ${pick(lang, courseCertificate.titleEn, courseCertificate.titleTh)}.`,
              `คุณได้รับใบรับรองของหลักสูตร ${pick(lang, courseCertificate.titleEn, courseCertificate.titleTh)} แล้ว`,
            )}
          </p>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              run({
                kind: "CERTIFICATE",
                goalId,
                certificateId: courseCertificate.id,
              })
            }
          >
            <Award size={14} />
            {tt("Attach it", "แนบใบรับรองนี้")}
          </Button>
        </div>
      ) : null}

      {!open && error ? (
        <p className="mt-3 text-xs text-accent">{errorText(error)}</p>
      ) : null}

      {/* --------------------------------------------------------- attach */}
      <Modal
        open={open}
        onClose={closeModal}
        title={tt("Attach evidence", "แนบหลักฐานการเรียนรู้")}
        subtitle={tt(
          `Evidence for “${goalName}”`,
          `หลักฐานสำหรับ “${goalName}”`,
        )}
        width="max-w-lg"
        footer={
          <>
            <Button variant="outline" onClick={closeModal}>
              {t("action.cancel")}
            </Button>
            <Button onClick={save} disabled={pending}>
              {t("action.save")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={tt("Type of evidence", "ประเภทหลักฐาน")}>
            <Select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as Kind);
                setError(null);
              }}
            >
              <option value="CERTIFICATE">
                {tt("Certificate from the LMS", "ใบรับรองจากระบบการเรียนรู้")}
              </option>
              <option value="LINK">
                {tt("Link to your work", "ลิงก์ผลงานของคุณ")}
              </option>
              <option value="NOTE">{tt("Note", "บันทึกข้อความ")}</option>
            </Select>
          </Field>

          {kind === "CERTIFICATE" ? (
            certificates.length ? (
              <Field
                label={tt("Choose a certificate", "เลือกใบรับรอง")}
                hint={tt(
                  "Certificates are issued when you pass a course post-test.",
                  "ระบบจะออกใบรับรองให้เมื่อคุณผ่านแบบทดสอบหลังเรียน",
                )}
              >
                <Select
                  value={certId}
                  onChange={(e) => {
                    setCertId(e.target.value);
                    setError(null);
                  }}
                >
                  <option value="">{tt("Select…", "เลือก…")}</option>
                  {certificates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {pick(lang, c.titleEn, c.titleTh)}
                      {c.score !== null ? ` — ${c.score}%` : ""} ·{" "}
                      {c.issuedAt.slice(0, 10)}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <p className="rounded-lg bg-surface px-3 py-2.5 text-xs text-muted">
                {tt(
                  "You have no certificates yet. Finish a course and pass its post-test, or attach a link or a note instead.",
                  "คุณยังไม่มีใบรับรอง กรุณาเรียนจบหลักสูตรและผ่านแบบทดสอบหลังเรียน หรือแนบลิงก์หรือบันทึกแทน",
                )}
              </p>
            )
          ) : null}

          {kind === "LINK" ? (
            <>
              <Field
                label={tt("Link", "ลิงก์")}
                hint={tt(
                  "A full address starting with http:// or https://",
                  "ที่อยู่เต็มที่ขึ้นต้นด้วย http:// หรือ https://",
                )}
              >
                <Input
                  type="url"
                  inputMode="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError(null);
                  }}
                  placeholder="https://…"
                />
              </Field>
              <Field
                label={`${t("label.title")} (${tt("optional", "ไม่บังคับ")})`}
              >
                <Input
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
                  placeholder={tt("Workshop recap deck", "สไลด์สรุปเวิร์กช็อป")}
                />
              </Field>
            </>
          ) : null}

          {kind === "NOTE" ? (
            <Field
              label={t("label.notes")}
              hint={tt(
                "Describe the coaching session or on-the-job work you completed.",
                "อธิบายการโค้ชชิ่งหรือการฝึกจากงานจริงที่คุณทำ",
              )}
            >
              <Textarea
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setError(null);
                }}
                placeholder={tt(
                  "Ran the sprint retro for my squad on 12 May and wrote up the actions.",
                  "นำการประชุมสรุปสปรินต์ของทีมเมื่อ 12 พ.ค. และสรุปสิ่งที่ต้องทำต่อ",
                )}
              />
            </Field>
          ) : null}

          {error ? <p className="text-xs text-accent">{errorText(error)}</p> : null}
        </div>
      </Modal>

      {/* --------------------------------------------------------- remove */}
      <Modal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={tt("Remove this evidence?", "ลบหลักฐานนี้หรือไม่?")}
        width="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              {t("action.cancel")}
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => removing && remove(removing)}
            >
              {t("action.delete")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {tt(
            `“${removing?.label ?? ""}” will be detached from ${goalName}. Your certificate itself is not deleted.`,
            `“${removing?.label ?? ""}” จะถูกนำออกจากเป้าหมาย ${goalName} ทั้งนี้ใบรับรองของคุณจะไม่ถูกลบ`,
          )}
        </p>
      </Modal>
    </div>
  );
}
