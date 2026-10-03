import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserPlusIcon } from "lucide-react";
import { NarrowPage } from "@/components/portal/nav/app-shell";
import { PeopleList } from "@/components/portal/people/people-list";
import { Button } from "@/components/portal/ui/button";
import { getCurrentUser } from "@/lib/portal/auth/current-user";
import { loadPeople } from "@/lib/portal/people/queries";

export const metadata: Metadata = {
  title: "People",
};

export default async function PeoplePage() {
  // Only owners manage people. RLS keeps everyone else from reading the list anyway.
  const me = await getCurrentUser();
  if (!me?.roles.includes("owner")) notFound();

  const people = await loadPeople(me.id, new Date());
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

      <PeopleList people={people} />

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
