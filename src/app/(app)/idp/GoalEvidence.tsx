"use client";

import { useState } from "react";
import {
  Award,
  ExternalLink,
  Link2,
  Paperclip,
  Plus,
  StickyNote,
  Trash2,
} from "lucide-react";
import {
  Button,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
} from "@/components/ui";
import { useT } from "@/lib/i18n";
import { useDemo, type GoalEvidence, type IdpGoal } from "@/lib/store";

type Kind = GoalEvidence["kind"];

const KIND_ICON: Record<Kind, typeof Award> = {
  certificate: Award,
  link: Link2,
  note: StickyNote,
};

const newId = () =>
  `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const isHttpUrl = (value: string) => {
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * "แนบหลักฐานการเรียนรู้" — the employee's own record of what they did to close
 * the gap. Certificates already issued by the LMS are the strongest evidence,
 * so they get a picker and a one-click suggestion; links and notes cover
 * coaching, on-the-job work and anything the LMS never saw.
 */
export function GoalEvidencePanel({
  goal,
  personId,
}: {
  goal: IdpGoal;
  personId: string;
}) {
  const { state, update, notify, logActivity } = useDemo();
  const { t, tt, lang } = useT();

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("certificate");
  const [certId, setCertId] = useState("");
  const [url, setUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<GoalEvidence | null>(null);

  const items = goal.evidence ?? [];
  const myCertificates = state.certificates.filter(
    (c) => c.personId === personId,
  );
  const attached = new Set(items.map((e) => `${e.kind}:${e.ref}`));
  const courseCertificate = myCertificates.find(
    (c) => c.courseId === goal.courseId && !attached.has(`certificate:${c.id}`),
  );

  const dateFmt = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const kindLabel = (k: Kind) =>
    k === "certificate"
      ? tt("Certificate", "ใบรับรอง")
      : k === "link"
        ? tt("Link", "ลิงก์")
        : t("label.notes");

  /** immutable write into this person's own plan */
  const writeEvidence = (next: (prev: GoalEvidence[]) => GoalEvidence[]) =>
    update((s) => ({
      ...s,
      idp: {
        ...s.idp,
        [personId]: (s.idp[personId] ?? []).map((g) =>
          g.id === goal.id ? { ...g, evidence: next(g.evidence ?? []) } : g,
        ),
      },
    }));

  const attach = (draft: Omit<GoalEvidence, "id" | "addedAt">) => {
    writeEvidence((prev) => [
      ...prev,
      { ...draft, id: newId(), addedAt: new Date().toISOString().slice(0, 10) },
    ]);
    logActivity(
      "Attached learning evidence",
      goal.competencyName,
      `${kindLabel(draft.kind)} · ${draft.label}`,
    );
    notify(
      tt(
        `Evidence attached to ${goal.competencyName}`,
        `แนบหลักฐานให้เป้าหมาย ${goal.competencyName} แล้ว`,
      ),
    );
  };

  const closeModal = () => {
    setOpen(false);
    setError(null);
    setCertId("");
    setUrl("");
    setLinkLabel("");
    setNote("");
  };

  const save = () => {
    if (kind === "certificate") {
      const certificate = myCertificates.find((c) => c.id === certId);
      if (!certificate) {
        setError(
          tt(
            "Choose one of your certificates.",
            "กรุณาเลือกใบรับรองของคุณหนึ่งรายการ",
          ),
        );
        return;
      }
      attach({
        kind,
        label: certificate.courseTitle,
        ref: certificate.id,
      });
    } else if (kind === "link") {
      if (!isHttpUrl(url)) {
        setError(
          tt(
            "Enter a full link starting with http:// or https://",
            "กรุณากรอกลิงก์เต็มที่ขึ้นต้นด้วย http:// หรือ https://",
          ),
        );
        return;
      }
      const href = url.trim();
      attach({
        kind,
        label: linkLabel.trim() || new URL(href).hostname,
        ref: href,
      });
    } else {
      const body = note.trim();
      if (body.length < 4) {
        setError(
          tt(
            "Write a few words about what you did.",
            "กรุณาเขียนอธิบายสั้น ๆ ว่าคุณทำอะไรไปบ้าง",
          ),
        );
        return;
      }
      attach({
        kind,
        label: body.length > 60 ? `${body.slice(0, 57)}…` : body,
        ref: body,
      });
    }
    closeModal();
  };

  const remove = (item: GoalEvidence) => {
    writeEvidence((prev) => prev.filter((e) => e.id !== item.id));
    logActivity(
      "Removed learning evidence",
      goal.competencyName,
      `${kindLabel(item.kind)} · ${item.label}`,
    );
    notify(tt("Evidence removed", "ลบหลักฐานแล้ว"));
    setRemoving(null);
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
            const certificate =
              item.kind === "certificate"
                ? state.certificates.find((c) => c.id === item.ref)
                : undefined;
            return (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-lg bg-surface px-3 py-2.5"
              >
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-brand-tint text-brand">
                  <Icon size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  {item.kind === "link" ? (
                    <a
                      href={item.ref}
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
                    {certificate
                      ? ` · ${tt("Score", "คะแนน")} ${certificate.score}%`
                      : ""}
                    {" · "}
                    {dateFmt(item.addedAt)}
                  </p>
                  {item.kind === "note" ? (
                    <p className="mt-1 whitespace-pre-line text-xs text-muted">
                      {item.ref}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setRemoving(item)}
                  aria-label={tt(
                    `Remove ${item.label}`,
                    `ลบ ${item.label}`,
                  )}
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
              `You already earned a certificate for ${courseCertificate.courseTitle}.`,
              `คุณได้รับใบรับรองของหลักสูตร ${courseCertificate.courseTitle} แล้ว`,
            )}
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              attach({
                kind: "certificate",
                label: courseCertificate.courseTitle,
                ref: courseCertificate.id,
              })
            }
          >
            <Award size={14} />
            {tt("Attach it", "แนบใบรับรองนี้")}
          </Button>
        </div>
      ) : null}

      {/* --------------------------------------------------------- attach */}
      <Modal
        open={open}
        onClose={closeModal}
        title={tt("Attach evidence", "แนบหลักฐานการเรียนรู้")}
        subtitle={tt(
          `Evidence for “${goal.competencyName}”`,
          `หลักฐานสำหรับ “${goal.competencyName}”`,
        )}
        width="max-w-lg"
        footer={
          <>
            <Button variant="outline" onClick={closeModal}>
              {t("action.cancel")}
            </Button>
            <Button onClick={save}>{t("action.save")}</Button>
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
              <option value="certificate">
                {tt("Certificate from the LMS", "ใบรับรองจากระบบการเรียนรู้")}
              </option>
              <option value="link">
                {tt("Link to your work", "ลิงก์ผลงานของคุณ")}
              </option>
              <option value="note">
                {tt("Note", "บันทึกข้อความ")}
              </option>
            </Select>
          </Field>

          {kind === "certificate" ? (
            myCertificates.length ? (
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
                  <option value="">
                    {tt("Select…", "เลือก…")}
                  </option>
                  {myCertificates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.courseTitle} — {c.score}% · {c.issuedAt}
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

          {kind === "link" ? (
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
                  placeholder={tt(
                    "Workshop recap deck",
                    "สไลด์สรุปเวิร์กช็อป",
                  )}
                />
              </Field>
            </>
          ) : null}

          {kind === "note" ? (
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

          {error ? <p className="text-xs text-accent">{error}</p> : null}
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
              onClick={() => removing && remove(removing)}
            >
              {t("action.delete")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {tt(
            `“${removing?.label ?? ""}” will be detached from ${goal.competencyName}. Your certificate itself is not deleted.`,
            `“${removing?.label ?? ""}” จะถูกนำออกจากเป้าหมาย ${goal.competencyName} ทั้งนี้ใบรับรองของคุณจะไม่ถูกลบ`,
          )}
        </p>
      </Modal>
    </div>
  );
}
