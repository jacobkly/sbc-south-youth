import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ChevronLeftIcon, ExternalLinkIcon, TriangleAlertIcon } from "lucide-react";
import { NarrowPage } from "@/components/portal/nav/app-shell";
import { UserAvatar } from "@/components/portal/nav/user-avatar";
import { PersonAccess } from "@/components/portal/people/person-access";
import { PersonRoles } from "@/components/portal/people/person-roles";
import { Alert, AlertDescription } from "@/components/portal/ui/alert";
import { Badge } from "@/components/portal/ui/badge";
import { Button } from "@/components/portal/ui/button";
import { Separator } from "@/components/portal/ui/separator";
import { readPortalEnv } from "@/lib/env";
import { getCurrentUser } from "@/lib/portal/auth/current-user";
import { personStatus, STATUS_LABELS, STATUS_VARIANTS } from "@/lib/portal/people/list";
import { inviteLabel, lastSeenLabel, personControls, relativeDay } from "@/lib/portal/people/person";
import { loadPerson } from "@/lib/portal/people/queries";

export async function generateMetadata({ params }: PageProps<"/portal/people/[id]">): Promise<Metadata> {
  const me = await getCurrentUser();
  if (!me?.roles.includes("owner")) return { title: "People" };
  const person = await loadPerson((await params).id);
  return { title: person?.name ?? "People" };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default async function PersonPage({ params }: PageProps<"/portal/people/[id]">) {
  // The actions check again, and RLS and the RPCs check after them.
  const me = await getCurrentUser();
  if (!me?.roles.includes("owner")) notFound();
  const person = await loadPerson((await params).id);
  if (!person) notFound();

  const now = new Date();
  const state = {
    id: person.id,
    roles: person.roles,
    isActive: person.isActive,
    invite: person.invite?.status ?? null,
  };
  const controls = personControls(state, me.id, person.activeOwners);
  const status = personStatus(person.isActive, person.roles, person.invite?.status);
  const env = readPortalEnv();
  // Staging shares production's data, so it changes nobody's access.
  const readOnly = env.appEnv === "staging";
  const requester = person.roles.includes("finance_requester");

  return (
    <NarrowPage className="space-y-8">
      <div className="space-y-4">
        <Button variant="ghost" className="-ml-3 h-11 px-3 text-muted-foreground" asChild>
          <Link href="/people">
            <ChevronLeftIcon aria-hidden />
            People
          </Link>
        </Button>

        <header className="flex items-center gap-4">
          <UserAvatar name={person.name} path={person.avatarPath} className="size-16 text-xl" />
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight break-words">
              {person.name}
              {controls.you && <span className="ml-2 text-base font-normal text-muted-foreground">(you)</span>}
            </h1>
            <p className="truncate text-muted-foreground">{person.email}</p>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {status !== "active" && <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>}
              {lastSeenLabel(person.lastSeenAt, now)}
            </p>
          </div>
        </header>
      </div>

      {readOnly && (
        <Alert>
          <TriangleAlertIcon />
          <AlertDescription>
            This is the staging copy of the portal, so it can&apos;t change anyone&apos;s access. Use the real portal
            for that.
          </AlertDescription>
        </Alert>
      )}

      <dl className="divide-y rounded-xl border bg-card text-sm">
        {person.invite && <Detail term="Invite">{inviteLabel(person.invite, now)}</Detail>}
        <Detail term="Added">{capitalize(relativeDay(person.createdAt, now))}</Detail>
        {(person.payee || requester) && (
          <Detail term="Payee">
            {person.payee ? (
              <a
                href={`${env.financesUrl}/admin/payees/${person.payee.id}`}
                className="inline-flex items-center gap-1.5 py-1 underline-offset-4 hover:underline"
              >
                {person.payee.name}
                <span className="sr-only">(opens finances)</span>
                <ExternalLinkIcon className="size-3.5 text-muted-foreground" aria-hidden />
              </a>
            ) : (
              <span className="text-muted-foreground">Not linked yet. Link one from Payees in finances.</span>
            )}
          </Detail>
        )}
      </dl>

      <PersonRoles
        // Starts over when access is removed or given back, so an older roles message doesn't linger.
        key={String(person.isActive)}
        person={state}
        name={person.name}
        meId={me.id}
        activeOwners={person.activeOwners}
        controls={controls}
        payeeLinked={person.payee !== null}
        readOnly={readOnly}
      />

      <Separator />

      <PersonAccess userId={person.id} name={person.name} controls={controls} readOnly={readOnly} />
    </NarrowPage>
  );
}

function Detail({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <dt className="shrink-0 text-muted-foreground sm:w-24">{term}</dt>
      <dd className="min-w-0 font-medium">{children}</dd>
    </div>
  );
}
