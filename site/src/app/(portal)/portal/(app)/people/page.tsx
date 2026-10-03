import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserPlusIcon } from "lucide-react";
import { NarrowPage } from "@/components/portal/nav/app-shell";
import { UserAvatar } from "@/components/portal/nav/user-avatar";
import { Badge } from "@/components/portal/ui/badge";
import { Button } from "@/components/portal/ui/button";
import { getCurrentUser } from "@/lib/portal/auth/current-user";
import { listPeople, type PersonStatus } from "@/lib/portal/people/list";
import { ROLE_LABELS } from "@/lib/portal/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "People",
};

const STATUS_BADGES: Record<Exclude<PersonStatus, "active">, { label: string; variant: "outline" | "destructive" }> = {
  invited: { label: "Invited", variant: "outline" },
  removed: { label: "Removed", variant: "destructive" },
  no_access: { label: "No access", variant: "outline" },
};

export default async function PeoplePage() {
  // Only owners manage people. RLS keeps everyone else from reading the list anyway.
  const me = await getCurrentUser();
  if (!me?.roles.includes("owner")) notFound();

  const supabase = await createClient();
  const [users, invites] = await Promise.all([
    supabase.from("users").select("id, full_name, email, avatar_path, roles, is_active"),
    supabase.from("invites").select("user_id, status"),
  ]);
  if (users.error) throw users.error;
  if (invites.error) throw invites.error;
  const people = listPeople(users.data, invites.data, me.id);
  const onlyYou = people.every((person) => person.you);

  return (
    <NarrowPage className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">People</h1>
        <Button asChild className="h-11 px-5">
          <Link href="/people/invite">
            <UserPlusIcon aria-hidden />
            Invite
          </Link>
        </Button>
      </header>

      <ul className="divide-y rounded-xl border bg-card" aria-label="People">
        {people.map((person) => {
          const status = person.status === "active" ? null : STATUS_BADGES[person.status];
          return (
            <li key={person.id} className="flex min-w-0 items-start gap-3 p-4">
              <UserAvatar name={person.name} path={person.avatarPath} className="mt-0.5 size-10" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="min-w-0">
                  <p className="flex min-w-0 items-baseline gap-1.5 font-medium">
                    <span className="truncate">{person.name}</span>
                    {person.you && <span className="shrink-0 text-sm font-normal text-muted-foreground">(you)</span>}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{person.email}</p>
                </div>
                {(status || person.roles.length > 0) && (
                  <p className="flex flex-wrap gap-1.5">
                    {status && <Badge variant={status.variant}>{status.label}</Badge>}
                    {person.roles.map((role) => (
                      <Badge key={role} variant="secondary">
                        {ROLE_LABELS[role]}
                      </Badge>
                    ))}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {onlyYou && (
        <section aria-labelledby="empty-heading" className="space-y-3 rounded-xl border border-dashed p-6 text-center">
          <UserPlusIcon className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <div className="space-y-1">
            <h2 id="empty-heading" className="font-semibold">
              It&apos;s just you so far
            </h2>
            <p className="text-sm text-balance text-muted-foreground">
              Invite other leaders and pick what each one can do. They&apos;ll get an email to set up their account.
            </p>
          </div>
          <Button asChild variant="outline" className="h-11 px-5">
            <Link href="/people/invite">Invite someone</Link>
          </Button>
        </section>
      )}
    </NarrowPage>
  );
}
