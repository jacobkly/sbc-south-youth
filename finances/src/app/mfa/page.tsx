import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPage } from "@/components/auth/auth-page";
import { MfaStep } from "@/components/auth/mfa-step";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { canUseApp, getCurrentUser, getMfaDevices, getSessionAal } from "@/lib/auth/current-user";
import { safeNextPath } from "@/lib/auth/next-path";

export const metadata: Metadata = {
  title: "Two-step sign-in",
};

/**
 * The step after the password for anyone with an authenticator app, and
 * where an owner sets one up before using the app.
 */
export default async function MfaPage({ searchParams }: PageProps<"/mfa">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);

  const user = await getCurrentUser();
  // The shell shows anyone without access the No access screen.
  if (!user || !canUseApp(user)) redirect(next);
  if ((await getSessionAal()) === "aal2") redirect(next);

  const devices = await getMfaDevices();
  const owner = user.roles.includes("owner");
  // Nobody else has to set it up.
  if (devices.length === 0 && !owner) redirect(next);

  const signedIn = (
    <div className="mt-8 flex flex-col items-center gap-1 border-t pt-6 text-center text-sm text-muted-foreground">
      <p>
        Signed in as <span className="font-medium break-all text-foreground">{user.email}</span>
      </p>
      <SignOutButton variant="link" className="h-11 text-muted-foreground hover:text-foreground" />
    </div>
  );

  if (devices.length === 0) {
    return (
      <AuthPage
        title="Set up two-step sign-in"
        description="Owners can change access and pay reimbursements, so signing in also takes a code from your phone."
      >
        <MfaStep devices={devices} next={next} />
        {signedIn}
      </AuthPage>
    );
  }

  return (
    <AuthPage
      title="Enter your code"
      description="Open your authenticator app and enter the 6-digit code for SBC South Youth."
    >
      <MfaStep devices={devices} next={next} />
      <p className="mt-4 text-xs text-muted-foreground">
        {devices.length > 1
          ? "Don't have that device? Pick another one above."
          : "Lost your phone? Ask the site maintainer to reset two-step sign-in for your account."}
      </p>
      {signedIn}
    </AuthPage>
  );
}
