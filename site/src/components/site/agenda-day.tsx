import { addDays, type IsoDate } from "@/lib/dates";
import type { AgendaDay as Day } from "@/lib/feed";
import { DateBlock } from "./date-block";
import { EventCard } from "./event-card";

/**
 * One day on This Week's agenda: its date, which sticks as the cards
 * scroll by, then its nights and events. The feed script keeps `data-rel`
 * current and hides each item once it ends. Goes in an `<ol>`.
 */
export function AgendaDay({ day, today }: { day: Day; today: IsoDate }) {
  const rel = day.date === today ? "today" : day.date === addDays(today, 1) ? "tomorrow" : "";

  return (
    <li
      data-box
      data-date={day.date}
      data-rel={rel}
      suppressHydrationWarning
      className="group/day grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3.5 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-6 xl:grid-cols-[3.5rem_minmax(0,1fr)] xl:gap-4"
    >
      <div className="sticky top-(--stick) self-start">
        <DateBlock date={day.date} />
      </div>
      <ul className="@container flex min-w-0 flex-col gap-3">
        {day.items.map((item) => (
          <li key={item.key} data-item data-until={Date.parse(item.endsAt)} suppressHydrationWarning>
            <EventCard item={item} />
          </li>
        ))}
      </ul>
    </li>
  );
}
