import { redirect } from "next/navigation";

/** The library itself is a tab of the learning hub. */
export default function DocumentsIndex() {
  redirect("/lms?view=documents");
}
