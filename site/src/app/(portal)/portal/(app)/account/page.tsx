import type { Metadata } from "next";
import { AccountForm } from "@/components/portal/account/account-form";
import { AvatarForm } from "@/components/portal/account/avatar-form";
import { MfaDevices } from "@/components/portal/account/mfa-devices";
import { PasswordForm } from "@/components/portal/account/password-form";
import { ThemePicker } from "@/components/portal/account/theme-picker";
import { SignOutButton } from "@/components/portal/auth/sign-out-button";
import { NarrowPage } from "@/components/portal/nav/app-shell";
import { Badge } from "@/components/portal/ui/badge";
import { Separator } from "@/components/portal/ui/separator";
import { readPortalEnv } from "@/lib/env";
import { getCurrentUser, getMfaDevices, getSessionAal } from "@/lib/portal/auth/current-user";
import { ROLE_LABELS, sortRoles } from "@/lib/portal/roles";

export const metadata: Metadata = {
  title: "Account",
};

export default async function AccountPage() {
  // The layout already checked access, so this is an active person with a portal role.
  const user = await getCurrentUser();
  if (!user) return null;
  const owner = user.roles.includes("owner");
  const [devices, aal] = await Promise.all([getMfaDevices(), getSessionAal()]);

  // Staging shares production's data, and these forms save straight from
  // the browser, so they're turned off there.
  const readOnly = readPortalEnv().appEnv === "staging";

  return (
    <NarrowPage className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>

      {/* A disabled fieldset turns off every control inside it. */}
      <fieldset disabled={readOnly} className="min-w-0 space-y-6">
        <AvatarForm userId={user.id} name={user.full_name} avatarPath={user.avatar_path} />

        <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Email</dt>
          <dd className="truncate">{user.email}</dd>
          <dt className="text-muted-foreground">Access</dt>
          <dd className="flex flex-wrap gap-1.5">
            {sortRoles(user.roles).map((role) => (
              <Badge key={role} variant="secondary">
                {ROLE_LABELS[role]}
              </Badge>
            ))}
          </dd>
        </dl>

        <AccountForm userId={user.id} fullName={user.full_name} />
      </fieldset>

      <Separator />

      <ThemePicker userId={readOnly ? null : user.id} />

      <Separator />

      <section className="space-y-4" aria-labelledby="password-heading">
        <h2 id="password-heading" className="text-lg font-semibold">
          Password
        </h2>
        <fieldset disabled={readOnly} className="min-w-0">
          <PasswordForm email={user.email} />
        </fieldset>
      </section>

      {/* Only owners need it, but anyone else who has a device can still manage it. */}
      {(owner || devices.length > 0) && (
        <>
          <Separator />
          <fieldset disabled={readOnly} className="min-w-0">
            <MfaDevices devices={devices} owner={owner} verified={aal === "aal2"} />
          </fieldset>
        </>
      )}

      <Separator />

      <SignOutButton variant="outline" className="h-11 w-full sm:w-auto sm:px-6" />
    </NarrowPage>
  );
}
