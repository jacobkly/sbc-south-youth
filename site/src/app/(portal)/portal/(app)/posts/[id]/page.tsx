import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeftIcon, RotateCcwIcon } from "lucide-react";
import { NarrowPage } from "@/components/portal/nav/app-shell";
import { PastHeading } from "@/components/portal/posts/past-heading";
import { PostActions } from "@/components/portal/posts/post-actions";
import { PostBadges } from "@/components/portal/posts/post-badges";
import { PostForm } from "@/components/portal/posts/post-form";
import { Badge } from "@/components/portal/ui/badge";
import { Button } from "@/components/portal/ui/button";
import { readPortalEnv } from "@/lib/env";
import { publicSiteUrl } from "@/lib/host";
import { getCurrentUser } from "@/lib/portal/auth/current-user";
import { postState, whenLabel, type PostState } from "@/lib/portal/posts/list";
import { loadPost } from "@/lib/portal/posts/queries";
import { formValues } from "@/lib/portal/posts/save";
import { hasRole } from "@/lib/portal/roles";

export async function generateMetadata({ params }: PageProps<"/portal/posts/[id]">): Promise<Metadata> {
  const me = await getCurrentUser();
  if (!me || !hasRole(me.roles, "site_editor")) return { title: "Posts" };
  const post = await loadPost((await params).id);
  return { title: post?.title ?? "Posts" };
}

const STATE_LABELS: Record<PostState, string> = {
  live: "Up now",
  scheduled: "Scheduled",
  draft: "Draft",
  past: "Came down",
};

export default async function PostPage({ params }: PageProps<"/portal/posts/[id]">) {
  // The actions check again, and RLS checks after them.
  const me = await getCurrentUser();
  if (!me || !hasRole(me.roles, "site_editor")) notFound();
  const post = await loadPost((await params).id);
  if (!post) notFound();

  const now = new Date();
  const state = postState(post, now);
  const env = readPortalEnv();
  // Staging shares production's data, so it doesn't change heads-ups.
  const readOnly = env.appEnv === "staging";

  const back = (
    <Button variant="ghost" className="-ml-3 h-11 px-3 text-muted-foreground" asChild>
      <Link href="/posts">
        <ChevronLeftIcon aria-hidden />
        Posts
      </Link>
    </Button>
  );

  // One that's come down stays as it was. Posting it again makes a new one with the same words.
  if (state === "past") {
    return (
      <NarrowPage className="space-y-6">
        <div className="space-y-2">
          <div>{back}</div>
          <PastHeading>{post.title}</PastHeading>
          <p className="text-muted-foreground">{whenLabel(post, now)}.</p>
          <PostBadges post={post} />
        </div>

        {(post.body || post.link_url) && (
          <div className="space-y-2 rounded-xl border bg-card p-4">
            {post.body && <p className="whitespace-pre-line">{post.body}</p>}
            {post.link_url && (
              <p className="text-sm text-muted-foreground">
                {post.link_label ?? "Learn more"}: <span className="break-all">{post.link_url}</span>
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Button asChild className="h-11 px-6">
            <Link href={`/posts/new?from=${post.id}`}>
              <RotateCcwIcon aria-hidden />
              Post it again
            </Link>
          </Button>
          <p className="text-sm text-muted-foreground">
            Makes a new heads-up with the same words, up now through the end of the week. You can change anything
            first.
          </p>
        </div>
      </NarrowPage>
    );
  }

  return (
    <NarrowPage className="space-y-8">
      <div className="space-y-2">
        <div>{back}</div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit heads-up</h1>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
          <Badge variant={state === "live" ? "default" : "outline"}>{STATE_LABELS[state]}</Badge>
          <span>
            {whenLabel(post, now)}.{state === "draft" && " Only leaders see it until it's published."}
          </span>
        </p>
      </div>

      <PostForm
        id={post.id}
        initial={formValues(post, now)}
        state={state}
        liveStart={state === "live" ? post.starts_at : null}
        nowIso={now.toISOString()}
        siteUrl={publicSiteUrl(env.portalUrl)}
        showTemplates={false}
        readOnly={readOnly}
      />

      <PostActions id={post.id} state={state} readOnly={readOnly} />
    </NarrowPage>
  );
}
