import type { Metadata } from "next";
import { requireEmployee } from "@/server/session";
import { getDocument } from "@/server/learning-media";
import { MissingCard } from "../../MissingCard";
import { DocumentReaderView } from "./DocumentReaderView";

export const metadata: Metadata = { title: "Document" };

/**
 * One document, opened at the page this person stopped on. Reading progress is
 * the viewer's own: `getDocument` takes the employee from the session.
 */
export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  await requireEmployee();
  const [{ documentId }, { page }] = await Promise.all([params, searchParams]);
  const doc = await getDocument(documentId);
  if (!doc) return <MissingCard kind="document" />;
  // the study assistant links to the page it quoted
  const asked = Number(page);
  const at = Number.isInteger(asked) && asked >= 1 && asked <= doc.pages ? asked : doc.lastPage;
  return <DocumentReaderView key={at} doc={{ ...doc, lastPage: at }} />;
}
