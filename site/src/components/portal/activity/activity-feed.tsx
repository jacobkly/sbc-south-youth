"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRightIcon,
  BanIcon,
  BanknoteIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  CircleXIcon,
  DatabaseBackupIcon,
  DownloadIcon,
  FilePlusIcon,
  FileSpreadsheetIcon,
  LogInIcon,
  MailIcon,
  MessageCircleQuestionMarkIcon,
  PaperclipIcon,
  PencilIcon,
  SendIcon,
  ShieldCheckIcon,
  Trash2Icon,
  Undo2Icon,
  UserCheckIcon,
  UserPlusIcon,
  UserXIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/portal/ui/button";
import { ResponsiveSheetContent } from "@/components/portal/ui/responsive-sheet";
import { Sheet, SheetDescription, SheetHeader, SheetTitle } from "@/components/portal/ui/sheet";
import type { ActivityIcon, DayView, EntryView, EventView, FieldChange } from "@/lib/portal/activity/feed";
import { SCOPE_LABELS } from "@/lib/portal/activity/filters";

const ICONS: Record<ActivityIcon, LucideIcon> = {
  created: FilePlusIcon,
  edited: PencilIcon,
  submitted: SendIcon,
  approved: CircleCheckIcon,
  paid: BanknoteIcon,
  question: MessageCircleQuestionMarkIcon,
  rejected: CircleXIcon,
  cancelled: BanIcon,
  undo: Undo2Icon,
  file: PaperclipIcon,
  bulk: FileSpreadsheetIcon,
  person: UserPlusIcon,
  roles: ShieldCheckIcon,
  access_removed: UserXIcon,
  access_restored: UserCheckIcon,
  invite: MailIcon,
  sign_in: LogInIcon,
  download: DownloadIcon,
  backup: DatabaseBackupIcon,
  deleted: Trash2Icon,
};

const ROW =
  "flex w-full min-w-0 items-start gap-3 p-4 text-left outline-none hover:bg-muted/50 " +
  "focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset";

const RELATED_LINK =
  "-mx-2 block truncate rounded-md px-2 py-2.5 outline-none hover:bg-muted focus-visible:bg-muted";

/**
 * Feed items under a heading for each day, newest first. Each opens a sheet
 * with what changed, who did it, and a link to the thing itself.
 */
export function ActivityFeed({ days, showScope }: { days: DayView[]; showScope: boolean }) {
  const [open, setOpen] = useState(false);
  // Kept after closing, so the sheet doesn't empty while it slides away.
  const [entry, setEntry] = useState<EntryView | null>(null);

  return (
    <div className="space-y-6">
      {days.map((day) => (
        <section key={day.date} aria-labelledby={`day-${day.date}`} className="space-y-2">
          <h2 id={`day-${day.date}`} className="text-sm font-medium text-muted-foreground">
            {day.label}
          </h2>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {day.entries.map((item) => (
              <li key={item.key}>
                <EntryRow
                  entry={item}
                  showScope={showScope}
                  onOpen={() => {
                    setEntry(item);
                    setOpen(true);
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Sheet open={open} onOpenChange={setOpen}>
        <ResponsiveSheetContent>{entry && <EntryDetails entry={entry} />}</ResponsiveSheetContent>
      </Sheet>
    </div>
  );
}

function ItemIcon({ icon }: { icon: ActivityIcon }) {
  const Icon = ICONS[icon];
  return (
    <span
      aria-hidden
      className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border bg-background text-muted-foreground"
    >
      <Icon className="size-4" />
    </span>
  );
}

function EntryRow({ entry, showScope, onOpen }: { entry: EntryView; showScope: boolean; onOpen: () => void }) {
  const meta = [showScope ? SCOPE_LABELS[entry.scope] : null, entry.byline].filter(Boolean).join(" · ");
  return (
    <button type="button" className={ROW} aria-haspopup="dialog" onClick={onOpen}>
      <ItemIcon icon={entry.icon} />
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 font-medium">{entry.title}</span>
          <time dateTime={entry.createdAt} className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {entry.time}
          </time>
        </span>
        {entry.subject && <span className="block truncate text-sm text-muted-foreground">{entry.subject}</span>}
        {entry.relatedSummary && (
          <span className="block truncate text-sm text-muted-foreground">{entry.relatedSummary}</span>
        )}
        {meta && <span className="block text-xs text-muted-foreground">{meta}</span>}
      </span>
      <ChevronRightIcon className="mt-1.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}

function EntryDetails({ entry }: { entry: EntryView }) {
  const actor = entry.actor === "You" ? "you" : entry.actor;
  const several = entry.events.length > 1;
  const hasDetails = entry.events.some((event) => event.changes.length > 0 || event.filename || event.note);

  return (
    <>
      <SheetHeader className="pr-12">
        <SheetTitle>{entry.title}</SheetTitle>
        <SheetDescription>
          {entry.when}
          {actor && ` by ${actor}`}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-4 px-4">
        {entry.subject && <p className="font-medium break-words">{entry.subject}</p>}

        {several ? (
          <ol className="space-y-3 border-l-2 pl-4">
            {entry.events.map((event) => (
              <li key={event.key} className="space-y-1">
                <p className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{event.title}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">{event.time}</span>
                </p>
                <EventDetails event={event} />
              </li>
            ))}
          </ol>
        ) : (
          hasDetails && <EventDetails event={entry.events[0]} />
        )}

        {entry.related.length > 0 && <RelatedList related={entry.related} summary={entry.relatedSummary} />}

        {entry.link && (
          <Button asChild variant="outline" className="h-11 w-full">
            {entry.link.href.startsWith("/") ? (
              <Link href={entry.link.href}>
                {entry.link.label}
                <ChevronRightIcon aria-hidden />
              </Link>
            ) : (
              <a href={entry.link.href}>
                {entry.link.label}
                <ArrowUpRightIcon aria-hidden />
              </a>
            )}
          </Button>
        )}
      </div>
    </>
  );
}

/** What an event says beyond its title: the file, each field's before and after, and the note. */
function EventDetails({ event }: { event: EventView }) {
  return (
    <>
      {event.filename && (
        <p className="flex items-start gap-2 break-words">
          <PaperclipIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          {event.filename}
        </p>
      )}
      {event.changes.length > 0 && (
        <dl className="space-y-2">
          {event.changes.map((change) => (
            <div key={change.label}>
              <dt className="text-xs font-medium text-muted-foreground">{change.label}</dt>
              <dd className="break-words whitespace-pre-wrap">
                <ChangeText change={change} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      {event.note && (
        <blockquote className="border-l-2 pl-3 break-words whitespace-pre-wrap">{event.note}</blockquote>
      )}
    </>
  );
}

function ChangeText({ change }: { change: FieldChange }) {
  if (change.from === null) return change.to;
  if (change.to === null) {
    return (
      <>
        <span className="text-muted-foreground">Was</span> {change.from}
      </>
    );
  }
  return (
    <>
      <span className="text-muted-foreground line-through decoration-muted-foreground/60">{change.from}</span>{" "}
      <span aria-hidden>→</span>
      <span className="sr-only">changed to</span> {change.to}
    </>
  );
}

/** A bulk item's things, each opening where it can, like a request in finances. */
function RelatedList({ related, summary }: { related: EntryView["related"]; summary: string | null }) {
  return (
    <section aria-labelledby="related-heading" className="space-y-1">
      <h3 id="related-heading" className="text-xs font-medium text-muted-foreground">
        {summary}
      </h3>
      <ul>
        {related.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {item.href ? (
              <a href={item.href} className={RELATED_LINK}>
                {item.label}
              </a>
            ) : (
              <p className="truncate py-2.5 text-muted-foreground">{item.label}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
