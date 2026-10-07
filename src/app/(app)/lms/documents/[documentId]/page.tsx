import type { Metadata } from "next";
import { requireEmployee } from "@/server/session";
import { getDocument } from "@/server/learning-media";
import { MissingCard } from "../../MissingCard";
import { DocumentReaderView } from "./DocumentReaderView";

export const metadata: Metadata = { title: "Document · 1Moby" };

/**
 * One document, opened at the page this person stopped on. Reading progress is
 * the viewer's own: `getDocument` takes the employee from the session.
 */
export default async function DocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  await requireEmployee();
  const { documentId } = await params;
  const doc = await getDocument(documentId);
  if (!doc) return <MissingCard kind="document" />;
  return <DocumentReaderView doc={doc} />;
}
