import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";

/**
 * Shown on a page someone's roles don't cover. Anyone with another part of
 * the app, like a requester on the dashboard, gets a link back to it.
 */
export function NoAccess({
  email,
  home = null,
}: {
  email: string | null;
  home?: { href: string; label: string } | null;
}) {
  const what = home ? "can't open this page" : "can't use the finance app";
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">No access</h1>
        <p className="text-sm text-muted-foreground">
          {email ? (
            <>
              You&apos;re signed in as <span className="font-medium text-foreground">{email}</span>, but this
              account {what}.
            </>
          ) : (
            <>This account {what}.</>
          )}{" "}
          If you think that&apos;s a mistake, ask the finance leader to check your access.
        </p>
        {home && (
          <Button asChild className="h-11 w-full">
            <Link href={home.href}>Go to {home.label}</Link>
          </Button>
        )}
        <SignOutButton variant="outline" className="h-11 w-full" />
      </div>
    </main>
  );
}
