import type { Metadata } from "next";
import { AuthPage } from "@/components/portal/auth/auth-page";
import { LoginForm } from "@/components/portal/auth/login-form";
import { safeNextPath } from "@/lib/auth/next-path";

export const metadata: Metadata = {
  title: "Sign in",
};

// It reads the URL's query, so it renders on each request.
export const instant = false;

export default async function LoginPage({ searchParams }: PageProps<"/portal/login">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const linkFailed = params.error === "link";

  return (
    <AuthPage title="SBC South Youth Portal" description="Sign in with your email and password.">
      <LoginForm next={next} linkFailed={linkFailed} />
    </AuthPage>
  );
}
