import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MegaphoneIcon, PlusIcon } from "lucide-react";
import { NarrowPage } from "@/components/portal/nav/app-shell";
import { PostSection } from "@/components/portal/posts/post-list";
import { Button } from "@/components/portal/ui/button";
import { getCurrentUser } from "@/lib/portal/auth/current-user";
import { groupPosts } from "@/lib/portal/posts/list";
import { loadPosts, PAST_LIMIT } from "@/lib/portal/posts/queries";
import { hasRole } from "@/lib/portal/roles";

export const metadata: Metadata = {
  title: "Posts",
};

export default async function PostsPage() {
  // Site editors and owners. RLS keeps everyone else from reading heads-ups anyway.
  const me = await getCurrentUser();
  if (!me || !hasRole(me.roles, "site_editor")) notFound();

  const now = new Date();
  const { current, past } = await loadPosts(now);
  const groups = groupPosts([...current, ...past], now);

  return (
    <NarrowPage className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Posts</h1>
          <p className="text-muted-foreground">Heads-ups on Home and This Week.</p>
        </div>
        <Button asChild className="h-11 shrink-0 px-5">
          <Link href="/posts/new">
            <PlusIcon aria-hidden />
            New
          </Link>
        </Button>
      </header>

      {current.length === 0 && (
        <section aria-labelledby="empty-heading" className="space-y-3 rounded-xl border border-dashed p-6 text-center">
          <MegaphoneIcon className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <div className="space-y-1">
            <h2 id="empty-heading" className="font-semibold">
              Nothing&apos;s up right now
            </h2>
            <p className="text-sm text-balance text-muted-foreground">
              Post a heads-up when plans change, merch comes in, or something special is coming. It shows on Home
              and This Week until it comes down.
            </p>
          </div>
          <Button asChild variant="outline" className="h-11 px-5">
            <Link href="/posts/new">Write a heads-up</Link>
          </Button>
        </section>
      )}

      <PostSection
        id="live"
        title="Up now"
        description="On This Week. Pinned ones come first, and the first one is on Home too."
        posts={groups.live}
        now={now}
        onHome
      />
      <PostSection
        id="scheduled"
        title="Scheduled"
        description="These go up on their own when their time comes."
        posts={groups.scheduled}
        now={now}
      />
      <PostSection
        id="drafts"
        title="Drafts"
        description="Only leaders see these until they're published."
        posts={groups.draft}
        now={now}
      />
      <PostSection
        id="past"
        title="Came down"
        description={`The last ${PAST_LIMIT}. Open one to post it again.`}
        posts={groups.past}
        now={now}
      />
    </NarrowPage>
  );
}
