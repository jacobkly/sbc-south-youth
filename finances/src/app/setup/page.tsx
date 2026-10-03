import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/auth-page";
import { ResetFlow } from "@/components/auth/reset-flow";
import { safeNextPath, withNext } from "@/lib/auth/next-path";

export const metadata: Metadata = {
  title: "Set up your account",
};

export default async function SetupPage({ searchParams }: PageProps<"/setup">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);

  return (
    <AuthPage
      title="Set up your account"
      description="We'll email you a code, then you'll pick a password."
      backToSignIn={withNext("/login", next)}
    >
      <ResetFlow mode="setup" next={next} />
    </AuthPage>
  );
}
