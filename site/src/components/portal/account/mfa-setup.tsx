"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { CheckIcon, CircleAlertIcon, CopyIcon, ExternalLinkIcon } from "lucide-react";
import { describedBy, FormField } from "@/components/portal/form-field";
import { Alert, AlertDescription } from "@/components/portal/ui/alert";
import { Button } from "@/components/portal/ui/button";
import { Input } from "@/components/portal/ui/input";
import { describeMfaError, deviceNameError, groupKey, qrCodeSrc, suggestDeviceName } from "@/lib/portal/auth/mfa";
import { cleanCode, CODE_LENGTH } from "@/lib/portal/password";
import { createClient } from "@/lib/supabase/client";

/** What authenticator apps show above the code. */
const ISSUER = "SBC South Youth";

const NAME_ID = "mfa-name";
const CODE_ID = "mfa-setup-code";

type Pending = { id: string; qrCode: string; secret: string; uri: string };

/** Removes setups that were started but never finished, so they don't pile up. Best effort. */
async function clearUnfinished() {
  const supabase = createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const unfinished = (data?.all ?? []).filter((factor) => factor.status === "unverified");
  await Promise.all(unfinished.map((factor) => supabase.auth.mfa.unenroll({ factorId: factor.id })));
}

/**
 * Sets up an authenticator app: name the device, add it to the app by QR
 * code, link, or typed key, then enter a code to prove it works. Supabase
 * only turns it on once that code checks out. Leaving partway removes the
 * unfinished setup.
 */
export function MfaSetup({
  existingNames,
  submitLabel,
  onDone,
}: {
  /** The person's other devices, so the new one gets a different name. */
  existingNames: string[];
  submitLabel: string;
  /** Gets the new device's name. */
  onDone: (name: string) => void;
}) {
  const [name, setName] = useState(() => suggestDeviceName(existingNames));
  const [pending, setPending] = useState<Pending | null>(null);
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<{ name?: string; code?: string }>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<boolean | null>(null);
  const scanStep = useRef<HTMLDivElement>(null);

  // If this closes before the code checks out, take the unfinished setup with it.
  const unfinished = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (unfinished.current) void createClient().auth.mfa.unenroll({ factorId: unfinished.current });
    },
    [],
  );

  // Moves focus to the new step without opening the keyboard over the QR code.
  useEffect(() => {
    if (pending) scanStep.current?.focus();
  }, [pending]);

  function showError(field: "name" | "code", message: string) {
    setErrors({ [field]: message });
    const input = document.getElementById(field === "name" ? NAME_ID : CODE_ID);
    if (input instanceof HTMLInputElement) {
      input.focus();
      input.select();
    }
  }

  async function start() {
    setAlert(null);
    const problem = deviceNameError(name, existingNames);
    if (problem) {
      showError("name", problem);
      return;
    }

    setBusy(true);
    await clearUnfinished();
    const { data, error } = await createClient().auth.mfa.enroll({
      factorType: "totp",
      friendlyName: name.trim(),
      issuer: ISSUER,
    });
    setBusy(false);
    if (error) {
      const described = describeMfaError(error, "Couldn't start the setup. Try again.");
      if (described.field) showError("name", described.message);
      else setAlert(described.message);
      return;
    }

    unfinished.current = data.id;
    setCode("");
    setCopied(null);
    setPending({ id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri });
  }

  function startOver() {
    if (unfinished.current) void createClient().auth.mfa.unenroll({ factorId: unfinished.current });
    unfinished.current = null;
    setPending(null);
    setErrors({});
    setAlert(null);
  }

  async function verify(token: string) {
    if (!pending) return;
    setAlert(null);
    if (token.length !== CODE_LENGTH) {
      showError("code", `Enter the ${CODE_LENGTH}-digit code from your authenticator app.`);
      return;
    }

    setBusy(true);
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: pending.id, code: token });
    if (error) {
      setBusy(false);
      const described = describeMfaError(error, "Couldn't check the code. Try again.");
      if (described.field) showError("code", described.message);
      else setAlert(described.message);
      return;
    }

    unfinished.current = null;
    // Stays busy: what comes next is a new page or a closed sheet.
    onDone(name.trim());
  }

  async function copyKey(secret: string) {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const errorAlert = alert && (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertDescription>{alert}</AlertDescription>
    </Alert>
  );

  if (!pending) {
    return (
      <div className="space-y-4">
        {errorAlert}
        <p className="text-sm text-muted-foreground">
          You&apos;ll need an authenticator app, like Passwords on iPhone, Google Authenticator, or 1Password.
        </p>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void start();
          }}
        >
          <FormField id={NAME_ID} label="Device name" hint="So you can tell your devices apart." error={errors.name}>
            <Input
              id={NAME_ID}
              autoComplete="off"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setErrors({});
              }}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={describedBy(NAME_ID, errors.name, true)}
              className="h-11"
            />
          </FormField>
          <Button type="submit" className="h-11 w-full" disabled={busy}>
            {busy ? "Starting…" : "Continue"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div ref={scanStep} tabIndex={-1} className="space-y-5 outline-none">
      {errorAlert}
      <ol className="space-y-6">
        <Step number={1} title="Add it to your authenticator app">
          <div className="grid gap-4 desktop:grid-cols-[auto_1fr] desktop:items-center">
            <figure className="order-last flex flex-col items-center gap-2 desktop:order-none">
              {/* Always on white: dark QR codes don't scan reliably. */}
              <div className="rounded-xl bg-white p-2.5 ring-1 ring-black/10">
                <Image
                  src={qrCodeSrc(pending.qrCode)}
                  alt="QR code to add SBC South Youth to an authenticator app"
                  width={152}
                  height={152}
                  unoptimized
                  className="size-38"
                />
              </div>
              <figcaption className="text-center text-xs text-muted-foreground">
                <span className="desktop:hidden">Or scan it from another device.</span>
                <span className="touch:hidden">Scan it with your phone&apos;s camera.</span>
              </figcaption>
            </figure>
            <div className="space-y-3">
              {/* On a phone the QR code is on the same screen, so this opens the app instead. */}
              <Button asChild variant="outline" className="h-11 w-full desktop:hidden">
                <a href={pending.uri}>
                  <ExternalLinkIcon aria-hidden />
                  Open in authenticator app
                </a>
              </Button>
              <div className="space-y-1.5">
                <p className="text-sm text-muted-foreground">
                  <span className="desktop:hidden">Or type this setup key:</span>
                  <span className="touch:hidden">Can&apos;t scan it? Type this setup key:</span>
                </p>
                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 py-1 pr-1 pl-3">
                  <code className="min-w-0 flex-1 font-mono text-sm select-all">
                    {groupKey(pending.secret)}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 shrink-0"
                    aria-label={copied ? "Setup key copied" : "Copy setup key"}
                    onClick={() => void copyKey(pending.secret)}
                  >
                    {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                {copied === false && (
                  <p role="alert" className="text-xs text-destructive">
                    Couldn&apos;t copy it. Select the key and copy it instead.
                  </p>
                )}
              </div>
            </div>
          </div>
        </Step>

        <Step number={2} title="Enter the code it shows">
          <form
            className="space-y-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void verify(code);
            }}
          >
            <FormField id={CODE_ID} label="Code" error={errors.code}>
              <Input
                id={CODE_ID}
                inputMode="numeric"
                autoComplete="one-time-code"
                spellCheck={false}
                value={code}
                onChange={(event) => {
                  setCode(cleanCode(event.target.value));
                  setErrors({});
                }}
                aria-invalid={Boolean(errors.code)}
                aria-describedby={describedBy(CODE_ID, errors.code)}
                className="h-11 font-mono text-lg tracking-[0.3em]"
              />
            </FormField>
            <Button type="submit" className="h-11 w-full" disabled={busy}>
              {busy ? "Checking…" : submitLabel}
            </Button>
          </form>
        </Step>
      </ol>
      <Button type="button" variant="link" className="h-11 px-0" disabled={busy} onClick={startOver}>
        Start over
      </Button>
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <li className="space-y-3">
      <p className="flex items-center gap-2.5 text-sm font-medium">
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
        >
          {number}
        </span>
        {title}
      </p>
      {children}
    </li>
  );
}
