import type { Metadata } from "next";
import { SmartphoneIcon } from "lucide-react";
import { NarrowPage } from "@/components/portal/nav/app-shell";
import { ThemePicker } from "@/components/portal/settings/theme-picker";
import { Separator } from "@/components/portal/ui/separator";
import { readPortalEnv } from "@/lib/env";
import { getCurrentUser } from "@/lib/portal/auth/current-user";
import { PORTAL_SHORT_NAME } from "@/lib/portal/install";

export const metadata: Metadata = {
  title: "Settings",
};

/** A button's name in the phone's own menus. */
const STEP = "font-medium text-foreground";

export default async function SettingsPage() {
  // The layout already checked access, so this is an active person with a portal role.
  const user = await getCurrentUser();
  if (!user) return null;
  // Staging shares production's data, so the theme stays on the device there.
  const readOnly = readPortalEnv().appEnv === "staging";

  return (
    <NarrowPage className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <ThemePicker userId={readOnly ? null : user.id} />

      <Separator />

      <section aria-labelledby="install-heading" className="space-y-3">
        <h2 id="install-heading" className="text-lg font-semibold">
          On your phone
        </h2>
        {/* Which one shows depends on whether the portal opened from the home screen. */}
        <div className="flex items-start gap-3 rounded-xl border bg-card p-4 installed:hidden">
          <SmartphoneIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="space-y-2 text-sm">
            <p>
              Add the portal to your home screen and it opens full screen as {PORTAL_SHORT_NAME}, like an app.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                iPhone: in Safari, tap Share, then <strong className={STEP}>Add to Home Screen</strong>.
              </li>
              <li>
                Android: in Chrome, tap the menu, then <strong className={STEP}>Add to Home screen</strong> or{" "}
                <strong className={STEP}>Install app</strong>.
              </li>
            </ul>
          </div>
        </div>
        <p className="hidden text-sm text-muted-foreground installed:block">
          You opened the portal from your home screen, so it&apos;s already set up on this phone.
        </p>
      </section>
    </NarrowPage>
  );
}
