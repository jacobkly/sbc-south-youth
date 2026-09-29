"use client";

import { useState } from "react";
import { CircleAlertIcon } from "lucide-react";
import { describedBy, FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatDate, laDateOf } from "@/lib/dates";
import {
  SETTINGS_COLUMNS,
  settingsFormValues,
  settingsSaveErrorMessage,
  settingsSchema,
  type AppSettings,
  type SettingsFormValues,
} from "@/lib/settings/schema";
import { createClient } from "@/lib/supabase/client";

const DAYS_ID = "settings-late-days";

function externalApprovalHint(on: boolean): string {
  return on
    ? "For a request paid to you, enter the name of whoever approved it outside the app."
    : "A request paid to you needs another admin to approve it in the app.";
}

const LATE_DAYS_HINT =
  "A request sent more than this many days after its purchase gets a late warning. It doesn't block anything.";

function LastChanged({ updatedAt }: { updatedAt: string }) {
  return <p className="text-sm text-muted-foreground">Last changed {formatDate(laDateOf(updatedAt))}.</p>;
}

/** The settings for an admin to change. They apply to every request right away. */
export function SettingsForm({ settings }: { settings: AppSettings }) {
  const [saved, setSaved] = useState(settings);
  const [values, setValues] = useState<SettingsFormValues>(() => settingsFormValues(settings));
  const [daysError, setDaysError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const savedValues = settingsFormValues(saved);
  const changed =
    values.allow_external_approval !== savedValues.allow_external_approval ||
    values.late_submission_days.trim() !== savedValues.late_submission_days;

  function change(next: Partial<SettingsFormValues>) {
    setValues((current) => ({ ...current, ...next }));
    setMessage(null);
    if ("late_submission_days" in next) setDaysError(undefined);
  }

  async function save() {
    const parsed = settingsSchema.safeParse(values);
    if (!parsed.success) {
      setDaysError(parsed.error.issues[0]?.message);
      document.getElementById(DAYS_ID)?.focus();
      return;
    }

    setFormError(null);
    setPending(true);
    const { data, error } = await createClient()
      .from("app_settings")
      .update(parsed.data)
      .eq("id", 1)
      .select(SETTINGS_COLUMNS)
      .single();
    setPending(false);

    if (error) {
      setFormError(settingsSaveErrorMessage(error));
      return;
    }
    setSaved(data);
    setValues(settingsFormValues(data));
    setMessage("Saved.");
  }

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <LastChanged updatedAt={saved.updated_at} />

      {formError && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <section aria-labelledby="settings-approval-heading" className="space-y-3">
        <h2 id="settings-approval-heading" className="text-lg font-semibold">
          Approval
        </h2>
        <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <Label htmlFor="settings-external-approval" className="text-base font-normal desktop:text-sm">
            Allow approval outside the app
          </Label>
          <Switch
            id="settings-external-approval"
            checked={values.allow_external_approval}
            onCheckedChange={(on) => change({ allow_external_approval: on })}
            aria-describedby="settings-external-approval-hint"
          />
        </div>
        <p id="settings-external-approval-hint" className="text-sm text-muted-foreground">
          {externalApprovalHint(values.allow_external_approval)}
        </p>
      </section>

      <section aria-labelledby="settings-late-heading" className="space-y-3">
        <h2 id="settings-late-heading" className="text-lg font-semibold">
          Late requests
        </h2>
        <FormField id={DAYS_ID} label="Late after" hint={LATE_DAYS_HINT} error={daysError}>
          <div className="flex items-center gap-2">
            <Input
              id={DAYS_ID}
              inputMode="numeric"
              autoComplete="off"
              maxLength={3}
              value={values.late_submission_days}
              onChange={(event) => change({ late_submission_days: event.target.value })}
              aria-invalid={daysError ? true : undefined}
              aria-describedby={describedBy(DAYS_ID, daysError, true)}
              className="h-11 w-24 tabular-nums"
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
        </FormField>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" className="h-11 px-6" disabled={pending || !changed}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      </div>
    </form>
  );
}

/** The settings as a viewer sees them, with nothing to change. */
export function SettingsSummary({ settings }: { settings: AppSettings }) {
  return (
    <div className="space-y-6">
      <LastChanged updatedAt={settings.updated_at} />

      <section aria-labelledby="settings-approval-heading" className="space-y-3">
        <h2 id="settings-approval-heading" className="text-lg font-semibold">
          Approval
        </h2>
        <dl className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <dt>External approval</dt>
          <dd className="font-medium">{settings.allow_external_approval ? "On" : "Off"}</dd>
        </dl>
        <p className="text-sm text-muted-foreground">{externalApprovalHint(settings.allow_external_approval)}</p>
      </section>

      <section aria-labelledby="settings-late-heading" className="space-y-3">
        <h2 id="settings-late-heading" className="text-lg font-semibold">
          Late requests
        </h2>
        <dl className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <dt>Late after</dt>
          <dd className="font-medium tabular-nums">{settings.late_submission_days} days</dd>
        </dl>
        <p className="text-sm text-muted-foreground">{LATE_DAYS_HINT}</p>
      </section>

      <p className="text-sm text-muted-foreground">Only admins can change settings.</p>
    </div>
  );
}
