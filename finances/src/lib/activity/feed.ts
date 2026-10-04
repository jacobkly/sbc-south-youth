import { addDays, formatWeekdayDate, laDateOf, type IsoDate } from "@/lib/dates";
import { EVENT_ACTION_LABELS, eventTitle, type EventAction, type RequestEvent } from "@/lib/requests/status";

/** In the order the filter shows them. */
export const ACTIVITY_KINDS = ["all", "receipts", "payments", "status", "edits"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
export type EventKind = Exclude<ActivityKind, "all">;

export const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = {
  all: "All",
  receipts: "Receipts",
  payments: "Payments",
  status: "Status",
  edits: "Edits",
};

/** The actions in each kind. Every action is in exactly one. */
export const ACTIVITY_KIND_ACTIONS: Record<EventKind, readonly EventAction[]> = {
  receipts: ["receipt_added", "receipt_removed"],
  payments: ["paid", "recorded_paid", "unpaid"],
  status: ["submitted", "approved", "unapproved", "info_requested", "rejected", "cancelled"],
  edits: ["created", "updated", "corrected"],
};

const KIND_OF = new Map(
  Object.entries(ACTIVITY_KIND_ACTIONS).flatMap(([kind, actions]) =>
    actions.map((action) => [action, kind as EventKind] as const),
  ),
);

/** Which kind an action is. An action the app doesn't know yet counts as an edit. */
export function kindOf(action: string): EventKind {
  return KIND_OF.get(action as EventAction) ?? "edits";
}

export const ACTIVITY_PAGE_SIZE = 50;
/** Enough for 1,000 events, the most one Supabase query returns. */
export const MAX_ACTIVITY_PAGES = 20;

/** The activity page's filter, as kept in the URL. */
export type ActivityFilters = {
  kind: ActivityKind;
  /** How many pages have been loaded with "Load more". */
  pages: number;
};

export const DEFAULT_ACTIVITY_FILTERS: ActivityFilters = { kind: "all", pages: 1 };

type SearchParams = Record<string, string | string[] | undefined>;

function single(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

/** Reads the filter from the URL. Anything unrecognized falls back to its default. */
export function parseActivityFilters(params: SearchParams): ActivityFilters {
  const kind = single(params, "kind");
  const pages = Number(single(params, "pages"));
  return {
    kind: ACTIVITY_KINDS.find((candidate) => candidate === kind) ?? DEFAULT_ACTIVITY_FILTERS.kind,
    pages: Number.isInteger(pages) && pages > 1 ? Math.min(pages, MAX_ACTIVITY_PAGES) : 1,
  };
}

/** The activity page's URL for this filter, leaving out the defaults. */
export function activityHref(filters: ActivityFilters): string {
  const params = new URLSearchParams();
  if (filters.kind !== "all") params.set("kind", filters.kind);
  if (filters.pages > 1) params.set("pages", String(filters.pages));
  const query = params.toString();
  return query ? `/admin/activity?${query}` : "/admin/activity";
}

/** The heading for a day in the feed: "Today", "Yesterday", or e.g. "Fri, Sep 25". */
export function dayLabel(date: IsoDate, today: IsoDate): string {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  return formatWeekdayDate(date, today);
}

export type ActivityDay<T> = { date: IsoDate; label: string; items: T[] };

/** Newest-first items under the Los Angeles day each happened, keeping their order. */
export function groupByDay<T extends { created_at: string }>(items: readonly T[], today: IsoDate): ActivityDay<T>[] {
  const days: ActivityDay<T>[] = [];
  for (const item of items) {
    const date = laDateOf(item.created_at);
    const last = days.at(-1);
    if (last?.date === date) last.items.push(item);
    else days.push({ date, label: dayLabel(date, today), items: [item] });
  }
  return days;
}

/** Events closer together than this, on one request by one person, show as one item. */
const BURST_MS = 5 * 60 * 1000;
/** Changes to this many requests at the same instant, like an import, show as one item. */
const BULK_REQUESTS = 3;

/** What grouping needs from an event. */
type GroupedEvent = Pick<RequestEvent, "action" | "from_status" | "created_at"> & {
  id: string;
  request_id: string;
  actor_id: string | null;
};

export type ActivityItem<T> = {
  /** "request": one request's events close together. "bulk": many requests changed at once. */
  type: "request" | "bulk";
  /** The newest event's id. */
  key: string;
  /** When the newest event happened, which is where the item goes in the feed. */
  created_at: string;
  /** Oldest first. */
  events: T[];
};

const ACTION_ORDER = Object.keys(EVENT_ACTION_LABELS);

/** Oldest first. Events at the same instant go in the order a request's life runs. */
function chronological(a: GroupedEvent, b: GroupedEvent): number {
  return Date.parse(a.created_at) - Date.parse(b.created_at) || ACTION_ORDER.indexOf(a.action) - ACTION_ORDER.indexOf(b.action);
}

/**
 * Newest-first events as feed items, so entering a request with its photos,
 * or importing a spreadsheet, shows as one item instead of dozens. One
 * person's events on a request go together while each is within 5 minutes
 * of the last and on the same LA day. Events at one instant by one person
 * across 3 or more requests, which only an import makes, go together as a
 * bulk item.
 */
export function groupBursts<T extends GroupedEvent>(events: readonly T[]): ActivityItem<T>[] {
  const instantOf = (event: T) => `${event.actor_id}|${event.created_at}`;
  const requestsAt = new Map<string, Set<string>>();
  for (const event of events) {
    const requests = requestsAt.get(instantOf(event)) ?? new Set();
    requestsAt.set(instantOf(event), requests.add(event.request_id));
  }

  const items: ActivityItem<T>[] = [];
  const bulks = new Map<string, ActivityItem<T>>();
  // Each request and person's newest item, which older events can join.
  const bursts = new Map<string, ActivityItem<T>>();
  const start = (type: ActivityItem<T>["type"], event: T) => {
    const item: ActivityItem<T> = { type, key: event.id, created_at: event.created_at, events: [event] };
    items.push(item);
    return item;
  };

  for (const event of events) {
    const instant = instantOf(event);
    if (requestsAt.get(instant)!.size >= BULK_REQUESTS) {
      const bulk = bulks.get(instant);
      if (bulk) bulk.events.push(event);
      else bulks.set(instant, start("bulk", event));
      continue;
    }

    const who = `${event.request_id}|${event.actor_id}`;
    const burst = bursts.get(who);
    const oldest = burst?.events.at(-1);
    if (
      burst &&
      oldest &&
      Date.parse(oldest.created_at) - Date.parse(event.created_at) <= BURST_MS &&
      laDateOf(oldest.created_at) === laDateOf(event.created_at)
    ) {
      burst.events.push(event);
    } else {
      bursts.set(who, start("request", event));
    }
  }

  for (const item of items) item.events.sort(chronological);
  return items;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function upperFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const FILE_COUNT_TITLES: Partial<Record<string, (count: number) => string>> = {
  receipt_added: (count) => `${count} files added`,
  receipt_removed: (count) => `${count} files removed`,
};

/**
 * An item's headline. One event keeps its own title. A burst lists each
 * action once, in order, counting files: "Created, 2 files added, recorded
 * as paid". A bulk item says how many requests it touched.
 */
export function itemTitle(item: Pick<ActivityItem<GroupedEvent>, "type" | "events">): string {
  const { events } = item;
  if (item.type === "bulk") {
    const count = new Set(events.map((event) => event.request_id)).size;
    const actions = new Set(events.map((event) => event.action));
    if (actions.has("recorded_paid") && [...actions].every((action) => action === "created" || action === "recorded_paid")) {
      return `Imported ${count} paid requests`;
    }
    if (actions.size === 1 && actions.has("created")) return `Created ${count} requests at once`;
    return `Changed ${count} requests at once`;
  }

  if (events.length === 1) return eventTitle(events[0]);
  const counts = new Map<string, { event: GroupedEvent; count: number }>();
  for (const event of events) {
    const key = event.action in FILE_COUNT_TITLES ? event.action : eventTitle(event);
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { event, count: 1 });
  }
  const parts = [...counts.values()].map(({ event, count }) => {
    const counted = FILE_COUNT_TITLES[event.action];
    return count > 1 && counted ? counted(count) : eventTitle(event);
  });
  return upperFirst(parts.map(lowerFirst).join(", "));
}

/** Which kinds say the most about an item, most first. */
const KIND_WEIGHT: readonly EventKind[] = ["payments", "status", "receipts", "edits"];

/** The event that best sums up an item, for its icon: the latest of the kind that says the most. */
export function leadEvent<T extends Pick<RequestEvent, "action">>(events: readonly T[]): T {
  for (const kind of KIND_WEIGHT) {
    const found = events.findLast((event) => kindOf(event.action) === kind);
    if (found) return found;
  }
  return events[events.length - 1];
}
