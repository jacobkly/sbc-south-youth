import { MapPin, Repeat, Star, Ticket } from "lucide-react";
import Link from "next/link";
import { Tag } from "@/components/tag";
import { itemTimeLabel, type FeedItem } from "@/lib/feed";
import { photoSizes } from "@/lib/photo-sizes";
import { Photo } from "./photo";

/**
 * One thing on the agenda. The whole card is the link to its page.
 * Featured events get a big photo card so they stand out in the list.
 */
export function EventCard({ item }: { item: FeedItem }) {
  return item.featured ? <FeaturedCard item={item} /> : <RowCard item={item} />;
}

function Details({ item, onPhoto = false }: { item: FeedItem; onPhoto?: boolean }) {
  const muted = onPhoto ? "text-white/75" : "text-muted";
  return (
    <>
      {item.locationName && (
        <p className={`flex items-center gap-1.5 text-small ${muted}`}>
          <MapPin aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{item.locationName}</span>
        </p>
      )}
      {item.costNote && (
        <p className={`flex items-center gap-1.5 text-small ${muted}`}>
          <Ticket aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{item.costNote}</span>
        </p>
      )}
    </>
  );
}

function When({ item, className }: { item: FeedItem; className: string }) {
  return (
    <p className={`flex flex-wrap items-center gap-x-2 text-small font-semibold ${className}`}>
      {itemTimeLabel(item)}
      {item.kind === "gathering" && (
        <span className="inline-flex items-center gap-1 font-medium">
          <Repeat aria-hidden className="size-3" />
          Weekly
        </span>
      )}
    </p>
  );
}

// On phones the details run full width under the thumbnail, so places
// and prices don't get cut short. Wider, they sit beside it.
function RowCard({ item }: { item: FeedItem }) {
  return (
    <Link
      href={`/events/${item.slug}`}
      className="pressable grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 rounded-card bg-surface p-3 pl-4 ring-1 ring-line ring-inset hover:bg-surface-2 sm:gap-x-4 sm:pl-5"
    >
      <div className="flex flex-col gap-1 pt-1">
        <When item={item} className="text-accent-ink" />
        <h3 className="font-display text-lg leading-tight font-bold text-balance">{item.title}</h3>
      </div>
      {/* The title says what it is, so the thumbnail is decorative. */}
      <div className="relative size-16 overflow-hidden rounded-[14px] sm:row-span-2 sm:size-24">
        <Photo photo={item.photo && { ...item.photo, alt: "" }} seed={item.slug} sizes="96px" />
      </div>
      <div className="col-span-2 flex flex-col gap-0.5 pt-1.5 pb-1 empty:hidden sm:col-span-1">
        <Details item={item} />
      </div>
    </Link>
  );
}

// The agenda column, beside Heads up from lg up.
const agendaSizes = photoSizes({ lg: 3 / 4 });

function FeaturedCard({ item }: { item: FeedItem }) {
  return (
    <Link
      href={`/events/${item.slug}`}
      data-theme="dark"
      className="pressable group/card relative isolate flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-card p-5 text-white sm:aspect-[2/1] sm:p-6"
    >
      <Photo
        photo={item.photo && { ...item.photo, alt: "" }}
        seed={item.slug}
        sizes={agendaSizes}
        className="-z-10 transition-transform duration-700 ease-out-soft group-hover/card:scale-[1.03] motion-reduce:transition-none"
      />
      <div className="absolute inset-0 -z-10 bg-linear-to-t from-black/90 via-black/75 via-50% to-black/20" />
      <div className="flex flex-wrap gap-1.5">
        <Tag tone="solid">
          <Star aria-hidden className="mr-1 size-3 fill-current" />
          Featured
        </Tag>
      </div>
      <h3 className="mt-3 font-display text-h2 text-balance">{item.title}</h3>
      <When item={item} className="mt-1 text-base text-accent" />
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5">
        <Details item={item} onPhoto />
      </div>
    </Link>
  );
}
