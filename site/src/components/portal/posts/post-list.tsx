import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { whenLabel, type PostRow } from "@/lib/portal/posts/list";
import { PostBadges } from "./post-badges";

const ROW =
  "flex min-w-0 items-start gap-3 p-4 outline-none hover:bg-muted/50 " +
  "focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset";

/** One group of heads-ups, each opening its own page. Nothing at all when the group is empty. */
export function PostSection({
  id,
  title,
  description,
  posts,
  now,
  onHome = false,
}: {
  id: string;
  title: string;
  description: string;
  posts: PostRow[];
  now: Date;
  /** The first live heads-up is the one Home shows. */
  onHome?: boolean;
}) {
  if (posts.length === 0) return null;
  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-3">
      <div className="space-y-1">
        <h2 id={`${id}-heading`} className="flex items-baseline gap-2 text-lg font-semibold">
          {title}
          <span className="text-sm font-normal text-muted-foreground">{posts.length}</span>
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {posts.map((post, index) => (
          <li key={post.id}>
            <Link href={`/posts/${post.id}`} className={ROW}>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="line-clamp-2 font-medium text-pretty">{post.title}</p>
                {post.body && <p className="line-clamp-1 text-sm text-muted-foreground">{post.body}</p>}
                <p className="text-sm text-muted-foreground">{whenLabel(post, now)}</p>
                <PostBadges post={post} onHome={onHome && index === 0} />
              </div>
              <ChevronRightIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
