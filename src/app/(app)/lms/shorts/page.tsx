import type { Metadata } from "next";
import { requireEmployee } from "@/server/session";
import { getShortsFeed } from "@/server/learning-media";
import { ShortsFeed } from "@/components/learning/ShortsFeed";
import { ShortsEmpty } from "./ShortsEmpty";

export const metadata: Metadata = { title: "Shorts · 1Moby" };

/** The Reels-style feed. `?s=<id>` opens it on one short (a shared link). */
export default async function ShortsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireEmployee();
  const { s } = await searchParams;
  const { shorts } = await getShortsFeed();
  if (!shorts.length) return <ShortsEmpty />;
  return <ShortsFeed shorts={shorts} startId={typeof s === "string" ? s : undefined} />;
}
