"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRoundIcon, PlusIcon, SmartphoneIcon } from "lucide-react";
import { MfaSetup } from "@/components/portal/account/mfa-setup";
import { Button } from "@/components/portal/ui/button";
import { ResponsiveSheetContent } from "@/components/portal/ui/responsive-sheet";
import {
  Sheet,
  SheetClose,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/portal/ui/sheet";
import { describeMfaError, formatDeviceDate, mfaHref, type MfaDevice } from "@/lib/portal/auth/mfa";
import { createClient } from "@/lib/supabase/client";

type Message = { kind: "saved" | "error"; text: string };

/**
 * Account → Two-step sign-in: the authenticator apps this person signs in
 * with, adding another, and removing one. Supabase only allows changes from
 * a session that has entered a code. An owner always keeps at least one.
 */
export function MfaDevices({
  devices,
  owner,
  verified,
}: {
  devices: MfaDevice[];
  owner: boolean;
  /** Whether this session has entered a code, which changes need. */
  verified: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  // Kept after the sheet closes, so its title doesn't empty while it slides away.
  const [removing, setRemoving] = useState<MfaDevice | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  // The Remove button that opened the sheet, so focus goes back to it on cancel.
  const opener = useRef<HTMLButtonElement | null>(null);
  const removed = useRef(false);

  // An owner's last device stays: the portal won't let them in without one.
  const canRemove = verified && (!owner || devices.length > 1);

  async function remove(device: MfaDevice) {
    setPending(true);
    setRemoveError(null);
    const { error } = await createClient().auth.mfa.unenroll({ factorId: device.id });
    setPending(false);
    if (error) {
      setRemoveError(describeMfaError(error, `Couldn't remove ${device.name}. Try again.`).message);
      return;
    }

    removed.current = true;
    setConfirming(false);
    setMessage({ kind: "saved", text: `Removed ${device.name}. Delete it from your authenticator app too.` });
    router.refresh();
  }

  return (
    <section className="space-y-4" aria-labelledby="mfa-heading">
      <div className="space-y-1">
        <h2 id="mfa-heading" className="text-lg font-semibold">
          Two-step sign-in
        </h2>
        <p className="text-sm text-muted-foreground">
          {owner ? "Owners sign in" : "You sign in"} with a password and a 6-digit code from an authenticator app.
        </p>
      </div>

      {devices.length > 0 ? (
        <ul className="divide-y rounded-xl border">
          {devices.map((device) => (
            <li key={device.id} className="flex min-h-16 items-center gap-3 py-2 pr-2 pl-4">
              <SmartphoneIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{device.name}</p>
                <p className="text-xs text-muted-foreground">Added {formatDeviceDate(device.createdAt)}</p>
              </div>
              {canRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 text-destructive hover:text-destructive"
                  aria-label={`Remove ${device.name}`}
                  onClick={(event) => {
                    opener.current = event.currentTarget;
                    setMessage(null);
                    setRemoveError(null);
                    setRemoving(device);
                    setConfirming(true);
                  }}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          No authenticator apps yet.
        </p>
      )}

      {owner && devices.length === 1 && (
        <p className="text-xs text-muted-foreground">
          Add a backup, like a second phone or a password manager, so losing your phone doesn&apos;t lock you out.
        </p>
      )}

      {verified ? (
        <Sheet open={adding} onOpenChange={setAdding}>
          <SheetTrigger asChild>
            <Button
              ref={addButton}
              type="button"
              variant="outline"
              className="h-11 w-full sm:w-auto sm:px-6"
              onClick={() => setMessage(null)}
            >
              <PlusIcon aria-hidden />
              Add a device
            </Button>
          </SheetTrigger>
          <ResponsiveSheetContent>
            <SheetHeader className="pr-12">
              <SheetTitle>Add a device</SheetTitle>
              <SheetDescription>Then you can sign in with a code from either one.</SheetDescription>
            </SheetHeader>
            <div className="px-4">
              <MfaSetup
                existingNames={devices.map((device) => device.name)}
                submitLabel="Add device"
                onDone={(name) => {
                  setAdding(false);
                  setMessage({ kind: "saved", text: `Added ${name}.` });
                  router.refresh();
                }}
              />
            </div>
          </ResponsiveSheetContent>
        </Sheet>
      ) : (
        // Someone who skipped the code at sign-in enters one now. Only non-owners can skip it.
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">To add or remove a device, enter a code from one first.</p>
          <Button asChild variant="outline" className="h-11 w-full sm:w-auto sm:px-6">
            <Link href={mfaHref("/account")}>
              <KeyRoundIcon aria-hidden />
              Enter a code
            </Link>
          </Button>
        </div>
      )}

      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={message.kind === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
        >
          {message.text}
        </p>
      )}

      <Sheet
        open={confirming}
        onOpenChange={(open) => {
          if (!pending) setConfirming(open);
        }}
      >
        <ResponsiveSheetContent
          onCloseAutoFocus={(event) => {
            // Back to the Remove button, or, once its row is gone, to the next thing to do.
            event.preventDefault();
            (removed.current ? addButton : opener).current?.focus();
            removed.current = false;
          }}
        >
          <SheetHeader className="pr-12">
            <SheetTitle>Remove {removing?.name}?</SheetTitle>
            <SheetDescription>Codes from it won&apos;t work for signing in anymore.</SheetDescription>
          </SheetHeader>
          {removeError && (
            <p role="alert" className="px-4 text-sm text-destructive">
              {removeError}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 px-4 pt-2 desktop:flex-row desktop:justify-end">
            <SheetClose asChild>
              <Button type="button" variant="outline" className="h-11 desktop:min-w-28" disabled={pending}>
                Cancel
              </Button>
            </SheetClose>
            <Button
              type="button"
              variant="destructive"
              className="h-11 desktop:min-w-28"
              disabled={pending}
              onClick={() => removing && void remove(removing)}
            >
              {pending ? "Removing…" : "Remove"}
            </Button>
          </div>
        </ResponsiveSheetContent>
      </Sheet>
    </section>
  );
}
