import { MapPin } from "lucide-react";
import type { WeeklyGathering } from "@/lib/content/types";
import { formatClockRange, weekdayName } from "@/lib/schedule";
import { Photo } from "./photo";

/**
 * A weekly night: the day and time big over a photo, then what it is and
 * where. `wide` puts the text beside the photo from tablets up, for a
 * card that has the row to itself.
 */
export function GatheringCard({ gathering, wide = false }: { gathering: WeeklyGathering; wide?: boolean }) {
  const day = weekdayName(gathering.weekday, { plural: true });
  const time = formatClockRange(gathering.startTime, gathering.endTime);

  return (
    <article
      className={`overflow-hidden rounded-card bg-surface ring-1 ring-line ring-inset ${wide ? "md:grid md:grid-cols-[3fr_2fr]" : ""}`}
    >
      <div
        className={`relative isolate aspect-[4/3] overflow-hidden sm:aspect-[16/10] ${wide ? "md:aspect-auto md:min-h-80" : ""}`}
      >
        <Photo
          photo={gathering.photo}
          seed={gathering.slug}
          sizes={wide ? "(min-width: 1240px) 720px, (min-width: 768px) 60vw, 100vw" : "(min-width: 1240px) 600px, (min-width: 768px) 50vw, 100vw"}
          className="-z-10"
        />
        <div className="absolute inset-0 -z-10 bg-linear-to-t from-black/85 via-black/35 to-black/5" />
        {/* Always dark over the photo, so the text keeps its contrast in light mode. */}
        <div data-theme="dark" className="flex h-full flex-col justify-end p-5 text-white">
          <div>
            <p className="font-display text-h1">{day}</p>
            <p className="mt-1 font-display text-h3 font-bold text-accent">{time}</p>
          </div>
        </div>
      </div>
      <div className={`p-5 ${wide ? "md:flex md:flex-col md:justify-center md:p-8" : ""}`}>
        <h3 className="text-h3">{gathering.title}</h3>
        <p className="mt-1.5 text-pretty text-muted">{gathering.description}</p>
        {gathering.locationName && (
          <p className="mt-4 flex items-center gap-2 text-small font-medium">
            <MapPin aria-hidden className="size-4 text-accent-ink" />
            {gathering.locationName}
          </p>
        )}
      </div>
    </article>
  );
}
