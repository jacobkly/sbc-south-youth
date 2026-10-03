import { ArrowRightIcon } from "lucide-react";
import { SignOutButton } from "@/components/portal/auth/sign-out-button";
import { LogoMark } from "@/components/portal/logo-mark";
import { Button } from "@/components/portal/ui/button";

/**
 * For someone signed in without a portal role. A requester's work is all in
 * finances, so they get a way there instead of a dead end.
 */
export function NoAccess({ email, financesUrl }: { email: string | null; financesUrl: string | null }) {
  const you = email ? (
    <>
      You&apos;re signed in as <span className="font-medium break-all text-foreground">{email}</span>
    </>
  ) : (
    <>You&apos;re signed in</>
  );

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <LogoMark className="size-12" />
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {financesUrl ? "Your account is for finances" : "No access"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {financesUrl ? (
              <>
                {you}. This account can submit reimbursements in finances, but it can&apos;t use the portal. If you
                think it should, ask the owner to check your access.
              </>
            ) : (
              <>
                {you}, but this account can&apos;t use the portal. If you think that&apos;s a mistake, ask the owner to
                check your access.
              </>
            )}
          </p>
        </div>
        <div className="space-y-3">
          {financesUrl && (
            <Button asChild className="h-11 w-full">
              <a href={financesUrl}>
                Go to finances
                <ArrowRightIcon aria-hidden />
              </a>
            </Button>
          )}
          <SignOutButton variant="outline" className="h-11 w-full" />
        </div>
      </div>
    </main>
  );
}
