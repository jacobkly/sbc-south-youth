"use client";

import { useEffect, useRef, useState } from "react";
import { CircleAlertIcon } from "lucide-react";
import { describedBy, FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MFA_CODE_ID, MfaChallengeForm } from "@/components/auth/mfa-challenge-form";
import { type MfaDevice, verifiedDevices } from "@/lib/auth/mfa";
import { cleanCode, CODE_LENGTH, MIN_PASSWORD_LENGTH, newPasswordErrors } from "@/lib/password";
import { createClient } from "@/lib/supabase/client";

type Step = "email" | "code" | "device" | "password";
type Errors = { code?: string; password?: string; confirm?: string };

// The input each step starts on.
const FIRST_FIELD: Record<Step, string> = {
  email: "email",
  code: "code",
  device: MFA_CODE_ID,
  password: "new-password",
};

const TOO_MANY = "Too many attempts. Wait a few minutes, then try again.";

/**
 * The authenticator apps to ask for a code before the password changes. An
 * emailed code proves the email, not the phone, and Supabase won't change
 * the password of someone with two-step sign-in until they've entered both.
 */
async function devicesToCheck(): Promise<MfaDevice[]> {
  const supabase = createClient();
  const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (level?.nextLevel !== "aal2" || level.currentLevel === "aal2") return [];
  const { data } = await supabase.auth.mfa.listFactors();
  return verifiedDevices(data?.all ?? []);
}

/**
 * Forgot password, and the first password for an invited person: email a
 * 6-digit code, check it, then save a new password. Someone with two-step
 * sign-in also enters a code from their authenticator app in between. Every
 * email gets the same answer, so nobody can use this to learn who has an
 * account. Nothing personal goes in a URL, and the code works in any browser.
 */
export function ResetFlow({ mode, next }: { mode: "forgot" | "setup"; next: string }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devices, setDevices] = useState<MfaDevice[]>([]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [pending, setPending] = useState(false);

  // Moves focus to the new step, but not on page load, which would open the
  // keyboard on a phone before anyone taps.
  const started = useRef(false);
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      return;
    }
    document.getElementById(FIRST_FIELD[step])?.focus();
  }, [step]);

  function goTo(nextStep: Step) {
    setErrors({});
    setAlert(null);
    setStep(nextStep);
  }

  function showErrors(found: Errors) {
    setErrors(found);
    const first = (["code", "password", "confirm"] as const).find((field) => found[field]);
    const id = first === "code" ? "code" : first === "password" ? "new-password" : "confirm-password";
    if (first) document.getElementById(id)?.focus();
  }

  async function sendCode(again: boolean) {
    setPending(true);
    setAlert(null);
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim());
    setPending(false);

    if (error) {
      if (error.status === 429) setAlert(TOO_MANY);
      else if (!error.status || error.status >= 500) setAlert("Couldn't send the code. Check your connection and try again.");
      else setAlert("Couldn't send the code. Check the email address and try again.");
      return;
    }

    setCode("");
    setResent(again);
    if (again) {
      setErrors({});
      document.getElementById("code")?.focus();
    } else {
      goTo("code");
    }
  }

  async function checkCode() {
    setAlert(null);
    const token = cleanCode(code);
    if (token.length !== CODE_LENGTH) {
      showErrors({ code: `Enter the ${CODE_LENGTH}-digit code from the email.` });
      return;
    }

    setPending(true);
    const { error } = await createClient().auth.verifyOtp({ email: email.trim(), token, type: "recovery" });

    if (error) {
      setPending(false);
      if (error.status === 429) setAlert(TOO_MANY);
      else if (!error.status || error.status >= 500) setAlert("Couldn't check the code. Check your connection and try again.");
      else showErrors({ code: "That code is wrong or has expired. Check the newest email, or send a new code." });
      return;
    }

    const found = await devicesToCheck();
    setPending(false);
    setDevices(found);
    goTo(found.length > 0 ? "device" : "password");
  }

  async function savePassword() {
    setAlert(null);
    const found = newPasswordErrors({ password, confirm });
    if (found.password || found.confirm) {
      showErrors(found);
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setPending(false);
      if (error.code === "weak_password") {
        showErrors({ password: "That password is too weak. Try a longer one." });
      } else if (error.code === "same_password") {
        showErrors({ password: "That's already your password. Use a different one." });
      } else if (error.code === "insufficient_aal") {
        // Only if looking up their devices failed after the emailed code.
        const found = await devicesToCheck();
        setDevices(found);
        if (found.length > 0) goTo("device");
        setAlert("Enter the code from your authenticator app first.");
      } else if (error.status === 401 || error.status === 403) {
        setPassword("");
        setConfirm("");
        goTo("email");
        setAlert("That took too long, so the code stopped working. Send yourself a new one.");
      } else {
        setAlert("Couldn't save your password. Check your connection and try again.");
      }
      return;
    }

    // The password changed either way, so a failure here only leaves other devices signed in.
    await supabase.auth.signOut({ scope: "others" });
    // A full page load, not a client navigation. The router keeps recent
    // pages alive in the background, and the new password shouldn't stay
    // in one of them.
    window.location.replace(next);
  }

  return (
    <div className="mt-8 space-y-4">
      {alert && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{alert}</AlertDescription>
        </Alert>
      )}

      {step === "email" && (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void sendCode(false);
          }}
        >
          <FormField
            id="email"
            label="Email"
            hint={mode === "setup" ? "The address your invite went to." : undefined}
          >
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
              aria-describedby={describedBy("email", undefined, mode === "setup")}
              className="h-11"
            />
          </FormField>
          <Button type="submit" className="h-11 w-full" disabled={pending}>
            {pending ? "Sending…" : "Email me a code"}
          </Button>
        </form>
      )}

      {step === "code" && (
        <>
          <p role="status" className="text-sm text-muted-foreground">
            If <span className="font-medium break-all text-foreground">{email.trim()}</span> has an account, we
            sent it a {resent ? "new " : ""}
            {CODE_LENGTH}-digit code. {resent ? "Only the newest code works, for 1 hour." : "It works for 1 hour."}
          </p>
          <form
            className="space-y-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void checkCode();
            }}
          >
            <FormField id="code" label="Code" error={errors.code}>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                spellCheck={false}
                value={code}
                onChange={(event) => {
                  setCode(cleanCode(event.target.value));
                  setErrors({});
                }}
                aria-invalid={Boolean(errors.code)}
                aria-describedby={describedBy("code", errors.code)}
                className="h-11 font-mono text-lg tracking-[0.3em]"
              />
            </FormField>
            <Button type="submit" className="h-11 w-full" disabled={pending}>
              {pending ? "Checking…" : "Continue"}
            </Button>
          </form>
          <div className="flex flex-wrap items-center justify-between gap-x-4">
            <Button variant="link" className="h-11 px-0" disabled={pending} onClick={() => void sendCode(true)}>
              Send a new code
            </Button>
            <Button variant="link" className="h-11 px-0" disabled={pending} onClick={() => goTo("email")}>
              Use a different email
            </Button>
          </div>
        </>
      )}

      {step === "device" && (
        <>
          <p className="text-sm text-muted-foreground">
            You use two-step sign-in, so enter the code from your authenticator app too.
          </p>
          <MfaChallengeForm devices={devices} onVerified={() => goTo("password")} />
        </>
      )}

      {step === "password" && (
        <>
          <p className="text-sm text-muted-foreground">
            {mode === "setup"
              ? "Pick a password for your account."
              : "Pick a new password. Saving it signs you out on your other devices."}
          </p>
          <form
            className="space-y-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void savePassword();
            }}
          >
            {/* Tells password managers which account the new password belongs to. */}
            <input type="email" autoComplete="username" value={email.trim()} readOnly hidden />

            <FormField
              id="new-password"
              label={mode === "setup" ? "Password" : "New password"}
              hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
              error={errors.password}
            >
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setErrors((current) => ({ ...current, password: undefined }));
                }}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={describedBy("new-password", errors.password, true)}
                className="h-11"
              />
            </FormField>
            <FormField id="confirm-password" label="Confirm password" error={errors.confirm}>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => {
                  setConfirm(event.target.value);
                  setErrors((current) => ({ ...current, confirm: undefined }));
                }}
                aria-invalid={Boolean(errors.confirm)}
                aria-describedby={describedBy("confirm-password", errors.confirm)}
                className="h-11"
              />
            </FormField>
            <Button type="submit" className="h-11 w-full" disabled={pending}>
              {pending ? "Saving…" : "Save and sign in"}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
