import type { Metadata } from "next";
import { AuthPage } from "@/components/portal/auth/auth-page";
import { LoginForm } from "@/components/portal/auth/login-form";
import { nextAfterSignIn } from "@/lib/auth/after-sign-in";
import { readPortalEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Sign in",
};

// It reads the URL's query, so it renders on each request.
export const instant = false;

export default async function LoginPage({ searchParams }: PageProps<"/portal/login">) {
  const params = await searchParams;
  const next = nextAfterSignIn(typeof params.next === "string" ? params.next : null);
  const linkFailed = params.error === "link";
  // Once finances shares it, this one sign-in is for both.
  const title = readPortalEnv().sharedSignIn ? "SBC South Youth" : "SBC South Youth Portal";

  return (
    <AuthPage title={title} description="Sign in with your email and password.">
      <LoginForm next={next} linkFailed={linkFailed} />
    </AuthPage>
  );
}
