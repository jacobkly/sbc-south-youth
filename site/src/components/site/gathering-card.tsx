import { ArrowRight, CalendarPlus, MapPin } from "lucide-react";
import { ButtonLink, buttonClasses } from "@/components/button";
import type { WeeklyGathering } from "@/lib/content/types";
import { photoSizes } from "@/lib/photo-sizes";
import { formatClockRange, weekdayName } from "@/lib/schedule";
import { Photo } from "./photo";

/**
 * A weekly night: the day and time big over a photo, then what it is and
 * where. `wide` puts the text beside the photo from tablets up, for a
 * card that has the row to itself, and from xl up drops the card for a
 * band: the photo across 7 columns and the text in the other 5.
 */
export function GatheringCard({ gathering, wide = false }: { gathering: WeeklyGathering; wide?: boolean }) {
  const day = weekdayName(gathering.weekday, { plural: true });
  const time = formatClockRange(gathering.startTime, gathering.endTime);

  return (
    <article
      className={`overflow-hidden rounded-card bg-surface ring-1 ring-line ring-inset ${wide ? "md:grid md:grid-cols-[3fr_2fr] xl:grid-cols-12 xl:gap-x-(--grid-gap) xl:rounded-none xl:bg-transparent xl:ring-0" : ""}`}
    >
      <div
        className={`relative isolate aspect-[4/3] overflow-hidden sm:aspect-[16/10] ${wide ? "md:aspect-auto md:min-h-80 xl:col-span-7 xl:aspect-[16/9] xl:rounded-card" : ""}`}
      >
        <Photo
          photo={gathering.photo}
          seed={gathering.slug}
          sizes={wide ? photoSizes({ xl: 7 / 12, lg: 3 / 5, md: 3 / 5 }) : photoSizes({ lg: 1 / 2, md: 1 / 2 })}
          className="-z-10"
        />
        <div className="absolute inset-0 -z-10 bg-linear-to-t from-black/85 via-black/35 to-black/5" />
        {/* Always dark over the photo, so the text keeps its contrast in light mode. */}
        <div data-theme="dark" className={`flex h-full flex-col justify-end p-5 text-white ${wide ? "xl:p-10" : ""}`}>
          <div>
            <p className={`font-display text-h1 ${wide ? "xl:text-display" : ""}`}>{day}</p>
            <p className={`mt-1 font-display text-h3 font-bold text-accent ${wide ? "xl:text-h2" : ""}`}>{time}</p>
          </div>
        </div>
      </div>
      <div className={`p-5 ${wide ? "md:flex md:flex-col md:justify-center md:p-8 xl:col-span-5 xl:p-0" : ""}`}>
        <h3 className={`text-h3 ${wide ? "xl:font-display xl:text-h2" : ""}`}>{gathering.title}</h3>
        <p className={`mt-1.5 text-pretty text-muted ${wide ? "xl:mt-3 xl:max-w-[30em] xl:text-lg" : ""}`}>
          {gathering.description}
        </p>
        {gathering.locationName && (
          <p className="mt-4 flex items-center gap-2 text-small font-medium">
            <MapPin aria-hidden className="size-4 text-accent-ink" />
            {gathering.locationName}
          </p>
        )}
        {/* Phones get to the calendar from the event page, so these start at tablets. */}
        {wide && (
          <div className="mt-6 hidden flex-wrap gap-3 md:flex xl:mt-8">
            <a href={`/events/${gathering.slug}/calendar.ics`} className={buttonClasses()}>
              <CalendarPlus aria-hidden />
              Add every week
            </a>
            <ButtonLink href={`/events/${gathering.slug}`} variant="secondary">
              See the details
              <ArrowRight aria-hidden />
            </ButtonLink>
          </div>
        )}
      </div>
    </article>
  );
}
