import { SignOutButton } from "@/components/auth/sign-out-button";

export function NoAccess({ email }: { email: string | null }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">No access</h1>
        <p className="text-sm text-muted-foreground">
          {email ? (
            <>
              You&apos;re signed in as <span className="font-medium text-foreground">{email}</span>, but this account
              can&apos;t use the finance app.
            </>
          ) : (
            <>This account can&apos;t use the finance app.</>
          )}{" "}
          If you think that&apos;s a mistake, ask the finance leader to check your access.
        </p>
        <SignOutButton variant="outline" className="h-11 w-full" />
      </div>
    </main>
  );
}
