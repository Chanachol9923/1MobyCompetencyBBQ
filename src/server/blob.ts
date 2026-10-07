import "server-only";
import { del } from "@vercel/blob";

/** Files we accept on a record: only ones from our own public Blob store. */
export const BLOB_URL = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//i;

/**
 * Delete files nothing points at any more. A failure here is logged and
 * swallowed: an orphaned file costs a little storage, a failed save costs work.
 */
export async function removeBlobs(urls: (string | null | undefined)[]) {
  const list = [...new Set(urls.filter((u): u is string => Boolean(u) && BLOB_URL.test(u!)))];
  if (!list.length || !process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    await del(list);
  } catch (err) {
    console.error("blob delete failed", err);
  }
}
