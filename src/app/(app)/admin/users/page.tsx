import { redirect } from "next/navigation";

/** Accounts now live under Employee. */
export default function AdminUsersPage() {
  redirect("/admin/employee/accounts");
}
