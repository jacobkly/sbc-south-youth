import type { IsoDate } from "@/lib/dates";

const parts = (format: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...format });
const weekday = parts({ weekday: "short" });
const month = parts({ month: "short" });
const long = parts({ weekday: "long", month: "long", day: "numeric" });

/**
 * A day on the agenda, like a torn-off calendar page. It turns accent
 * for today and gets a label for today and tomorrow. Those follow
 * `data-rel` on the nearest `group/day`, which the feed script keeps
 * current, so a cached page still marks the right day.
 */
export function DateBlock({ date }: { date: IsoDate }) {
  const [year, monthNumber, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year, monthNumber - 1, day));

  return (
    <div className="flex flex-col items-center gap-2">
      <time
        dateTime={date}
        className="flex w-full flex-col items-center rounded-tile bg-surface-2 pt-2 pb-2.5 ring-1 ring-line ring-inset group-data-[rel=today]/day:bg-accent group-data-[rel=today]/day:text-on-accent group-data-[rel=today]/day:ring-transparent"
      >
        <span className="sr-only">{long.format(utc)}</span>
        <span aria-hidden className="text-eyebrow uppercase opacity-70">
          {weekday.format(utc)}
        </span>
        <span aria-hidden className="font-display text-[1.75rem] leading-none font-extrabold tracking-tight tabular-nums sm:text-[2rem]">
          {day}
        </span>
        <span aria-hidden className="mt-0.5 text-[0.6875rem] font-semibold uppercase opacity-70">
          {month.format(utc)}
        </span>
      </time>
      <span className="hidden text-[0.6875rem] font-bold text-accent-ink group-data-[rel=today]/day:block">Today</span>
      <span className="hidden text-[0.6875rem] font-bold text-muted group-data-[rel=tomorrow]/day:block">Tomorrow</span>
    </div>
  );
}
