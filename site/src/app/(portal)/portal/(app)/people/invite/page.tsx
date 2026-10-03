import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { NarrowPage } from "@/components/portal/nav/app-shell";
import { InviteForm } from "@/components/portal/people/invite-form";
import { Button } from "@/components/portal/ui/button";
import { readPortalEnv } from "@/lib/env";
import { getCurrentUser } from "@/lib/portal/auth/current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Invite someone",
};

export default async function InvitePage() {
  // The action checks again, and RLS and the RPCs check after it.
  const me = await getCurrentUser();
  if (!me?.roles.includes("owner")) notFound();

  // Payees nobody is linked to yet, for a requester who's already been paid before.
  const supabase = await createClient();
  const { data: payees, error } = await supabase
    .from("payees")
    .select("id, full_name, email")
    .is("user_id", null)
    .eq("is_active", true)
    .order("full_name");
  if (error) throw error;

  // Staging shares production's data, so it doesn't invite anyone.
  const readOnly = readPortalEnv().appEnv === "staging";

  return (
    <NarrowPage className="space-y-6">
      <div className="space-y-1">
        <Button variant="ghost" className="-ml-3 h-11 px-3 text-muted-foreground" asChild>
          <Link href="/people">
            <ChevronLeftIcon aria-hidden />
            People
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Invite someone</h1>
        <p className="text-muted-foreground">
          They&apos;ll get an email to set up their account, then sign in with their email and a password.
        </p>
      </div>

      <InviteForm payees={payees} readOnly={readOnly} />
    </NarrowPage>
  );
}
