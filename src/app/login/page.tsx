import { redirect } from "next/navigation";
import { signInOptions } from "@/lib/auth";
import { LOGIN_DOMAIN } from "@/lib/login-id";
import { getViewer } from "@/server/session";
import { homeFor } from "@/components/layout/nav";
import { LoginForm } from "./LoginForm";
import { loadTestAccounts } from "@/server/test-accounts";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; code?: string; next?: string; notice?: string }>;
}) {
  // if the database cannot be reached, still show the sign-in screen and say
  // so, rather than a bare server error
  let unavailable = false;
  const viewer = await getViewer().catch(() => {
    unavailable = true;
    return null;
  });
  if (viewer && viewer.status === "ACTIVE") {
    redirect(homeFor(viewer));
  }

  const params = await searchParams;
  const demoAccounts = unavailable
    ? []
    : await loadTestAccounts().catch(() => {
        unavailable = true;
        return [];
      });
  const notice =
    params.notice === "activated" || params.notice === "password_changed"
      ? params.notice
      : undefined;

  return (
    <LoginForm
      loginDomain={LOGIN_DOMAIN}
      demoAccounts={demoAccounts}
      ssoName={signInOptions.sso}
      error={viewer?.status === "SUSPENDED" ? "suspended" : params.error}
      code={params.code}
      next={params.next}
      notice={notice}
      unavailable={unavailable}
    />
  );
}
