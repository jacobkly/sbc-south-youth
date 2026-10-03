import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { photoSizes } from "@/lib/photo-sizes";
import { PostTags, type PostLike } from "./announcement-card";
import { tileClasses } from "./bento-tile";
import { Photo } from "./photo";

/**
 * The pinned announcement, or the newest, as a poster. Its button is the
 * link. The first standing note takes its place when nothing is posted.
 */
export function Spotlight({ post }: { post: PostLike }) {
  const cta = post.cta ?? { label: "More on This Week", href: "/this-week" };
  const external = /^https?:\/\//.test(cta.href);

  return (
    <PosterCard
      title={post.title}
      body={post.body}
      photo={<Photo photo={post.photo} seed={post.id} sizes={spotlightSizes} className={posterPhoto} />}
      tags={<PostTags post={post} />}
      action={
        external ? (
          <a href={cta.href} className={posterLink}>
            {cta.label}
            <ArrowUpRight aria-hidden className="size-4" />
          </a>
        ) : (
          <Link href={cta.href} className={posterLink}>
            {cta.label}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        )
      }
    />
  );
}

// Three of four columns from lg up, then two of five.
const spotlightSizes = photoSizes({ wide: 2 / 5, lg: 3 / 4 });
const posterPhoto =
  "-z-10 transition-transform duration-700 ease-out-soft group-has-[a:hover]/poster:scale-[1.03] motion-reduce:transition-none";
// The whole card is the link, and the button's label names it.
// No blur behind it: a backdrop filter would pin the link's ::after to the button.
const posterLink =
  "inline-flex h-11 items-center gap-2 rounded-full bg-white/12 px-5 font-semibold text-white ring-1 ring-white/25 transition-colors ring-inset group-has-[a:hover]/poster:bg-white/20 after:absolute after:inset-0 after:rounded-card";

function PosterCard({
  title,
  body,
  photo,
  tags,
  action,
}: {
  title: string;
  body: string;
  photo: ReactNode;
  tags?: ReactNode;
  action: ReactNode;
}) {
  return (
    <article
      data-theme="dark"
      className={tileClasses(
        "photo",
        "group/poster min-h-[27rem] justify-end p-5 transition-[scale] duration-150 ease-out-soft has-[a:active]:scale-[0.99] motion-reduce:transition-none sm:p-7 md:min-h-[26rem] lg:min-h-0 lg:p-9",
      )}
    >
      {photo}
      {/* Clear up top, dark behind the words. */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-t from-bg via-bg/75 via-45% to-bg/0" />
      {tags}
      <h3 className="mt-4 max-w-[15ch] font-display text-h1 text-balance">{title}</h3>
      <p className="mt-3 line-clamp-3 max-w-xl text-pretty text-fg/85 lg:text-lg">{body}</p>
      <div className="mt-6">{action}</div>
    </article>
  );
}
