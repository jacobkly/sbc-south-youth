"use client";

import { useState } from "react";
import { describedBy, FormField } from "@/components/portal/form-field";
import { Button } from "@/components/portal/ui/button";
import { Input } from "@/components/portal/ui/input";
import { MIN_PASSWORD_LENGTH, newPasswordErrors } from "@/lib/portal/password";
import { createClient } from "@/lib/supabase/client";

const FIELDS = { current: "current-password", next: "new-password", confirm: "confirm-password" } as const;

type Field = keyof typeof FIELDS;
type Errors = Partial<Record<Field, string>>;

/**
 * Changes the password. The current password is checked by signing in with
 * it, and afterward every other device is signed out.
 */
export function PasswordForm({ email }: { email: string }) {
  const [values, setValues] = useState<Record<Field, string>>({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: "saved" | "error"; text: string } | null>(null);

  function change(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setMessage(null);
  }

  function showErrors(found: Errors) {
    setErrors(found);
    const first = (Object.keys(FIELDS) as Field[]).find((field) => found[field]);
    if (first) document.getElementById(FIELDS[first])?.focus();
  }

  async function save() {
    setMessage(null);
    const found: Errors = {};
    if (!values.current) found.current = "Enter your current password.";
    const fresh = newPasswordErrors({ password: values.next, confirm: values.confirm });
    if (fresh.password) found.next = fresh.password;
    else if (values.next === values.current) found.next = "Use a different password from your current one.";
    else if (fresh.confirm) found.confirm = fresh.confirm;
    if (Object.keys(found).length > 0) {
      showErrors(found);
      return;
    }

    setPending(true);
    const supabase = createClient();
    const check = await supabase.auth.signInWithPassword({ email, password: values.current });
    if (check.error) {
      setPending(false);
      if (check.error.code === "invalid_credentials") {
        showErrors({ current: "That isn't your current password." });
      } else if (check.error.status === 429) {
        setMessage({ kind: "error", text: "Too many attempts. Wait a few minutes, then try again." });
      } else {
        setMessage({ kind: "error", text: "Couldn't change your password. Try again." });
      }
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: values.next });
    if (error) {
      setPending(false);
      if (error.code === "weak_password") {
        showErrors({ next: "That password is too weak. Try a longer one." });
      } else if (error.code === "same_password") {
        showErrors({ next: "That's already your password." });
      } else {
        setMessage({ kind: "error", text: "Couldn't change your password. Try again." });
      }
      return;
    }

    // The password changed either way, so a failure here only leaves other devices signed in.
    await supabase.auth.signOut({ scope: "others" });
    setPending(false);
    setValues({ current: "", next: "", confirm: "" });
    setMessage({ kind: "saved", text: "Password changed. Your other devices are signed out." });
  }

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {/* Tells password managers which account the new password belongs to. */}
      <input type="email" autoComplete="username" value={email} readOnly hidden />

      <FormField id={FIELDS.current} label="Current password" error={errors.current}>
        <Input
          id={FIELDS.current}
          type="password"
          autoComplete="current-password"
          value={values.current}
          onChange={(event) => change("current", event.target.value)}
          aria-invalid={Boolean(errors.current)}
          aria-describedby={describedBy(FIELDS.current, errors.current)}
          className="h-11"
        />
      </FormField>
      <FormField
        id={FIELDS.next}
        label="New password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        error={errors.next}
      >
        <Input
          id={FIELDS.next}
          type="password"
          autoComplete="new-password"
          value={values.next}
          onChange={(event) => change("next", event.target.value)}
          aria-invalid={Boolean(errors.next)}
          aria-describedby={describedBy(FIELDS.next, errors.next, true)}
          className="h-11"
        />
      </FormField>
      <FormField id={FIELDS.confirm} label="Confirm new password" error={errors.confirm}>
        <Input
          id={FIELDS.confirm}
          type="password"
          autoComplete="new-password"
          value={values.confirm}
          onChange={(event) => change("confirm", event.target.value)}
          aria-invalid={Boolean(errors.confirm)}
          aria-describedby={describedBy(FIELDS.confirm, errors.confirm)}
          className="h-11"
        />
      </FormField>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="h-11 px-6" disabled={pending}>
          {pending ? "Changing…" : "Change password"}
        </Button>
        {message && (
          <p
            role={message.kind === "error" ? "alert" : "status"}
            className={message.kind === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
          >
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
