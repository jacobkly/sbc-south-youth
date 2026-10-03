"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { afterSignInPath } from "@/lib/auth/mfa";
import { withNext } from "@/lib/auth/next-path";
import { createClient } from "@/lib/supabase/client";

/**
 * Email and password sign-in. Accounts are never created here, and a wrong
 * email gets the same answer as a wrong password.
 */
export function LoginForm({ next, linkFailed }: { next: string; linkFailed: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    linkFailed ? "That sign-in link didn't work. Sign in with your password instead." : null,
  );

  async function signIn() {
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (error) {
      setPending(false);
      if (error.status === 429) {
        setError("Too many attempts. Wait a few minutes, then try again.");
      } else if (!error.status || error.status >= 500) {
        setError("Couldn't sign you in. Check your connection and try again.");
      } else {
        setError("Wrong email or password.");
      }
      return;
    }

    // Someone with two-step sign-in enters a code next. This reads the new
    // session in the browser, so it's instant.
    const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    router.replace(afterSignInPath(next, level));
    router.refresh();
  }

  return (
    <div className="mt-8 space-y-4">
      {error && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void signIn();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="password">Password</Label>
            <Link
              href={withNext("/forgot", next)}
              className="-my-2 py-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11"
          />
        </div>
        <Button type="submit" className="h-11 w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
