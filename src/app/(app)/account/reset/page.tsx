import type { Metadata } from "next";
import { getViewer } from "@/server/session";
import { StartReset } from "./StartReset";

export const metadata: Metadata = { title: "Set a new password" };
export const dynamic = "force-dynamic";

/** Where the "set a new password" notification and banner lead. */
export default async function ResetPage() {
  const viewer = await getViewer();
  return (
    <StartReset loginId={viewer?.email ?? ""} expiresAt={viewer?.resetPendingUntil ?? null} />
  );
}
