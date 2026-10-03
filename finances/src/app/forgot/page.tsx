import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/auth-page";
import { ResetFlow } from "@/components/auth/reset-flow";
import { safeNextPath, withNext } from "@/lib/auth/next-path";

export const metadata: Metadata = {
  title: "Reset your password",
};

export default async function ForgotPage({ searchParams }: PageProps<"/forgot">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);

  return (
    <AuthPage
      title="Reset your password"
      description="We'll email you a code to set a new one."
      backToSignIn={withNext("/login", next)}
    >
      <ResetFlow mode="forgot" next={next} />
    </AuthPage>
  );
}
