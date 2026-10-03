import type { Metadata } from "next";
import { AuthPage, signInHref } from "@/components/portal/auth/auth-page";
import { ResetFlow } from "@/components/portal/auth/reset-flow";
import { safeNextPath } from "@/lib/auth/next-path";

export const metadata: Metadata = {
  title: "Reset your password",
};

// It reads the URL's query, so it renders on each request.
export const instant = false;

export default async function ForgotPage({ searchParams }: PageProps<"/portal/forgot">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);

  return (
    <AuthPage
      title="Reset your password"
      description="We'll email you a code to set a new one."
      backToSignIn={signInHref(next)}
    >
      <ResetFlow mode="forgot" next={next} />
    </AuthPage>
  );
}
