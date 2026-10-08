import type { Metadata } from "next";
import { Suspense } from "react";
import { requireViewer } from "@/server/session";
import { listMyProblems } from "@/server/problems";
import { MyProblemsScreen } from "@/components/problems/MyProblemsScreen";

export const metadata: Metadata = { title: "My problem reports" };

export const dynamic = "force-dynamic";

/** Open to everyone signed in: it only ever lists the viewer's own reports. */
export default async function MyProblemsPage() {
  await requireViewer();
  const problems = await listMyProblems();
  return (
    <Suspense>
      <MyProblemsScreen problems={problems} />
    </Suspense>
  );
}
