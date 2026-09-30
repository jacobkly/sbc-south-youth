import { CalendarSync } from "lucide-react";
import { buttonClasses } from "@/components/button";
import { site } from "@/content/site";
import { CopyButton } from "./copy-button";

const feedUrl = new URL("/calendar.ics", site.url).toString();
// webcal:// makes Apple Calendar and Outlook subscribe instead of importing once.
const webcalUrl = feedUrl.replace(/^https:/, "webcal:");
const googleUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`;

/** Subscribes to the whole calendar, so new events show up on their own. */
export function SubscribeCard({ className = "" }: { className?: string }) {
  return (
    <aside
      aria-labelledby="subscribe-title"
      className={`relative isolate overflow-hidden rounded-card bg-accent p-6 text-on-accent sm:p-8 ${className}`}
    >
      <CalendarSync
        aria-hidden
        strokeWidth={1.25}
        className="absolute -top-6 -right-6 -z-10 size-40 opacity-15 sm:size-48"
      />
      <p id="subscribe-title" className="font-display text-h3 font-bold">
        Get it all on your calendar.
      </p>
      <p className="mt-1 max-w-md text-small opacity-80">
        Subscribe once. New events and changes show up on your phone on their own.
      </p>
      <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
        <a href={webcalUrl} className={buttonClasses({ variant: "inverse" })}>
          <CalendarSync aria-hidden />
          Subscribe
        </a>
        <a href={googleUrl} className={buttonClasses({ variant: "inverse-outline" })}>
          Google Calendar
        </a>
        <CopyButton text={feedUrl} label="Copy link" variant="inverse-outline" />
      </div>
    </aside>
  );
}

/** The same links as a quiet row, for beside a page's heading. */
export function SubscribeBar() {
  return (
    <div className="flex flex-col items-end gap-3 text-right">
      <p className="text-small text-muted">Get it all on your calendar. New events show up on their own.</p>
      <div className="flex flex-wrap justify-end gap-2">
        <a href={webcalUrl} className={buttonClasses()}>
          <CalendarSync aria-hidden />
          Subscribe
        </a>
        <a href={googleUrl} className={buttonClasses({ variant: "secondary" })}>
          Google Calendar
        </a>
        <CopyButton text={feedUrl} label="Copy link" />
      </div>
    </div>
  );
}
