"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleAlertIcon } from "lucide-react";
import { describedBy, FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { PAYEE_COLUMNS, type PayeeRow } from "@/lib/payees/columns";
import {
  DUPLICATE_EMAIL_CODE,
  DUPLICATE_EMAIL_MESSAGE,
  payeeFieldErrors,
  payeeSaveErrorMessage,
  payeeSchema,
  type PayeeFieldErrors,
  type PayeeFormValues,
} from "@/lib/payees/schema";
import { createClient } from "@/lib/supabase/client";

const FIELD_ORDER: (keyof PayeeFormValues)[] = ["full_name", "email", "payment_handle", "notes"];

/** Add or edit a payee in a bottom sheet (a centered panel on wider screens). */
export function PayeeSheet({ payee, onClose }: { payee: PayeeRow | "new" | null; onClose: () => void }) {
  const router = useRouter();
  // Keep showing the last payee while the sheet animates closed.
  const [lastPayee, setLastPayee] = useState(payee);
  if (payee !== null && payee !== lastPayee) setLastPayee(payee);
  const current = payee ?? lastPayee;
  const isNew = current === "new";

  return (
    <Sheet open={payee !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[92dvh] overflow-y-auto rounded-t-xl pb-[calc(1rem+env(safe-area-inset-bottom))] md:inset-x-0 md:bottom-6 md:mx-auto md:max-w-lg md:rounded-xl md:border"
      >
        <SheetHeader>
          <SheetTitle>{isNew ? "Add payee" : "Edit payee"}</SheetTitle>
          <SheetDescription>
            {isNew ? "Someone you reimburse." : "Changes apply to this payee's past and future requests."}
          </SheetDescription>
        </SheetHeader>
        {current && (
          <PayeeForm
            key={current === "new" ? "new" : current.id}
            payee={current === "new" ? null : current}
            onSaved={() => {
              onClose();
              router.refresh();
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * The payee fields. Used in the payees sheet, and reusable anywhere a payee
 * gets added inline. Calls onSaved with the saved row. `defaultName` prefills
 * the name of a new payee.
 */
export function PayeeForm({
  payee,
  defaultName = "",
  onSaved,
}: {
  payee: PayeeRow | null;
  defaultName?: string;
  onSaved: (saved: PayeeRow) => void;
}) {
  const [values, setValues] = useState<PayeeFormValues>({
    full_name: payee?.full_name ?? defaultName,
    email: payee?.email ?? "",
    payment_handle: payee?.payment_handle ?? "",
    notes: payee?.notes ?? "",
  });
  const [errors, setErrors] = useState<PayeeFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<"save" | "status" | null>(null);

  function fieldProps(key: keyof PayeeFormValues, hint?: boolean) {
    const id = `payee-${key}`;
    return {
      id,
      value: values[key],
      "aria-invalid": errors[key] ? true : undefined,
      "aria-describedby": describedBy(id, errors[key], hint),
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setValues((current) => ({ ...current, [key]: event.target.value }));
        setErrors((current) => ({ ...current, [key]: undefined }));
      },
    };
  }

  function showFieldErrors(next: PayeeFieldErrors) {
    setErrors(next);
    const first = FIELD_ORDER.find((key) => next[key]);
    if (first) document.getElementById(`payee-${first}`)?.focus();
  }

  async function save() {
    const parsed = payeeSchema.safeParse(values);
    if (!parsed.success) {
      showFieldErrors(payeeFieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setFormError(null);
    setPending("save");
    const supabase = createClient();
    const { data, error } = payee
      ? await supabase.from("payees").update(parsed.data).eq("id", payee.id).select(PAYEE_COLUMNS).single()
      : await supabase.from("payees").insert(parsed.data).select(PAYEE_COLUMNS).single();
    setPending(null);

    if (error) {
      if (error.code === DUPLICATE_EMAIL_CODE) showFieldErrors({ email: DUPLICATE_EMAIL_MESSAGE });
      else setFormError(payeeSaveErrorMessage(error));
      return;
    }
    onSaved(data);
  }

  async function setActive(existing: PayeeRow, isActive: boolean) {
    setFormError(null);
    setPending("status");
    const { data, error } = await createClient()
      .from("payees")
      .update({ is_active: isActive })
      .eq("id", existing.id)
      .select(PAYEE_COLUMNS)
      .single();
    setPending(null);

    if (error) {
      setFormError(payeeSaveErrorMessage(error));
      return;
    }
    onSaved(data);
  }

  return (
    <form
      noValidate
      className="space-y-4 px-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {formError && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <FormField id="payee-full_name" label="Name" error={errors.full_name}>
        <Input {...fieldProps("full_name")} autoComplete="off" required maxLength={100} className="h-11" />
      </FormField>

      <FormField id="payee-email" label="Email" optional error={errors.email}>
        <Input
          {...fieldProps("email")}
          type="email"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={254}
          className="h-11"
        />
      </FormField>

      <FormField
        id="payee-payment_handle"
        label="Payment handle"
        optional
        hint="Where the money goes, like a username or phone number."
        error={errors.payment_handle}
      >
        <Input
          {...fieldProps("payment_handle", true)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={100}
          className="h-11"
        />
      </FormField>

      <FormField id="payee-notes" label="Notes" optional error={errors.notes}>
        <Textarea {...fieldProps("notes")} rows={3} maxLength={1000} />
      </FormField>

      <Button type="submit" className="h-11 w-full" disabled={pending !== null}>
        {pending === "save" ? "Saving…" : payee ? "Save changes" : "Add payee"}
      </Button>

      {payee && (
        <div className="space-y-2 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            {payee.is_active
              ? "Deactivating hides this payee when entering new requests. Their past requests stay."
              : "This payee is inactive, so they're hidden when entering new requests."}
          </p>
          <Button
            type="button"
            variant={payee.is_active ? "destructive" : "outline"}
            className="h-11 w-full"
            disabled={pending !== null}
            onClick={() => void setActive(payee, !payee.is_active)}
          >
            {pending === "status" ? "Saving…" : payee.is_active ? "Deactivate payee" : "Reactivate payee"}
          </Button>
        </div>
      )}
    </form>
  );
}
