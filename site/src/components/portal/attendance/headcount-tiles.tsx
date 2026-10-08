import { formatWeekdayDate, type IsoDate } from "@/lib/dates";
import { changeText, leftOutText, type HeadcountSummary } from "@/lib/portal/attendance/headcount";

const NO_REGULAR = "No regular nights yet";

/** A tile's number, or a dash when there's none because every night was a combined event. */
function Total({ total }: { total: number | undefined }) {
  if (total !== undefined) return total;
  return (
    <>
      <span aria-hidden>–</span>
      <span className="sr-only">None</span>
    </>
  );
}

/**
 * The numbers at the top of Attendance: the latest night, the recent average,
 * and the most ever. The average and the most leave out combined events.
 */
export function HeadcountTiles({ summary, today }: { summary: HeadcountSummary; today: IsoDate }) {
  const { latest, average, highest } = summary;
  const leftOut = leftOutText(summary.combined);
  const tiles = [
    {
      label: "Latest",
      total: latest.total,
      notes: [formatWeekdayDate(latest.night, today), changeText(summary, today)],
    },
    {
      label: "Average",
      total: average?.total,
      notes: [!average ? NO_REGULAR : average.nights === 1 ? "From 1 night" : `Last ${average.nights} nights`],
    },
    {
      label: "Most",
      total: highest?.total,
      notes: [highest ? formatWeekdayDate(highest.night, today) : NO_REGULAR],
    },
  ];

  return (
    <section aria-labelledby="summary-heading" className="space-y-2">
      <h2 id="summary-heading" className="sr-only">
        Summary
      </h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map(({ label, total, notes }) => (
          <div key={label} className="min-w-0 space-y-1 rounded-xl border bg-card p-4 first:col-span-2 sm:first:col-span-1">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-3xl font-semibold tracking-tight tabular-nums">
              <Total total={total} />
            </dd>
            {notes.map((note) => (
              <dd key={note} className="text-sm text-muted-foreground">
                {note}
              </dd>
            ))}
          </div>
        ))}
      </dl>
      {leftOut && <p className="text-sm text-muted-foreground">{leftOut}</p>}
    </section>
  );
}
