import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { getViewer } from "@/server/session";
import { homeFor } from "@/components/layout/nav";
import { SignOutButton } from "@/components/layout/SignOutButton";

export const dynamic = "force-dynamic";

/**
 * A Google account that signed in successfully but has not been linked to a
 * staff record. This is the normal first step for a new joiner, not an error.
 */
export default async function PendingPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.status === "ACTIVE" && (viewer.employeeId || viewer.permissions.length)) {
    redirect(homeFor(viewer));
  }

  return (
    <main className="grid min-h-screen place-items-center bg-surface/50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-10 text-center shadow-[0_10px_40px_rgba(16,24,40,.10)]">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand-tint text-brand">
          <Clock size={22} />
        </span>
        <h1 className="mt-4 text-xl font-medium text-ink">
          Waiting for approval
          <span className="mt-1 block text-base text-muted">รอการอนุมัติ</span>
        </h1>
        <p className="mt-3 text-sm text-muted">
          You are signed in as <strong className="text-ink">{viewer.email}</strong>,
          but this account has not been linked to an employee record yet. An
          administrator needs to approve it.
        </p>
        <p className="mt-2 text-sm text-muted">
          คุณเข้าสู่ระบบแล้ว แต่บัญชีนี้ยังไม่ได้เชื่อมกับข้อมูลพนักงาน
          กรุณารอผู้ดูแลระบบอนุมัติ
        </p>
        <div className="mt-6">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
