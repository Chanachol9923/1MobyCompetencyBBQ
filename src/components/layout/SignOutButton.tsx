"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function SignOutButton({ label = "Sign out · ออกจากระบบ" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => void signOut({ redirectTo: "/login" })}
      className="inline-flex h-11 items-center gap-2 rounded-lg border border-line px-5 text-sm font-medium text-ink transition-colors hover:bg-surface"
    >
      <LogOut size={15} />
      {label}
    </button>
  );
}
