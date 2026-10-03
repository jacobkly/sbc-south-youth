import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { NarrowPage } from "@/components/portal/nav/app-shell";
import { PostForm } from "@/components/portal/posts/post-form";
import { Button } from "@/components/portal/ui/button";
import { readPortalEnv } from "@/lib/env";
import { publicSiteUrl } from "@/lib/host";
import { getCurrentUser } from "@/lib/portal/auth/current-user";
import { loadPost } from "@/lib/portal/posts/queries";
import { againValues, formValues } from "@/lib/portal/posts/save";
import { hasRole } from "@/lib/portal/roles";

export const metadata: Metadata = {
  title: "New heads-up",
};

export default async function NewPostPage({ searchParams }: PageProps<"/portal/posts/new">) {
  // The action checks again, and RLS checks after it.
  const me = await getCurrentUser();
  if (!me || !hasRole(me.roles, "site_editor")) notFound();

  // Posting one again starts from its words.
  const { from } = await searchParams;
  const source = typeof from === "string" ? await loadPost(from) : null;

  const now = new Date();
  const env = readPortalEnv();

  return (
    <NarrowPage className="space-y-6">
      <div className="space-y-1">
        <Button variant="ghost" className="-ml-3 h-11 px-3 text-muted-foreground" asChild>
          <Link href="/posts">
            <ChevronLeftIcon aria-hidden />
            Posts
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{source ? "Post it again" : "New heads-up"}</h1>
        <p className="text-muted-foreground">
          {source
            ? "The same words as before. Check the times, then publish."
            : "It shows on This Week while it's up, and the top one shows on Home too."}
        </p>
      </div>

      <PostForm
        id={null}
        initial={source ? againValues(source, now) : formValues(null, now)}
        state={null}
        liveStart={null}
        nowIso={now.toISOString()}
        siteUrl={publicSiteUrl(env.portalUrl)}
        showTemplates={!source}
        // Staging shares production's data, so it doesn't change heads-ups.
        readOnly={env.appEnv === "staging"}
      />
    </NarrowPage>
  );
}
