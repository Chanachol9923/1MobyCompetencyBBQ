import type { Metadata } from "next";
import { inspectLink } from "@/server/account";
import { ActivateForm } from "./ActivateForm";

export const metadata: Metadata = { title: "Activate account" };
export const dynamic = "force-dynamic";

/**
 * Where an activation or reset link lands. Looking at the page does not spend
 * the link — only setting the password does — so a mail scanner that pre-fetches
 * URLs cannot burn it before the person clicks.
 */
export default async function ActivatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const link = await inspectLink(token);
  return <ActivateForm token={token} link={link} />;
}
