import type { Metadata } from "next";
import { AccountForm } from "@/components/account/account-form";
import { AvatarForm } from "@/components/account/avatar-form";
import { MfaDevices } from "@/components/account/mfa-devices";
import { PasswordForm } from "@/components/account/password-form";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { NarrowPage } from "@/components/nav/app-shell";
import { Separator } from "@/components/ui/separator";
import { getCurrentUser, getMfaDevices, getSessionAal } from "@/lib/auth/current-user";
import { financeRoleLabel } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "Account",
};

export default async function AccountPage() {
  // The layout already checked access, so the user is active with a finance role.
  const user = await getCurrentUser();
  if (!user) return null;
  const owner = user.roles.includes("owner");
  const [devices, aal] = await Promise.all([getMfaDevices(), getSessionAal()]);

  return (
    <NarrowPage className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>

      <AvatarForm userId={user.id} name={user.full_name} avatarPath={user.avatar_path} />

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Email</dt>
        <dd className="truncate">{user.email}</dd>
        <dt className="text-muted-foreground">Role</dt>
        <dd>{financeRoleLabel(user.roles)}</dd>
      </dl>

      <AccountForm userId={user.id} fullName={user.full_name} />

      <Separator />

      <section className="space-y-4" aria-labelledby="password-heading">
        <h2 id="password-heading" className="text-lg font-semibold">
          Password
        </h2>
        <PasswordForm email={user.email} />
      </section>

      {/* Only owners need it, but anyone else who has a device can still manage it. */}
      {(owner || devices.length > 0) && (
        <>
          <Separator />
          <MfaDevices devices={devices} owner={owner} verified={aal === "aal2"} />
        </>
      )}

      <Separator />

      <SignOutButton variant="outline" className="h-11 w-full sm:w-auto sm:px-6" />
    </NarrowPage>
  );
}
