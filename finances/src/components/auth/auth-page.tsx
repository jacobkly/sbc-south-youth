import type { ReactNode } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/nav/logo-mark";

/** The centered, single-column layout every sign-in page shares. */
export function AuthPage({
  title,
  description,
  backToSignIn,
  children,
}: {
  title: string;
  description: string;
  /** Where the "Back to sign in" link goes. Leave it out on the sign-in page. */
  backToSignIn?: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <LogoMark className="mb-6 size-12 rounded-xl" />
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        {children}
        {backToSignIn && (
          <p className="mt-6 text-center text-sm">
            <Link
              href={backToSignIn}
              className="inline-block py-2 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Back to sign in
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
