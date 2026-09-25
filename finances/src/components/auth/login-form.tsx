"use client";

import { useEffect, useState } from "react";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const RESEND_SECONDS = 60;

type Step = "email" | "sent";

/**
 * Email sign-in with a one-time link. The link only works in the browser
 * that asked for it, since that browser holds the other half of the
 * sign-in. Accounts are never created here, and the form answers the same
 * way whether or not an email has an account.
 */
export function LoginForm({ next, linkFailed }: { next: string; linkFailed: boolean }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    linkFailed
      ? "That sign-in link didn't work. It may have expired or been opened in a different browser, so send a new one."
      : null,
  );
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function sendLink() {
    setPending(true);
    setError(null);
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", next);
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: callback.href,
      },
    });
    setPending(false);

    // Rate limits and network problems are worth showing. Anything else,
    // like an email with no account, gets the same answer as success.
    if (error?.status === 429) {
      setError("Too many sign-in emails. Wait a while, then try again.");
      return;
    }
    if (error && (!error.status || error.status >= 500)) {
      setError("Couldn't reach the sign-in service. Check your connection and try again.");
      return;
    }

    setStep("sent");
    setResendIn(RESEND_SECONDS);
  }

  return (
    <div className="mt-8 space-y-4">
      {error && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {step === "email" ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void sendLink();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11"
            />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={pending}>
            {pending ? "Sending…" : "Send sign-in link"}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2 text-sm text-muted-foreground" role="status">
            <p>
              If <span className="font-medium text-foreground">{email.trim()}</span> has an account, we sent it a
              sign-in link.
            </p>
            <p>Open the link in this browser. It won&apos;t work in a different one.</p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-11"
              onClick={() => {
                setStep("email");
                setError(null);
              }}
            >
              Use a different email
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11"
              disabled={pending || resendIn > 0}
              onClick={() => void sendLink()}
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : "Send a new link"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
