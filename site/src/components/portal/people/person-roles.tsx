"use client";

import { useRef, useState, useTransition } from "react";
import { CircleAlertIcon, CircleCheckIcon, LockIcon, TriangleAlertIcon } from "lucide-react";
import { cn } from "cn";
import { Alert, AlertDescription, AlertTitle } from "@/components/portal/ui/alert";
import { Button } from "@/components/portal/ui/button";
import { Checkbox } from "@/components/portal/ui/checkbox";
import { Label } from "@/components/portal/ui/label";
import { ResponsiveSheetContent } from "@/components/portal/ui/responsive-sheet";
import { Sheet, SheetClose, SheetDescription, SheetHeader, SheetTitle } from "@/components/portal/ui/sheet";
import { planRoles, type PersonControls, type PersonState, type RolesPlan } from "@/lib/portal/people/person";
import { saveRoles, type PersonResult } from "@/lib/portal/people/person-actions";
import { APP_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, sortRoles, type AppRole } from "@/lib/portal/roles";

type Change = Extract<RolesPlan, { kind: "change" }>;
type Message = { kind: "saved"; text: string; warning: string | null } | { kind: "error"; text: string };

/** A tappable row in the list of role checkboxes, with room for a description. */
const OPTION_ROW = "min-h-11 cursor-pointer items-start gap-3 px-4 py-3 font-normal leading-snug";

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function listRoles(roles: readonly AppRole[]): string {
  return sortRoles(roles)
    .filter((role) => role !== "owner")
    .map((role) => ROLE_LABELS[role])
    .join(", ");
}

/**
 * Someone's roles as checkboxes, Owner included. Giving or taking away
 * Owner asks first and says what it means. The last owner's box is locked,
 * and the database refuses it anyway.
 */
export function PersonRoles({
  person,
  name,
  meId,
  activeOwners,
  controls,
  payeeLinked,
  readOnly,
}: {
  person: PersonState;
  name: string;
  meId: string;
  activeOwners: number;
  controls: PersonControls;
  /** Whether finances already has their payee, for the Requester hint. */
  payeeLinked: boolean;
  readOnly: boolean;
}) {
  const [picked, setPicked] = useState<AppRole[]>(() => sortRoles(person.roles));
  const [message, setMessage] = useState<Message | null>(null);
  const [confirming, setConfirming] = useState<Change | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const saveButton = useRef<HTMLButtonElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  // Set once the sheet's change is saved or fails, so focus goes to the result instead of Save.
  const answered = useRef(false);

  const plan = planRoles({ person, meId, activeOwners, picked });
  const dirty = plan.kind !== "unchanged";
  const first = firstName(name);
  const owner = picked.includes("owner");
  const locked = !controls.editRoles || readOnly;

  function toggle(role: AppRole, checked: boolean) {
    setPicked((current) => sortRoles(checked ? [...current, role] : current.filter((held) => held !== role)));
    setMessage(null);
  }

  function save(change: Change) {
    startTransition(async () => {
      let result: PersonResult;
      try {
        result = await saveRoles(person.id, change.roles);
      } catch {
        result = { status: "failed", message: "Couldn't save the roles. Check your connection and try again." };
      }
      if (result.status === "done" && result.leftOwner) {
        // A full load, so the menu and every check start over without Owner.
        window.location.replace("/");
        return;
      }
      answered.current = true;
      setOpen(false);
      setMessage(
        result.status === "done"
          ? { kind: "saved", text: result.message, warning: result.warning }
          : { kind: "error", text: result.message },
      );
      // The sheet hands focus back on its own; otherwise the result is the next thing to read.
      if (!change.owner) requestAnimationFrame(() => messageRef.current?.focus());
    });
  }

  function submit() {
    setMessage(null);
    if (plan.kind === "invalid") {
      setMessage({ kind: "error", text: plan.message });
      requestAnimationFrame(() => messageRef.current?.focus());
      return;
    }
    if (plan.kind === "unchanged") return;
    if (plan.owner) {
      setConfirming(plan);
      setOpen(true);
      return;
    }
    save(plan);
  }

  return (
    <section aria-labelledby="roles-heading" className="space-y-4">
      <div className="space-y-1">
        <h2 id="roles-heading" className="text-lg font-semibold">
          Roles
        </h2>
        <p className="text-sm text-muted-foreground">
          {controls.editRoles
            ? `What ${controls.you ? "you" : first} can do in the portal and finances.`
            : "Their access is removed. These come back if you reinstate them."}
        </p>
      </div>

      <form
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <fieldset disabled={locked || pending} className="min-w-0 space-y-4">
          <legend className="sr-only">Roles</legend>
          <div className="divide-y overflow-hidden rounded-xl border bg-card">
            {APP_ROLES.map((role) => {
              const id = `role-${role}`;
              const ownerLocked = role === "owner" && controls.ownerLock !== null;
              const newRequester =
                role === "finance_requester" && picked.includes(role) && !person.roles.includes(role) && !payeeLinked;
              const note = ownerLocked
                ? controls.ownerLock
                : newRequester
                  ? "Saving links the payee in finances with their email, or makes one."
                  : null;
              return (
                <Label
                  key={role}
                  htmlFor={id}
                  className={cn(OPTION_ROW, (ownerLocked || locked) && "cursor-not-allowed")}
                >
                  <Checkbox
                    id={id}
                    className="mt-0.5"
                    checked={picked.includes(role)}
                    disabled={ownerLocked}
                    aria-labelledby={`${id}-title`}
                    aria-describedby={`${id}-description${note ? ` ${id}-note` : ""}`}
                    onCheckedChange={(checked) => toggle(role, checked === true)}
                  />
                  <span className="min-w-0 space-y-0.5">
                    <span id={`${id}-title`} className="block text-base font-medium desktop:text-sm">
                      {ROLE_LABELS[role]}
                    </span>
                    <span id={`${id}-description`} className="block text-sm text-muted-foreground">
                      {ROLE_DESCRIPTIONS[role]}
                    </span>
                    {note && (
                      <span id={`${id}-note`} className="flex items-start gap-1.5 pt-1 text-sm text-foreground">
                        {ownerLocked && <LockIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
                        {note}
                      </span>
                    )}
                  </span>
                </Label>
              );
            })}
          </div>

          {owner && controls.editRoles && (
            <p className="text-sm text-muted-foreground">
              Owner already covers every role. The others are what {controls.you ? "you keep" : `${first} keeps`} if
              Owner is taken away.
            </p>
          )}

          {controls.editRoles && (
            <Button ref={saveButton} type="submit" className="h-11 w-full px-6 sm:w-auto" disabled={!dirty}>
              {pending ? "Saving…" : "Save roles"}
            </Button>
          )}
        </fieldset>
      </form>

      <div ref={messageRef} tabIndex={-1} className="outline-none empty:hidden">
        {message?.kind === "error" && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}
        {message?.kind === "saved" && (
          <div className="space-y-3">
            <p role="status" className="flex items-start gap-2 text-sm text-muted-foreground">
              <CircleCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              {message.text}
            </p>
            {message.warning && (
              <Alert>
                <TriangleAlertIcon />
                <AlertTitle>One thing didn&apos;t work</AlertTitle>
                <AlertDescription>{message.warning}</AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </div>

      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
      >
        <ResponsiveSheetContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            (answered.current ? messageRef : saveButton).current?.focus();
            answered.current = false;
          }}
        >
          {confirming && (
            <OwnerConfirm change={confirming} name={name} you={controls.you} pending={pending} onConfirm={save} />
          )}
        </ResponsiveSheetContent>
      </Sheet>
    </section>
  );
}

/** What giving or taking away Owner means, before it happens. */
function OwnerConfirm({
  change,
  name,
  you,
  pending,
  onConfirm,
}: {
  change: Change;
  name: string;
  you: boolean;
  pending: boolean;
  onConfirm: (change: Change) => void;
}) {
  const first = firstName(name);
  const kept = listRoles(change.roles);
  const copy =
    change.owner === "grant"
      ? {
          title: `Make ${first} an owner?`,
          body: [
            "Owners can do everything in the portal and finances: invite people, change anyone's roles, remove " +
              "access, and approve and pay reimbursements.",
            `${first} will set up two-step sign-in with an authenticator app the next time they open the portal.`,
          ],
          action: "Make owner",
          pendingAction: "Saving…",
        }
      : you
        ? {
            title: "Give up Owner?",
            body: [
              "You won't be able to manage people or approve and pay reimbursements anymore, and you'll leave this " +
                "page.",
              `You'll keep: ${kept}.`,
            ],
            action: "Give up Owner",
            pendingAction: "Saving…",
          }
        : {
            title: `Take Owner away from ${first}?`,
            body: [
              "They won't be able to manage people or approve and pay reimbursements anymore.",
              `They'll keep: ${kept}.`,
            ],
            action: "Take away Owner",
            pendingAction: "Saving…",
          };

  return (
    <>
      <SheetHeader className="pr-12">
        <SheetTitle>{copy.title}</SheetTitle>
        <SheetDescription asChild>
          <div className="space-y-2">
            {copy.body.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col-reverse gap-2 px-4 pt-2 desktop:flex-row desktop:justify-end">
        <SheetClose asChild>
          <Button type="button" variant="outline" className="h-11 desktop:min-w-28" disabled={pending}>
            Cancel
          </Button>
        </SheetClose>
        <Button
          type="button"
          variant={change.owner === "grant" ? "default" : "destructive"}
          className="h-11 desktop:min-w-28"
          disabled={pending}
          onClick={() => onConfirm(change)}
        >
          {pending ? copy.pendingAction : copy.action}
        </Button>
      </div>
    </>
  );
}
