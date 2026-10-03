"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { CircleAlertIcon, CircleCheckIcon, SearchIcon, TriangleAlertIcon } from "lucide-react";
import { describedBy, FormField } from "@/components/portal/form-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/portal/ui/alert";
import { Button } from "@/components/portal/ui/button";
import { Checkbox } from "@/components/portal/ui/checkbox";
import { Input } from "@/components/portal/ui/input";
import { Label } from "@/components/portal/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/portal/ui/radio-group";
import { ResponsiveSheetContent } from "@/components/portal/ui/responsive-sheet";
import { Sheet, SheetDescription, SheetHeader, SheetTitle } from "@/components/portal/ui/sheet";
import { invitePerson, type InviteResult } from "@/lib/portal/people/actions";
import { checkInvite, INVITE_ROLES, type InviteErrors } from "@/lib/portal/people/schema";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type AppRole } from "@/lib/portal/roles";

/** A payee in finances that isn't linked to anyone yet. */
export type OpenPayee = { id: string; full_name: string; email: string | null };

type Done = Extract<InviteResult, { status: "done" }>;

/** The order fields are checked in, for focusing the first problem. */
const FIELD_ORDER: (keyof InviteErrors)[] = ["fullName", "email", "roles", "payee", "adult"];
const FIELD_IDS: Record<keyof InviteErrors, string> = {
  fullName: "invite-name",
  email: "invite-email",
  roles: `invite-role-${INVITE_ROLES[0]}`,
  payee: "invite-payee-new",
  adult: "invite-adult",
};
const PAYEE_CHOOSE_ID = "invite-payee-choose";

/** A tappable row in a list of checkboxes or radio buttons, with room for a description. */
const OPTION_ROW = "min-h-11 cursor-pointer items-start gap-3 px-4 py-3 font-normal leading-snug";
const PAYEE_BUTTON =
  "flex min-h-11 w-full min-w-0 flex-col items-start justify-center rounded-lg px-2 py-2 text-left outline-none " +
  "hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Invites someone with a name, an email, and the roles they need. A
 * requester also gets a payee in finances, either a new one or one that's
 * already there, so their reimbursements are paid to the right person.
 */
export function InviteForm({ payees, readOnly }: { payees: OpenPayee[]; readOnly: boolean }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [adult, setAdult] = useState(false);
  const [payeeMode, setPayeeMode] = useState<"new" | "existing">("new");
  const [payee, setPayee] = useState<OpenPayee | null>(null);
  const [errors, setErrors] = useState<InviteErrors>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [pending, startTransition] = useTransition();
  const doneHeading = useRef<HTMLHeadingElement>(null);
  const startingOver = useRef(false);

  const requester = roles.includes("finance_requester");
  const typedEmail = email.trim().toLowerCase();
  const sameEmail = typedEmail ? payees.find((row) => row.email?.toLowerCase() === typedEmail) : undefined;

  // Focus follows the swap: to the result once it's in, and back to Name for another invite.
  useEffect(() => {
    if (done) {
      doneHeading.current?.focus();
    } else if (startingOver.current) {
      startingOver.current = false;
      document.getElementById(FIELD_IDS.fullName)?.focus();
    }
  }, [done]);

  function clearError(field: keyof InviteErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function showErrors(found: InviteErrors) {
    setErrors(found);
    const first = FIELD_ORDER.find((field) => found[field]);
    if (!first) return;
    // With an existing payee picked, the payee error belongs to the Choose button.
    const id = first === "payee" && payeeMode === "existing" ? PAYEE_CHOOSE_ID : FIELD_IDS[first];
    document.getElementById(id)?.focus();
  }

  function submit() {
    setAlert(null);
    const values = {
      fullName,
      email,
      roles,
      adult,
      // An existing payee that wasn't picked yet fails the check, instead of quietly making a new one.
      payee: payeeMode === "new" ? "new" : (payee?.id ?? "none"),
    };
    const check = checkInvite(values);
    if (!check.ok) {
      showErrors(check.errors);
      return;
    }

    startTransition(async () => {
      let result: InviteResult;
      try {
        result = await invitePerson(values);
      } catch {
        setAlert("Couldn't send the invite. Check your connection and try again.");
        return;
      }
      if (result.status === "invalid") showErrors(result.errors);
      else if (result.status === "failed") setAlert(result.message);
      else setDone(result);
    });
  }

  function reset() {
    setFullName("");
    setEmail("");
    setRoles([]);
    setAdult(false);
    setPayeeMode("new");
    setPayee(null);
    setErrors({});
    setAlert(null);
    setDone(null);
    startingOver.current = true;
  }

  if (done) return <InviteDone result={done} headingRef={doneHeading} onAnother={reset} />;

  return (
    <div className="space-y-6">
      {readOnly && (
        <Alert>
          <TriangleAlertIcon />
          <AlertDescription>
            This is the staging copy of the portal, so it can&apos;t send invites. Use the real portal to invite
            people.
          </AlertDescription>
        </Alert>
      )}

      {alert && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{alert}</AlertDescription>
        </Alert>
      )}

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <fieldset disabled={readOnly || pending} className="min-w-0 space-y-6">
          <FormField id={FIELD_IDS.fullName} label="Name" error={errors.fullName}>
            <Input
              id={FIELD_IDS.fullName}
              autoComplete="off"
              autoCapitalize="words"
              maxLength={100}
              value={fullName}
              aria-invalid={errors.fullName ? true : undefined}
              aria-describedby={describedBy(FIELD_IDS.fullName, errors.fullName)}
              onChange={(event) => {
                setFullName(event.target.value);
                clearError("fullName");
              }}
            />
          </FormField>

          <FormField
            id={FIELD_IDS.email}
            label="Email"
            hint="Their invite goes here, and it's the address they'll sign in with."
            error={errors.email}
          >
            <Input
              id={FIELD_IDS.email}
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={254}
              value={email}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={describedBy(FIELD_IDS.email, errors.email, true)}
              onChange={(event) => {
                setEmail(event.target.value);
                clearError("email");
              }}
            />
          </FormField>

          <FormField
            id="invite-roles"
            label="Access"
            hint="Owner isn't here: give it from their page once they've set up their account."
            error={errors.roles}
            group
          >
            <div
              role="group"
              aria-labelledby="invite-roles-label"
              aria-describedby={describedBy("invite-roles", errors.roles, true)}
              className="divide-y overflow-hidden rounded-xl border bg-card"
            >
              {INVITE_ROLES.map((role) => {
                const id = `invite-role-${role}`;
                return (
                  <Label key={role} htmlFor={id} className={OPTION_ROW}>
                    <Checkbox
                      id={id}
                      className="mt-0.5"
                      checked={roles.includes(role)}
                      aria-invalid={errors.roles ? true : undefined}
                      aria-labelledby={`${id}-title`}
                      aria-describedby={`${id}-description`}
                      onCheckedChange={(checked) => {
                        setRoles((current) =>
                          checked === true ? [...current, role] : current.filter((held) => held !== role),
                        );
                        clearError("roles");
                        if (role === "finance_requester") clearError("payee");
                      }}
                    />
                    <span className="min-w-0 space-y-0.5">
                      <span id={`${id}-title`} className="block text-base font-medium desktop:text-sm">
                        {ROLE_LABELS[role]}
                      </span>
                      <span id={`${id}-description`} className="block text-sm text-muted-foreground">
                        {ROLE_DESCRIPTIONS[role]}
                      </span>
                    </span>
                  </Label>
                );
              })}
            </div>
          </FormField>

          {requester && (
            <PayeeField
              payees={payees}
              mode={payeeMode}
              payee={payee}
              sameEmail={sameEmail}
              error={errors.payee}
              onModeChange={(mode) => {
                setPayeeMode(mode);
                clearError("payee");
              }}
              onPick={(picked) => {
                setPayee(picked);
                clearError("payee");
              }}
            />
          )}

          <div className="space-y-2">
            <Label htmlFor={FIELD_IDS.adult} className="min-h-11 cursor-pointer items-start gap-3 py-1 font-normal">
              <Checkbox
                id={FIELD_IDS.adult}
                className="mt-0.5"
                checked={adult}
                aria-invalid={errors.adult ? true : undefined}
                aria-labelledby={`${FIELD_IDS.adult}-title`}
                aria-describedby={errors.adult ? `${FIELD_IDS.adult}-error` : `${FIELD_IDS.adult}-hint`}
                onCheckedChange={(checked) => {
                  setAdult(checked === true);
                  clearError("adult");
                }}
              />
              <span className="min-w-0 space-y-0.5 leading-snug">
                <span id={`${FIELD_IDS.adult}-title`} className="block text-base font-medium desktop:text-sm">
                  They&apos;re 18 or older
                </span>
                <span id={`${FIELD_IDS.adult}-hint`} className="block text-sm text-muted-foreground">
                  Students never get an account.
                </span>
              </span>
            </Label>
            {errors.adult && (
              <p id={`${FIELD_IDS.adult}-error`} className="text-sm text-destructive">
                {errors.adult}
              </p>
            )}
          </div>

          <Button type="submit" className="h-11 w-full px-6 sm:w-auto">
            {pending ? "Sending…" : "Send invite"}
          </Button>
        </fieldset>
      </form>
    </div>
  );
}

/** For a requester: a new payee, or one that's already in finances. */
function PayeeField({
  payees,
  mode,
  payee,
  sameEmail,
  error,
  onModeChange,
  onPick,
}: {
  payees: OpenPayee[];
  mode: "new" | "existing";
  payee: OpenPayee | null;
  sameEmail: OpenPayee | undefined;
  error?: string;
  onModeChange: (mode: "new" | "existing") => void;
  onPick: (payee: OpenPayee) => void;
}) {
  const [picking, setPicking] = useState(false);
  const chooseButton = useRef<HTMLButtonElement>(null);

  return (
    <FormField id="invite-payee" label="Payee" error={error} group>
      <RadioGroup
        value={mode}
        onValueChange={(value) => onModeChange(value as "new" | "existing")}
        aria-labelledby="invite-payee-label"
        aria-describedby={describedBy("invite-payee", error)}
        className="gap-0 divide-y overflow-hidden rounded-xl border bg-card"
      >
        <Label htmlFor="invite-payee-new" className={OPTION_ROW}>
          <RadioGroupItem
            id="invite-payee-new"
            value="new"
            className="mt-0.5"
            aria-labelledby="invite-payee-new-title"
            aria-describedby="invite-payee-new-description"
          />
          <span className="min-w-0 space-y-0.5">
            <span id="invite-payee-new-title" className="block text-base font-medium desktop:text-sm">
              New payee
            </span>
            <span id="invite-payee-new-description" className="block text-sm text-muted-foreground">
              {sameEmail
                ? `${sameEmail.full_name} in finances already has this email, so they'll be linked to it.`
                : "Finances gets a payee with this name and email."}
            </span>
          </span>
        </Label>

        {payees.length > 0 && (
          <div className="space-y-3 px-4 py-3">
            <Label
              htmlFor="invite-payee-existing"
              className="cursor-pointer items-start gap-3 font-normal leading-snug"
            >
              <RadioGroupItem
                id="invite-payee-existing"
                value="existing"
                className="mt-0.5"
                aria-labelledby="invite-payee-existing-title"
                aria-describedby="invite-payee-existing-description"
              />
              <span className="min-w-0 space-y-0.5">
                <span id="invite-payee-existing-title" className="block text-base font-medium desktop:text-sm">
                  Existing payee
                </span>
                <span id="invite-payee-existing-description" className="block text-sm text-muted-foreground">
                  Someone already in finances, like a payee from before they had an account.
                </span>
              </span>
            </Label>
            {mode === "existing" && (
              <div className="flex min-w-0 items-center gap-3 pl-7">
                {payee && (
                  <p className="min-w-0 flex-1 truncate text-sm">
                    <span className="font-medium">{payee.full_name}</span>
                    {payee.email && <span className="text-muted-foreground"> · {payee.email}</span>}
                  </p>
                )}
                <Button
                  ref={chooseButton}
                  id={PAYEE_CHOOSE_ID}
                  type="button"
                  variant="outline"
                  className="h-11 px-4"
                  aria-invalid={error ? true : undefined}
                  onClick={() => setPicking(true)}
                >
                  {payee ? "Change" : "Choose a payee"}
                </Button>
              </div>
            )}
          </div>
        )}
      </RadioGroup>

      <PayeePicker
        open={picking}
        payees={payees}
        onOpenChange={setPicking}
        onPick={(picked) => {
          onPick(picked);
          setPicking(false);
        }}
        returnFocus={chooseButton}
      />
    </FormField>
  );
}

/** A searchable list of payees that aren't linked to anyone. */
function PayeePicker({
  open,
  payees,
  onOpenChange,
  onPick,
  returnFocus,
}: {
  open: boolean;
  payees: OpenPayee[];
  onOpenChange: (open: boolean) => void;
  onPick: (payee: OpenPayee) => void;
  returnFocus: React.RefObject<HTMLButtonElement | null>;
}) {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = payees.filter((row) => {
    const haystack = `${row.full_name} ${row.email ?? ""}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
    >
      <ResponsiveSheetContent
        className="p-4"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus.current?.focus();
        }}
      >
        <SheetHeader className="p-0 pr-12">
          <SheetTitle>Choose a payee</SheetTitle>
          <SheetDescription>Only payees that aren&apos;t linked to anyone are here.</SheetDescription>
        </SheetHeader>

        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id={searchId}
            type="search"
            aria-label="Search payees"
            placeholder="Search by name or email"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        {shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground" role="status">
            No payees match &ldquo;{query.trim()}&rdquo;.
          </p>
        ) : (
          <ul className="-mx-2 space-y-0.5" aria-label="Payees">
            {shown.map((row) => (
              <li key={row.id}>
                <button type="button" className={PAYEE_BUTTON} onClick={() => onPick(row)}>
                  <span className="w-full truncate text-base font-medium desktop:text-sm">{row.full_name}</span>
                  {row.email && <span className="w-full truncate text-sm text-muted-foreground">{row.email}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </ResponsiveSheetContent>
    </Sheet>
  );
}

/** What happened, and whether the email went out. */
function InviteDone({
  result,
  headingRef,
  onAnother,
}: {
  result: Done;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onAnother: () => void;
}) {
  const first = result.name.trim().split(/\s+/)[0] || result.name;
  const app = result.app === "portal" ? "the portal" : "finances";
  const heading = {
    invite: `Invite sent to ${first}`,
    resend: `Invite sent to ${first} again`,
    access: `${first} has new access`,
    unchanged: `${first} already has that access`,
  }[result.kind];
  const detail = {
    invite: `${result.name} will get an email at ${result.email} to set up their account in ${app}.`,
    resend: `Their first invite is still waiting, so ${result.email} got a new copy with any new access added.`,
    access: `${result.name} already has an account, so they got an email about the new access instead of an invite.`,
    unchanged: "Nothing changed, and no email went out.",
  }[result.kind];
  const emailProblem = result.kind === "unchanged" ? null : describeSend(result.sent);

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-xl border bg-card p-4 sm:p-6">
        <CircleCheckIcon className="size-6 text-muted-foreground" aria-hidden />
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
          {heading}
        </h2>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>

      {emailProblem && (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>The email didn&apos;t go out</AlertTitle>
          <AlertDescription>{emailProblem}</AlertDescription>
        </Alert>
      )}

      {result.warning && (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Their payee isn&apos;t linked</AlertTitle>
          <AlertDescription>{result.warning}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" className="h-11 px-6" onClick={onAnother}>
          Invite someone else
        </Button>
        <Button asChild variant="outline" className="h-11 px-6">
          <Link href="/people">Back to People</Link>
        </Button>
      </div>
    </div>
  );
}

function describeSend(sent: Done["sent"]): string | null {
  switch (sent) {
    case "sent":
    case null:
      return null;
    case "off":
      return "Email isn't set up here. Send them to the setup page yourself, and they'll use this email address.";
    case "skipped_quota":
      return "Today's email limit is nearly used up, so it was held back. Invite them again tomorrow to send it.";
    case "suppressed":
      return "Email to this address bounced or was marked as spam before. Check the address with them.";
    case "failed":
      return "Something went wrong sending it. Invite them again to try once more.";
  }
}
