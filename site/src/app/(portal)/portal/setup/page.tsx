import type { Metadata } from "next";
import { AuthPage, signInHref } from "@/components/portal/auth/auth-page";
import { ResetFlow } from "@/components/portal/auth/reset-flow";
import { safeNextPath } from "@/lib/auth/next-path";

export const metadata: Metadata = {
  title: "Set up your account",
};

// It reads the URL's query, so it renders on each request.
export const instant = false;

/** Where an invite sends someone to pick their first password. */
export default async function SetupPage({ searchParams }: PageProps<"/portal/setup">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);

  return (
    <AuthPage
      title="Set up your account"
      description="We'll email you a code, then you'll pick a password."
      backToSignIn={signInHref(next)}
    >
      <ResetFlow mode="setup" next={next} />
    </AuthPage>
  );
}
