import { formatWeekdayDate, type IsoDate } from "@/lib/dates";
import { changeText, type HeadcountSummary } from "@/lib/portal/attendance/headcount";

/** The numbers at the top of Attendance: the latest night, the recent average, and the most ever. */
export function HeadcountTiles({ summary, today }: { summary: HeadcountSummary; today: IsoDate }) {
  const { latest, change, average, highest } = summary;
  const tiles = [
    {
      label: "Latest",
      total: latest.total,
      notes: [formatWeekdayDate(latest.night, today), changeText(change, today)],
    },
    {
      label: "Average",
      total: average.total,
      notes: [average.nights === 1 ? "From 1 night" : `Last ${average.nights} nights`],
    },
    { label: "Most", total: highest.total, notes: [formatWeekdayDate(highest.night, today)] },
  ];

  return (
    <section aria-labelledby="summary-heading">
      <h2 id="summary-heading" className="sr-only">
        Summary
      </h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map(({ label, total, notes }) => (
          <div key={label} className="min-w-0 space-y-1 rounded-xl border bg-card p-4 first:col-span-2 sm:first:col-span-1">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-3xl font-semibold tracking-tight tabular-nums">{total}</dd>
            {notes.map((note) => (
              <dd key={note} className="text-sm text-muted-foreground">
                {note}
              </dd>
            ))}
          </div>
        ))}
      </dl>
    </section>
  );
}
