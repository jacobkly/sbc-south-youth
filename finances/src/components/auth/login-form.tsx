"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const RESEND_SECONDS = 60;

type Step = "email" | "code";

/**
 * Two-step email sign-in: send a one-time code, then enter it. The same
 * email also has a sign-in link. Accounts are never created here, and the
 * form answers the same way whether or not an email has an account.
 */
export function LoginForm({ next, linkFailed }: { next: string; linkFailed: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    linkFailed ? "That sign-in link didn't work. It may have expired, so send a new code." : null,
  );
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function sendCode() {
    setPending(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: window.location.origin,
      },
    });
    setPending(false);

    // Rate limits and network problems are worth showing. Anything else,
    // like an email with no account, gets the same answer as success.
    if (error?.status === 429) {
      setError("Too many sign-in emails. Wait a few minutes, then try again.");
      return;
    }
    if (error && (!error.status || error.status >= 500)) {
      setError("Couldn't reach the sign-in service. Check your connection and try again.");
      return;
    }

    setCode("");
    setStep("code");
    setResendIn(RESEND_SECONDS);
  }

  async function verifyCode() {
    setPending(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({
      email: email.trim(),
      token: code,
      type: "email",
    });

    if (error) {
      setPending(false);
      setError("That code didn't work. Check it, or send a new one.");
      return;
    }

    router.replace(next);
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

      {step === "email" ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void sendCode();
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
              className="h-11 text-base"
            />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={pending}>
            {pending ? "Sending…" : "Send sign-in code"}
          </Button>
        </form>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void verifyCode();
          }}
        >
          <p className="text-sm text-muted-foreground" role="status">
            If <span className="font-medium text-foreground">{email.trim()}</span> has an account, we sent it a
            code and a sign-in link.
          </p>
          <div className="space-y-2">
            <Label htmlFor="code">Code</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              maxLength={10}
              required
              autoFocus
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              className="h-11 text-lg tracking-[0.3em]"
            />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={pending || code.length < 6}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
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
              onClick={() => void sendCode()}
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : "Send a new code"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
