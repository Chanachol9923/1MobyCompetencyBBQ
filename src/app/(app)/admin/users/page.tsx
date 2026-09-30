import { redirect } from "next/navigation";

/** Accounts moved into Manage Employee, as a tab next to the staff records. */
export default function AdminUsersPage() {
  redirect("/admin/employee?tab=accounts");
}
