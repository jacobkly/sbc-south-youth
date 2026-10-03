"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowUpRightIcon,
  CalendarClockIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { describedBy, FormField } from "@/components/portal/form-field";
import { Alert, AlertDescription } from "@/components/portal/ui/alert";
import { Button } from "@/components/portal/ui/button";
import { Input } from "@/components/portal/ui/input";
import { Label } from "@/components/portal/ui/label";
import { Switch } from "@/components/portal/ui/switch";
import { Textarea } from "@/components/portal/ui/textarea";
import { todayInLA } from "@/lib/dates";
import { saveEvent, type SaveResult } from "@/lib/portal/events/actions";
import { followStart } from "@/lib/portal/events/composer";
import { whenLabel, type EventState } from "@/lib/portal/events/list";
import { formValues, type SaveIntent } from "@/lib/portal/events/save";
import { checkEvent, checkWhen, EVENT_LIMITS, type EventErrors, type EventValues } from "@/lib/portal/events/schema";
import { slugify } from "@/lib/portal/events/slug";

type Done = Extract<SaveResult, { status: "done" }>;

/** The order fields are checked in, for focusing the first problem. */
const FIELD_ORDER: (keyof EventErrors)[] = [
  "title",
  "startDate",
  "startTime",
  "endDate",
  "endTime",
  "locationName",
  "address",
  "costNote",
  "summary",
  "body",
];
const FIELD_IDS: Record<keyof EventErrors, string> = {
  title: "event-title",
  startDate: "event-start-date",
  startTime: "event-start-time",
  endDate: "event-end-date",
  endTime: "event-end-time",
  locationName: "event-place",
  address: "event-address",
  costNote: "event-cost",
  summary: "event-summary",
  body: "event-body",
};

/** A tappable row with a switch, with room for a description. */
const OPTION_ROW = "min-h-11 cursor-pointer items-start justify-between gap-3 rounded-xl border bg-card px-4 py-3";

const characters = (value: string, limit: number) =>
  `${value.length.toLocaleString("en-US")} of ${limit.toLocaleString("en-US")} characters.`;

/**
 * Writes an event, or changes one. Moving the start moves the end with it,
 * so the event keeps its length. A draft's link follows its title until
 * it's published, then stays put so shared links and calendars keep working.
 */
export function EventForm({
  id,
  initial,
  state,
  slug,
  nowIso,
  siteUrl,
  copied,
  readOnly,
}: {
  /** Null for a new event. */
  id: string | null;
  initial: EventValues;
  /** Where it stands now. Null for a new event. */
  state: Extract<EventState, "draft" | "upcoming" | "happening"> | null;
  /** A published event's slug, which stays put. Null while it's a draft. */
  slug: string | null;
  /** The server's clock, so the first render matches it. */
  nowIso: string;
  /** The public site, for its link and the event's page. */
  siteUrl: string;
  /** True when it starts from another event's details. */
  copied: boolean;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<EventErrors>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [saved, setSaved] = useState<Done | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [doing, setDoing] = useState<SaveIntent | null>(null);
  const [pending, startTransition] = useTransition();
  const doneHeading = useRef<HTMLHeadingElement>(null);
  const startingOver = useRef(false);

  // Focus follows the swap: to the result once it's in, and back to Title for another event.
  useEffect(() => {
    if (done) {
      doneHeading.current?.focus();
    } else if (startingOver.current) {
      startingOver.current = false;
      document.getElementById(FIELD_IDS.title)?.focus();
    }
  }, [done]);

  const now = new Date(nowIso);
  const times = checkWhen(values, now);
  const when = "errors" in times ? null : whenLabel({ ...times, all_day: values.allDay }, todayInLA(now));
  const host = siteUrl.replace(/^https?:\/\//, "");
  const link = `${host}/events/${slug ?? slugify(values.title)}`;
  const published = state === "upcoming" || state === "happening";

  function set<K extends keyof EventValues>(field: K, value: EventValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    if (field in FIELD_IDS) clearError(field as keyof EventErrors);
    setSaved(null);
  }

  function clearError(...fields: (keyof EventErrors)[]) {
    setErrors((current) => {
      if (!fields.some((field) => current[field])) return current;
      const next = { ...current };
      for (const field of fields) delete next[field];
      return next;
    });
  }

  function showErrors(found: EventErrors) {
    setErrors(found);
    const first = FIELD_ORDER.find((field) => found[field]);
    if (first) document.getElementById(FIELD_IDS[first])?.focus();
  }

  /** Moves the start, and the end along with it. */
  function moveStart(field: "startDate" | "startTime", value: string) {
    setValues((current) => {
      const next = { ...current, [field]: value };
      return { ...next, ...followStart(current, next) };
    });
    clearError(field, "endDate", "endTime");
    setSaved(null);
  }

  function submit(intent: SaveIntent) {
    setAlert(null);
    setSaved(null);
    const check = checkEvent(values, { now: new Date() });
    if (!check.ok) {
      showErrors(check.errors);
      return;
    }

    setDoing(intent);
    startTransition(async () => {
      let result: SaveResult;
      try {
        result = await saveEvent(id, values, intent);
      } catch {
        setAlert("Couldn't save the event. Check your connection and try again.");
        return;
      }
      if (result.status === "invalid") showErrors(result.errors);
      else if (result.status === "failed") setAlert(result.message);
      else if (id === null) setDone(result);
      else {
        // The page reads it again, so where it stands and what can be done with it catch up.
        setSaved(result);
        router.refresh();
      }
    });
  }

  function reset() {
    setValues(formValues(null));
    setErrors({});
    setAlert(null);
    setDone(null);
    startingOver.current = true;
    // A copy starts from another event, so a fresh one drops it from the address.
    if (copied) router.replace("/events/new");
  }

  if (done) {
    return (
      <EventDone
        title={values.title.trim()}
        result={done}
        siteUrl={siteUrl}
        headingRef={doneHeading}
        onAnother={reset}
      />
    );
  }

  const busy = readOnly || pending;
  const startError = errors.startDate ?? errors.startTime;
  const endError = errors.endDate ?? errors.endTime;

  return (
    <div className="space-y-6">
      {readOnly && (
        <Alert>
          <TriangleAlertIcon />
          <AlertDescription>
            This is the staging copy of the portal, so it can&apos;t change events. Use the real portal to post.
          </AlertDescription>
        </Alert>
      )}

      <form noValidate onSubmit={(event) => event.preventDefault()}>
        <fieldset disabled={busy} className="min-w-0 space-y-6">
          <FormField
            id={FIELD_IDS.title}
            label="Title"
            hint={characters(values.title, EVENT_LIMITS.title)}
            error={errors.title}
          >
            <Input
              id={FIELD_IDS.title}
              autoComplete="off"
              autoCapitalize="words"
              maxLength={EVENT_LIMITS.title}
              className="h-11"
              value={values.title}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={describedBy(FIELD_IDS.title, errors.title, true)}
              onChange={(event) => set("title", event.target.value)}
            />
          </FormField>

          <section aria-labelledby="event-when-heading" className="space-y-4">
            <h2 id="event-when-heading" className="text-base font-semibold">
              When
            </h2>

            <Label htmlFor="event-all-day" className={`${OPTION_ROW} font-normal leading-snug`}>
              <span className="min-w-0 space-y-0.5">
                <span id="event-all-day-title" className="block text-base font-medium desktop:text-sm">
                  All day
                </span>
                <span id="event-all-day-description" className="block text-sm text-muted-foreground">
                  For a retreat or a trip, where the times aren&apos;t set.
                </span>
              </span>
              <Switch
                id="event-all-day"
                className="mt-0.5"
                checked={values.allDay}
                aria-labelledby="event-all-day-title"
                aria-describedby="event-all-day-description"
                onCheckedChange={(checked) => {
                  set("allDay", checked);
                  clearError("startDate", "startTime", "endDate", "endTime");
                }}
              />
            </Label>

            <FormField id="event-start" label={values.allDay ? "First day" : "Starts"} error={startError} group>
              <div role="group" aria-labelledby="event-start-label" className="grid grid-cols-2 gap-3">
                <Input
                  id={FIELD_IDS.startDate}
                  type="date"
                  aria-label={values.allDay ? "First day" : "Start date"}
                  className="h-11"
                  value={values.startDate}
                  aria-invalid={errors.startDate ? true : undefined}
                  aria-describedby={describedBy("event-start", startError)}
                  onChange={(event) => moveStart("startDate", event.target.value)}
                />
                {!values.allDay && (
                  <Input
                    id={FIELD_IDS.startTime}
                    type="time"
                    aria-label="Start time"
                    className="h-11"
                    value={values.startTime}
                    aria-invalid={errors.startTime ? true : undefined}
                    aria-describedby={describedBy("event-start", startError)}
                    onChange={(event) => moveStart("startTime", event.target.value)}
                  />
                )}
              </div>
            </FormField>

            <FormField id="event-end" label={values.allDay ? "Last day" : "Ends"} error={endError} group>
              <div role="group" aria-labelledby="event-end-label" className="grid grid-cols-2 gap-3">
                <Input
                  id={FIELD_IDS.endDate}
                  type="date"
                  aria-label={values.allDay ? "Last day" : "End date"}
                  className="h-11"
                  value={values.endDate}
                  aria-invalid={errors.endDate ? true : undefined}
                  aria-describedby={describedBy("event-end", endError)}
                  onChange={(event) => set("endDate", event.target.value)}
                />
                {!values.allDay && (
                  <Input
                    id={FIELD_IDS.endTime}
                    type="time"
                    aria-label="End time"
                    className="h-11"
                    value={values.endTime}
                    aria-invalid={errors.endTime ? true : undefined}
                    aria-describedby={describedBy("event-end", endError)}
                    onChange={(event) => set("endTime", event.target.value)}
                  />
                )}
              </div>
            </FormField>

            {when && (
              <p className="flex items-start gap-2 rounded-xl bg-muted/60 px-4 py-3 text-sm">
                <CalendarClockIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                {when}
              </p>
            )}
          </section>

          <section aria-labelledby="event-where-heading" className="space-y-4">
            <h2 id="event-where-heading" className="text-base font-semibold">
              Where and how much
            </h2>

            <FormField
              id={FIELD_IDS.locationName}
              label="Place"
              optional
              hint="Where to meet, like the youth room."
              error={errors.locationName}
            >
              <Input
                id={FIELD_IDS.locationName}
                autoComplete="off"
                autoCapitalize="words"
                maxLength={EVENT_LIMITS.locationName}
                className="h-11"
                value={values.locationName}
                aria-invalid={errors.locationName ? true : undefined}
                aria-describedby={describedBy(FIELD_IDS.locationName, errors.locationName, true)}
                onChange={(event) => set("locationName", event.target.value)}
              />
            </FormField>

            <FormField
              id={FIELD_IDS.address}
              label="Address"
              optional
              hint="Leave it blank if it's at the church. Maps and calendars use it."
              error={errors.address}
            >
              <Input
                id={FIELD_IDS.address}
                autoComplete="off"
                autoCapitalize="words"
                maxLength={EVENT_LIMITS.address}
                className="h-11"
                value={values.address}
                aria-invalid={errors.address ? true : undefined}
                aria-describedby={describedBy(FIELD_IDS.address, errors.address, true)}
                onChange={(event) => set("address", event.target.value)}
              />
            </FormField>

            <FormField
              id={FIELD_IDS.costNote}
              label="Cost"
              optional
              hint="Like “Free” or “$40, due Nov 1”."
              error={errors.costNote}
            >
              <Input
                id={FIELD_IDS.costNote}
                autoComplete="off"
                maxLength={EVENT_LIMITS.costNote}
                className="h-11"
                value={values.costNote}
                aria-invalid={errors.costNote ? true : undefined}
                aria-describedby={describedBy(FIELD_IDS.costNote, errors.costNote, true)}
                onChange={(event) => set("costNote", event.target.value)}
              />
            </FormField>
          </section>

          <section aria-labelledby="event-about-heading" className="space-y-4">
            <h2 id="event-about-heading" className="text-base font-semibold">
              About it
            </h2>

            <FormField
              id={FIELD_IDS.summary}
              label="Short description"
              optional
              hint={`For link previews and search results. ${characters(values.summary, EVENT_LIMITS.summary)}`}
              error={errors.summary}
            >
              <Input
                id={FIELD_IDS.summary}
                autoComplete="off"
                autoCapitalize="sentences"
                maxLength={EVENT_LIMITS.summary}
                className="h-11"
                value={values.summary}
                aria-invalid={errors.summary ? true : undefined}
                aria-describedby={describedBy(FIELD_IDS.summary, errors.summary, true)}
                onChange={(event) => set("summary", event.target.value)}
              />
            </FormField>

            <FormField
              id={FIELD_IDS.body}
              label="Details"
              optional
              hint={`What to bring and what to know. Leave a blank line between paragraphs. ${characters(
                values.body,
                EVENT_LIMITS.body,
              )}`}
              error={errors.body}
            >
              <Textarea
                id={FIELD_IDS.body}
                rows={5}
                autoCapitalize="sentences"
                maxLength={EVENT_LIMITS.body}
                className="min-h-32"
                value={values.body}
                aria-invalid={errors.body ? true : undefined}
                aria-describedby={describedBy(FIELD_IDS.body, errors.body, true)}
                onChange={(event) => set("body", event.target.value)}
              />
            </FormField>

            <Label htmlFor="event-featured" className={`${OPTION_ROW} font-normal leading-snug`}>
              <span className="min-w-0 space-y-0.5">
                <span id="event-featured-title" className="block text-base font-medium desktop:text-sm">
                  Feature it
                </span>
                <span id="event-featured-description" className="block text-sm text-muted-foreground">
                  A big card on This Week, and Home counts down to it.
                </span>
              </span>
              <Switch
                id="event-featured"
                className="mt-0.5"
                checked={values.featured}
                aria-labelledby="event-featured-title"
                aria-describedby="event-featured-description"
                onCheckedChange={(checked) => set("featured", checked)}
              />
            </Label>
          </section>

          <p className="text-sm break-words text-muted-foreground">
            {published ? "Its page stays at " : "Its page will be "}
            <span className="font-medium text-foreground">{link}</span>
            {published
              ? ", even if the title changes, so links people shared keep working."
              : state === "draft" || id === null
                ? ". It follows the title until it's published."
                : "."}
          </p>

          {alert && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertDescription>{alert}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" className="h-11 px-6" onClick={() => submit("publish")}>
              {published
                ? pending && doing === "publish"
                  ? "Saving…"
                  : "Save changes"
                : pending && doing === "publish"
                  ? "Publishing…"
                  : "Publish"}
            </Button>
            {!published && (
              <Button type="button" variant="outline" className="h-11 px-6" onClick={() => submit("draft")}>
                {pending && doing === "draft" ? "Saving…" : "Save draft"}
              </Button>
            )}
          </div>

          {saved && (
            <p role="status" className="flex items-start gap-2 text-sm text-muted-foreground">
              <CircleCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {saved.message}
                {saved.state !== "draft" && (
                  <>
                    {" "}
                    <a
                      href={`${siteUrl}/events/${saved.slug}`}
                      target="_blank"
                      rel="noopener"
                      className="font-medium text-foreground underline underline-offset-4"
                    >
                      See it on the site
                    </a>
                  </>
                )}
              </span>
            </p>
          )}
        </fieldset>
      </form>
    </div>
  );
}

/** A new event is saved: where it stands, and where to go next. */
function EventDone({
  title,
  result,
  siteUrl,
  headingRef,
  onAnother,
}: {
  title: string;
  result: Done;
  siteUrl: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onAnother: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-xl border bg-card p-4 sm:p-6">
        <CircleCheckIcon className="size-6 text-muted-foreground" aria-hidden />
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-pretty outline-none">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{result.message}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button asChild className="h-11 px-6">
          <Link href="/events">Back to Events</Link>
        </Button>
        {result.state !== "draft" && (
          <Button asChild variant="outline" className="h-11 px-6">
            <a href={`${siteUrl}/events/${result.slug}`} target="_blank" rel="noopener">
              See it on the site
              <ArrowUpRightIcon aria-hidden />
            </a>
          </Button>
        )}
        <Button asChild variant="outline" className="h-11 px-6">
          <Link href={`/events/${result.id}`}>Keep editing</Link>
        </Button>
        <Button type="button" variant="ghost" className="h-11 px-6" onClick={onAnother}>
          Add another
        </Button>
      </div>
    </div>
  );
}
