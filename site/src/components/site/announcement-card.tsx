import { ArrowRight, ArrowUpRight, Pin } from "lucide-react";
import Link from "next/link";
import { Tag } from "@/components/tag";
import type { StandingNote } from "@/lib/content/types";
import { photoSizes } from "@/lib/photo-sizes";
import { Photo } from "./photo";

// A row of cards on phones and wide screens, and a 20rem column on desktop.
const noteSizes = photoSizes({ lg: 1 / 3, md: 1 / 2, phone: 0.85 });

/**
 * A post or standing note in Heads up. With a button, the whole card is
 * the link, and the button's label names it.
 */
export function AnnouncementCard({ post, eager = false }: { post: StandingNote & { pinned?: boolean }; eager?: boolean }) {
  const external = post.cta && /^https?:\/\//.test(post.cta.href);
  const Arrow = external ? ArrowUpRight : ArrowRight;
  // Without a photo, everything sits at the bottom under a bigger title, so a
  // card stretched to its row's height reads like a poster, not an empty box.
  const linkClasses = `${post.photo ? "mt-auto " : ""}inline-flex items-center gap-1.5 pt-4 font-semibold text-accent-ink after:absolute after:inset-0 after:rounded-card`;

  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-card bg-surface ring-1 ring-line ring-inset has-[a:hover]:bg-surface-2">
      {post.photo && (
        <div className="relative aspect-[2/1] shrink-0">
          <Photo photo={post.photo} seed={post.id} sizes={noteSizes} eager={eager} />
        </div>
      )}
      <div className={`flex flex-1 flex-col p-5 ${post.photo ? "" : "justify-end"}`}>
        {post.pinned && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {post.pinned && (
              <Tag tone="accent">
                <Pin aria-hidden className="mr-1 size-3" />
                Pinned
              </Tag>
            )}
          </div>
        )}
        <h3 className={`font-display font-bold text-balance ${post.photo ? "text-h3" : "text-h2"}`}>{post.title}</h3>
        <p className="mt-1.5 text-small whitespace-pre-line text-pretty text-muted">{post.body}</p>
        {post.cta &&
          (external ? (
            <a href={post.cta.href} className={linkClasses}>
              {post.cta.label}
              <Arrow aria-hidden className="size-4" />
            </a>
          ) : (
            <Link href={post.cta.href} className={linkClasses}>
              {post.cta.label}
              <Arrow aria-hidden className="size-4" />
            </Link>
          ))}
      </div>
    </article>
  );
}
