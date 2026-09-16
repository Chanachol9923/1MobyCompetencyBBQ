import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { getViewer } from "@/server/session";
import { homeFor } from "@/components/layout/nav";

export const dynamic = "force-dynamic";

export default async function ForbiddenPage() {
  const viewer = await getViewer();
  const home = viewer ? homeFor(viewer) : "/login";

  return (
    <main className="grid min-h-screen place-items-center bg-surface/50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-10 text-center shadow-[0_10px_40px_rgba(16,24,40,.10)]">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent/10 text-accent">
          <ShieldAlert size={22} />
        </span>
        <h1 className="mt-4 text-xl font-medium text-ink">
          Not your screen
          <span className="mt-1 block text-base text-muted">คุณไม่มีสิทธิ์เข้าหน้านี้</span>
        </h1>
        <p className="mt-3 text-sm text-muted">
          Your role does not include this area. If you think it should, ask an
          administrator to adjust your permissions.
        </p>
        <p className="mt-2 text-sm text-muted">
          บทบาทของคุณไม่ครอบคลุมส่วนนี้ หากคิดว่าควรเข้าถึงได้
          กรุณาแจ้งผู้ดูแลระบบให้ปรับสิทธิ์
        </p>
        <Link
          href={home}
          className="mt-6 inline-flex h-11 items-center rounded-lg bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        >
          Back
        </Link>
      </div>
    </main>
  );
}
