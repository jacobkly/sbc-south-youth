import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/auth-page";
import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/auth/next-path";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const linkFailed = params.error === "link";

  return (
    <AuthPage title="SBC South Youth Finances" description="Sign in with your email and password.">
      <LoginForm next={next} linkFailed={linkFailed} />
    </AuthPage>
  );
}
