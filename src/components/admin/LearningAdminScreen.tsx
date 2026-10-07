"use client";

import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Clapperboard, FileText } from "lucide-react";
import { PageHeading, Tabs } from "@/components/ui";
import { LmsAdminScreen } from "@/components/admin/LmsAdminScreen";
import { DocumentsAdmin, ShortsAdmin } from "@/components/admin/MediaAdminScreen";
import type { LmsAdminData } from "@/components/admin/content-types";
import type { MediaAdminData } from "@/components/learning/media-types";
import { useT } from "@/lib/i18n";

export type LearningAdminTab = "courses" | "shorts" | "documents";

/**
 * Everything employees learn from, managed in one place — the same three
 * formats, in the same order, as the tabs they see on the Learning page.
 */
export function LearningAdminScreen({
  tab,
  courses,
  media,
}: {
  tab: LearningAdminTab;
  courses: LmsAdminData;
  media: MediaAdminData;
}) {
  const { tt } = useT();
  const router = useRouter();
  const pathname = usePathname();

  const label = (Icon: typeof BookOpen, text: string, count: number) => (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={15} /> {text}
      <span className="rounded-full bg-surface px-1.5 text-[11px] text-muted">{count}</span>
    </span>
  );

  return (
    <div className="mx-auto max-w-[1200px] p-6 lg:p-10">
      <PageHeading
        title={tt("Manage learning", "จัดการการเรียนรู้")}
        subtitle={tt(
          "Courses, one-minute shorts and PDF documents — everything employees find under Learning.",
          "หลักสูตร คลิปสั้น และเอกสาร PDF — ทุกอย่างที่พนักงานเห็นในหมวดการเรียนรู้",
        )}
      />
      <Tabs
        className="mb-6 gap-4 overflow-x-auto whitespace-nowrap [scrollbar-width:none] sm:gap-6"
        variant="underline"
        value={tab}
        onChange={(next) =>
          router.replace(next === "courses" ? pathname : `${pathname}?tab=${next}`, { scroll: false })
        }
        options={[
          { value: "courses" as const, label: label(BookOpen, tt("Courses", "หลักสูตร"), courses.counts.total) },
          { value: "shorts" as const, label: label(Clapperboard, "Shorts", media.shorts.length) },
          {
            value: "documents" as const,
            label: label(FileText, tt("Documents", "เอกสาร"), media.documents.length),
          },
        ]}
      />
      {tab === "shorts" ? (
        <ShortsAdmin data={media} />
      ) : tab === "documents" ? (
        <DocumentsAdmin data={media} />
      ) : (
        <LmsAdminScreen data={courses} />
      )}
    </div>
  );
}
