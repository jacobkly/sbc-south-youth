import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowUpRightIcon, ChevronRightIcon } from "lucide-react";
import { AccountTheme } from "@/components/portal/account-theme";
import { AuthPage } from "@/components/portal/auth/auth-page";
import { SignOutButton } from "@/components/portal/auth/sign-out-button";
import { AppTile, DestinationLink } from "@/components/portal/nav/app-switcher";
import { START_PATH } from "@/lib/auth/next-path";
import { readPortalEnv } from "@/lib/env";
import { getCurrentUser, getSessionAal } from "@/lib/portal/auth/current-user";
import { mfaHref, ownerNeedsMfa } from "@/lib/portal/auth/mfa";
import { type Destination, destinationsFor, destinationUrls, onlyApp } from "@/lib/portal/destinations";
import { parseSavedTheme } from "@/lib/portal/theme";

export const metadata: Metadata = {
  title: "Where to?",
};

// It reads the sign-in cookie, so it renders on each request.
export const instant = false;

/**
 * Where signing in ends when no link asked for a page. Someone who uses
 * one app goes straight there. Someone with both picks one, or the public
 * site. With `?choose`, everyone picks, so a sign-in another app can't see
 * stops here instead of bouncing back to it.
 */
export default async function StartPage({ searchParams }: PageProps<"/portal/start">) {
  const choose = (await searchParams).choose !== undefined;
  const user = await getCurrentUser();
  if (!user?.is_active) redirect("/no-access");
  // Owners enter their code before going anywhere, finances included.
  if (ownerNeedsMfa(user.roles, await getSessionAal())) redirect(mfaHref(START_PATH));

  const destinations = destinationsFor(user, destinationUrls(), "portal");
  const only = onlyApp(destinations);
  if (only && !choose) redirect(only.href);
  // Nothing but the public site, which needs no sign-in.
  if (destinations.length === 1) redirect("/no-access");

  return (
    <>
      {/* The first page after signing in, so it applies the account's theme too. */}
      <AccountTheme
        userId={user.id}
        theme={parseSavedTheme(user.theme)}
        readOnly={readPortalEnv().appEnv === "staging"}
      />
      <StartChoices destinations={destinations} name={user.full_name} />
    </>
  );
}

function StartChoices({ destinations, name }: { destinations: Destination[]; name: string }) {
  return (
    <AuthPage title="Where to?" description={`Signed in as ${name}.`}>
      <ul className="mt-6 space-y-2">
        {destinations.map((destination) => (
          <li key={destination.key}>
            <DestinationLink
              destination={destination}
              className="flex min-h-16 items-center gap-3 rounded-xl border bg-card p-3 text-card-foreground shadow-xs outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <AppTile app={destination.key} className="size-10 rounded-lg" />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block font-medium">{destination.name}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{destination.description}</span>
              </span>
              {destination.key === "site" ? (
                <ArrowUpRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
            </DestinationLink>
          </li>
        ))}
      </ul>
      <div className="mt-8 flex justify-center border-t pt-6">
        <SignOutButton variant="link" className="h-11 text-muted-foreground hover:text-foreground" />
      </div>
    </AuthPage>
  );
}
