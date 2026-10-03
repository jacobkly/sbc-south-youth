"use client";

import { useState } from "react";
import { CircleAlertIcon } from "lucide-react";
import { describedBy, FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { describeMfaError, type MfaDevice } from "@/lib/auth/mfa";
import { cleanCode, CODE_LENGTH } from "@/lib/password";
import { createClient } from "@/lib/supabase/client";

/** The code field's id, for moving focus to it. */
export const MFA_CODE_ID = "mfa-code";

/**
 * Asks for the 6-digit code from an authenticator app and checks it, which
 * upgrades this session to aal2. Someone with more than one device picks
 * which one the code is from. It checks itself once all 6 digits are in,
 * so a code filled in from the keyboard's suggestion goes straight through.
 */
export function MfaChallengeForm({
  devices,
  onVerified,
  submitLabel = "Continue",
}: {
  devices: MfaDevice[];
  onVerified: () => void;
  submitLabel?: string;
}) {
  const [deviceId, setDeviceId] = useState(devices[0]?.id ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function showCodeError(message: string) {
    setError(message);
    const field = document.getElementById(MFA_CODE_ID);
    if (field instanceof HTMLInputElement) {
      field.focus();
      field.select();
    }
  }

  async function verify(token: string) {
    setAlert(null);
    if (token.length !== CODE_LENGTH) {
      showCodeError(`Enter the ${CODE_LENGTH}-digit code from your authenticator app.`);
      return;
    }

    setPending(true);
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: deviceId, code: token });
    if (error) {
      setPending(false);
      const problem = describeMfaError(error, "Couldn't check the code. Try again.");
      if (problem.field) showCodeError(problem.message);
      else setAlert(problem.message);
      return;
    }

    // Stays pending: what comes next is a new page or the next step.
    onVerified();
  }

  return (
    <div className="space-y-4">
      {alert && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{alert}</AlertDescription>
        </Alert>
      )}

      <form
        className="space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void verify(code);
        }}
      >
        {devices.length > 1 && (
          <FormField id="mfa-device" label="Code from" group>
            <RadioGroup
              value={deviceId}
              onValueChange={(value) => {
                setDeviceId(value);
                setError(null);
              }}
              aria-labelledby="mfa-device-label"
              className="gap-0"
            >
              {devices.map((device) => (
                <Label
                  key={device.id}
                  htmlFor={`mfa-device-${device.id}`}
                  className="min-h-11 cursor-pointer gap-3 font-normal"
                >
                  <RadioGroupItem id={`mfa-device-${device.id}`} value={device.id} />
                  <span className="text-base desktop:text-sm">{device.name}</span>
                </Label>
              ))}
            </RadioGroup>
          </FormField>
        )}

        <FormField id={MFA_CODE_ID} label="Code" error={error ?? undefined}>
          <Input
            id={MFA_CODE_ID}
            inputMode="numeric"
            autoComplete="one-time-code"
            spellCheck={false}
            value={code}
            onChange={(event) => {
              const typed = cleanCode(event.target.value);
              setCode(typed);
              setError(null);
              // Also when a new code replaces a wrong one in one go, as autofill and paste do.
              if (typed.length === CODE_LENGTH && typed !== code && !pending) void verify(typed);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy(MFA_CODE_ID, error ?? undefined)}
            className="h-11 font-mono text-lg tracking-[0.3em]"
          />
        </FormField>
        <Button type="submit" className="h-11 w-full" disabled={pending}>
          {pending ? "Checking…" : submitLabel}
        </Button>
      </form>
    </div>
  );
}
