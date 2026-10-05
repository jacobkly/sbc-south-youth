import { ChevronRightIcon, PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatListDate, periodLabel, type IsoDate, type MonthPeriod } from "@/lib/dates";
import { incomeMethodLabel, YOUTH_INCOME_KIND_LABELS } from "@/lib/income/schema";
import { groupByMonth, type YouthEntry, type YouthSummary } from "@/lib/income/stats";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card size="sm" className="min-w-0 gap-2">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="truncate text-xl font-semibold tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="truncate text-xs text-muted-foreground">{note}</CardContent>
    </Card>
  );
}

/** This month's tithes, average tithe, events, and the youth total. */
export function YouthMonthSummary({ month, summary }: { month: MonthPeriod; summary: YouthSummary }) {
  const { tithes, events } = summary;
  return (
    <section aria-labelledby="youth-month-heading" className="space-y-2">
      <h2 id="youth-month-heading" className="text-sm font-medium text-muted-foreground">
        This month · {periodLabel(month)}
      </h2>
      <div className="grid grid-cols-2 gap-2 desktop:grid-cols-4">
        <Stat label="Tithes" value={formatCents(tithes.total)} note={plural(tithes.count, "tithe", "tithes")} />
        <Stat
          label="Average tithe"
          value={tithes.average === null ? "—" : formatCents(tithes.average)}
          note={tithes.median === null ? "No tithes yet" : `Middle tithe ${formatCents(tithes.median)}`}
        />
        <Stat label="Events" value={formatCents(events.total)} note={plural(events.count, "event", "events")} />
        <Stat label="Youth total" value={formatCents(summary.total)} note="Tithes and events" />
      </div>
      <p className="text-xs text-muted-foreground">
        Stats are per tithe, not per person. Who gave is never recorded.
      </p>
    </section>
  );
}

/**
 * Youth entries by month, newest first. Owners tap one to edit it. Viewers
 * see the same list with nothing to tap.
 */
export function YouthEntryList({
  entries,
  today,
  onOpen,
  onAdd,
}: {
  entries: YouthEntry[];
  today: IsoDate;
  /** Opens an entry to edit. Left out for viewers. */
  onOpen?: (entry: YouthEntry) => void;
  /** Starts a new entry. Left out for viewers. */
  onAdd?: () => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="space-y-3 rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        <p>No youth income yet.</p>
        {onAdd && (
          <Button className="h-11 px-5" onClick={onAdd}>
            <PlusIcon />
            Add the first tithe
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupByMonth(entries).map(({ period, total, entries: monthEntries }) => {
        const headingId = `youth-${period.year}-${period.month}`;
        return (
          <section key={headingId} aria-labelledby={headingId} className="space-y-2">
            <div className="flex items-baseline justify-between gap-3 px-1">
              <h2 id={headingId} className="text-sm font-medium">
                {periodLabel(period)}
              </h2>
              <p className="text-sm text-muted-foreground tabular-nums">
                {formatCents(total)}
                <span className="sr-only"> in {periodLabel(period)}</span>
              </p>
            </div>
            <ul className="divide-y overflow-hidden rounded-lg border">
              {monthEntries.map((entry) => (
                <li key={entry.id}>
                  <EntryRow entry={entry} today={today} onOpen={onOpen} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function EntryRow({
  entry,
  today,
  onOpen,
}: {
  entry: YouthEntry;
  today: IsoDate;
  onOpen?: (entry: YouthEntry) => void;
}) {
  const isEvent = entry.kind === "event";
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">
            {isEvent ? (entry.event_name ?? YOUTH_INCOME_KIND_LABELS.event) : YOUTH_INCOME_KIND_LABELS.tithe}
          </span>
          {isEvent && entry.event_name && <Badge variant="secondary">Event</Badge>}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {formatListDate(entry.received_on, today)} · {incomeMethodLabel(entry.method)}
        </p>
      </div>
      <span className="shrink-0 text-right tabular-nums">{formatCents(entry.amount_cents)}</span>
    </>
  );
  const row = "flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left";

  if (!onOpen) return <div className={row}>{content}</div>;
  return (
    <button
      type="button"
      className={cn(row, "outline-none hover:bg-muted focus-visible:bg-muted")}
      onClick={() => onOpen(entry)}
    >
      {content}
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}
