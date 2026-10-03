import { ArrowRightIcon, ReceiptTextIcon } from "lucide-react";
import { NarrowPage } from "@/components/portal/nav/app-shell";
import { Button } from "@/components/portal/ui/button";
import { readPortalEnv } from "@/lib/env";
import { getCurrentUser } from "@/lib/portal/auth/current-user";
import { comingSoonFor } from "@/lib/portal/nav-items";
import { canUseFinances, ROLE_DESCRIPTIONS, ROLE_LABELS, sortRoles } from "@/lib/portal/roles";

export default async function PortalHome() {
  // The layout already checked access, so this is an active person with a portal role.
  const user = await getCurrentUser();
  if (!user) return null;

  const firstName = user.full_name.trim().split(/\s+/)[0];
  // An owner's one role covers the rest, so list it alone.
  const roles = user.roles.includes("owner") ? (["owner"] as const) : sortRoles(user.roles);
  const comingSoon = comingSoonFor(user.roles);
  const financesUrl = canUseFinances(user.roles) ? readPortalEnv().financesUrl : null;

  return (
    <NarrowPage className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{firstName ? `Hi, ${firstName}` : "Welcome"}</h1>
        <p className="text-muted-foreground">This is where leaders keep the youth site and its people up to date.</p>
      </header>

      {financesUrl && (
        <section
          aria-labelledby="finances-heading"
          className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted" aria-hidden>
            <ReceiptTextIcon className="size-5 text-muted-foreground" />
          </span>
          <div className="min-w-0 flex-1 space-y-0.5">
            <h2 id="finances-heading" className="font-semibold">
              Finances
            </h2>
            <p className="text-sm text-muted-foreground">Reimbursements, receipts, and reports.</p>
          </div>
          <Button asChild variant="outline" className="h-11 px-5">
            <a href={financesUrl}>
              Open finances
              <ArrowRightIcon aria-hidden />
            </a>
          </Button>
        </section>
      )}

      <section aria-labelledby="access-heading" className="space-y-3">
        <h2 id="access-heading" className="text-lg font-semibold">
          Your access
        </h2>
        <ul className="divide-y rounded-xl border bg-card">
          {roles.map((role) => (
            <li key={role} className="space-y-0.5 p-4">
              <p className="font-medium">{ROLE_LABELS[role]}</p>
              <p className="text-sm text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
            </li>
          ))}
        </ul>
      </section>

      {comingSoon.length > 0 && (
        <section aria-labelledby="coming-heading" className="space-y-3">
          <div className="space-y-1">
            <h2 id="coming-heading" className="text-lg font-semibold">
              Coming soon
            </h2>
            <p className="text-sm text-muted-foreground">
              These join the menu as they&apos;re built, and you&apos;ll see the ones your access covers.
            </p>
          </div>
          <ul className="flex flex-wrap gap-2">
            {comingSoon.map((item) => (
              <li
                key={item.href}
                className="inline-flex h-9 items-center gap-2 rounded-full border bg-card px-3.5 text-sm"
              >
                <item.icon className="size-4 text-muted-foreground" aria-hidden />
                {item.label}
              </li>
            ))}
          </ul>
        </section>
      )}
    </NarrowPage>
  );
}
