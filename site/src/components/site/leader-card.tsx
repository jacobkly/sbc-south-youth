import { Mail, Sparkles } from "lucide-react";
import { buttonClasses } from "@/components/button";
import { Tag } from "@/components/tag";
import type { Leader } from "@/lib/content/types";
import { initials } from "@/lib/initials";
import { Photo } from "./photo";

/** A leader: a 4:5 portrait, their name and role, a short bio, a fun fact, and an email link. */
export function LeaderCard({ leader }: { leader: Leader }) {
  const firstName = leader.name.trim().split(/\s+/)[0];

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-card bg-surface ring-1 ring-line ring-inset">
      <div className="relative isolate aspect-[4/5] overflow-hidden">
        <Photo
          photo={leader.photo}
          seed={leader.slug}
          label={initials(leader.name)}
          sizes="(min-width: 1024px) 500px, (min-width: 768px) 50vw, 100vw"
          className="-z-10"
        />
        {/* Always dark over the portrait, so the tag keeps its contrast in light mode. */}
        <div data-theme="dark" className="absolute top-5 left-5">
          <Tag tone="accent">{leader.role}</Tag>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h2 className="font-display text-h2">{leader.name}</h2>
        <p className="mt-2 text-pretty text-muted">{leader.bio}</p>

        <div className="mt-5 rounded-tile bg-surface-2 p-4">
          <p className="flex items-center gap-1.5 text-eyebrow text-accent-ink uppercase">
            <Sparkles aria-hidden className="size-3.5" />
            Fun fact
          </p>
          <p className="mt-1.5 text-pretty">{leader.funFact}</p>
        </div>

        {leader.email && (
          <div className="mt-auto pt-6">
            <a href={`mailto:${leader.email}`} className={buttonClasses({ variant: "secondary", className: "w-full sm:w-auto" })}>
              <Mail aria-hidden />
              Email {firstName}
            </a>
          </div>
        )}
      </div>
    </article>
  );
}
