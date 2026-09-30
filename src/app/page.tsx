import { redirect } from "next/navigation";
import { getViewer } from "@/server/session";
import { homeFor } from "@/components/layout/nav";

export const dynamic = "force-dynamic";

/** "/" is where sign-in lands: straight on to the home screen this person's permissions give them. */
export default async function RootPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.status !== "ACTIVE") redirect("/login");
  redirect(homeFor(viewer));
}
