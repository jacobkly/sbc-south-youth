import type { Database, Json } from "@/lib/database.types";
import { addDays, formatTime, formatWeekdayDate, laDateOf, type IsoDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { toCsv, type CsvValue } from "@/lib/portal/csv";
import { APP_ROLES, ROLE_LABELS, sortRoles, type AppRole } from "@/lib/portal/roles";
import { ACTIVITY_SCOPES, SCOPE_LABELS, type ActivityScope } from "./filters";
import {
  describeRequestChanges,
  eventFilename,
  formatRequestNumber,
  REQUEST_ACTION_LABELS,
  requestEventTitle,
  requestTitle,
  type RequestStatus,
  type RequestType,
} from "./requests";

/**
 * Turns activity_feed rows into what the Activity screen and its download
 * show. Finance rows read the way finances words them. Everything else is
 * worded from its action and changes, since the log keeps no sentences.
 */

type RawFeedRow = Database["public"]["Views"]["activity_feed"]["Row"];

/** A feed row with what every row has. The view's columns are all nullable. */
export type FeedRow = {
  id: string;
  created_at: string;
  scope: ActivityScope;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  changes: Json | null;
  note: string | null;
  from_status: RequestStatus | null;
  to_status: RequestStatus | null;
};

export function toFeedRow(raw: RawFeedRow): FeedRow | null {
  const { id, created_at, action, entity_type } = raw;
  const scope = ACTIVITY_SCOPES.find((known) => known === raw.scope);
  if (!id || !created_at || !action || !entity_type || !scope) return null;
  return { ...raw, id, created_at, scope, action, entity_type };
}

/** A request as the feed names it. */
export type FeedRequest = {
  id: string;
  request_number: number;
  type: RequestType;
  amount_cents: number;
  vendor: string | null;
  description: string | null;
  payee_name: string | null;
};

/** What wording the feed needs beyond the rows themselves. */
export type FeedContext = {
  meId: string;
  /** Everyone's name by user ID. */
  names: ReadonlyMap<string, string>;
  /** The requests finance rows are about, by ID. */
  requests: ReadonlyMap<string, FeedRequest>;
  /** Payees that request edits name, by ID. */
  payeeNames: ReadonlyMap<string, string>;
  /** Each invite's account, so an invite reads and groups as its person. */
  inviteUsers: ReadonlyMap<string, string>;
  /** Null when someone has no finances link to follow. */
  financesUrl: string | null;
  /** Only owners have people pages to open. */
  canOpenPeople: boolean;
  today: IsoDate;
};

function isRecord(value: Json | null | undefined): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRequestRow(row: Pick<FeedRow, "action">): boolean {
  return row.action.startsWith("request.");
}

/** The finance action without the feed's "request." prefix. */
function requestAction(row: Pick<FeedRow, "action">): string {
  return row.action.slice("request.".length);
}

/** One field's before and after. Null means that side isn't shown, as for something new or deleted. */
export type FieldChange = { label: string; from: string | null; to: string | null };

function changeOf(row: Pick<FeedRow, "changes">, field: string): { from?: Json; to?: Json } | null {
  const change = isRecord(row.changes) ? row.changes[field] : null;
  return isRecord(change) ? change : null;
}

const FIXED_TITLES: Partial<Record<string, string>> = {
  "user.created": "Account created",
  "user.deleted": "Account deleted",
  "invite.created": "Invited",
  "invite.deleted": "Invite removed",
  "auth.signed_in": "Signed in",
  "export.downloaded": "Report downloaded",
  "activity.exported": "Activity downloaded",
};

/** How anything else the log takes later reads, like "post.created" as "Post added". */
const VERB_WORDS: Partial<Record<string, string>> = {
  created: "added",
  updated: "changed",
  deleted: "removed",
};

/** One event's headline. */
export function eventTitle(row: Pick<FeedRow, "action" | "from_status" | "changes">): string {
  if (isRequestRow(row)) return requestEventTitle({ action: requestAction(row), from_status: row.from_status });

  const fixed = FIXED_TITLES[row.action];
  if (fixed) return fixed;

  if (row.action === "user.updated") {
    const access = changeOf(row, "is_active");
    if (access) return access.to === false ? "Access removed" : "Access restored";
    return "Roles changed";
  }
  if (row.action === "invite.updated") {
    if (changeOf(row, "status")?.to === "accepted") return "Invite accepted";
    if (changeOf(row, "sent_count")) return "Invite resent";
    return "Invite changed";
  }

  const [type, verb] = row.action.split(".");
  const word = verb ? VERB_WORDS[verb] : undefined;
  if (!type || !word) return row.action;
  const noun = type.replaceAll("_", " ");
  return `${noun.charAt(0).toUpperCase()}${noun.slice(1)} ${word}`;
}

/** Logged fields worth showing, in the order they show. */
const LOG_FIELDS = [
  ["roles", "Roles"],
  ["is_active", "Access"],
  ["status", "Invite"],
  ["sent_count", "Times sent"],
] as const;

type LogField = (typeof LOG_FIELDS)[number][0];

function formatRoles(value: Json | undefined): string {
  if (!Array.isArray(value)) return "None";
  const known = value.filter((role): role is AppRole => APP_ROLES.some((appRole) => appRole === role));
  const roles = sortRoles(known);
  return roles.length > 0 ? roles.map((role) => ROLE_LABELS[role]).join(", ") : "None";
}

function formatLogValue(field: LogField, value: Json | undefined): string {
  switch (field) {
    case "roles":
      return formatRoles(value);
    case "is_active":
      return value === true ? "Active" : "Removed";
    case "status":
      if (value === "pending") return "Pending";
      if (value === "accepted") return "Accepted";
      return String(value ?? "None");
    case "sent_count":
      return String(value ?? 0);
  }
}

/** What every new account or invite starts with, so it isn't worth showing. */
function isStartingValue(field: LogField, value: Json | undefined): boolean {
  switch (field) {
    case "roles":
      return !Array.isArray(value) || value.length === 0;
    case "is_active":
      return value === true;
    case "status":
      return value === "pending";
    case "sent_count":
      return typeof value !== "number" || value <= 1;
  }
}

function describeLogChanges(row: Pick<FeedRow, "action" | "changes">): FieldChange[] {
  const verb = row.action.split(".")[1];
  return LOG_FIELDS.flatMap(([field, label]): FieldChange[] => {
    const change = changeOf(row, field);
    if (!change) return [];
    if (verb === "created") {
      return isStartingValue(field, change.to) ? [] : [{ label, from: null, to: formatLogValue(field, change.to) }];
    }
    if (verb === "deleted") {
      return isStartingValue(field, change.from) ? [] : [{ label, from: formatLogValue(field, change.from), to: null }];
    }
    return [{ label, from: formatLogValue(field, change.from), to: formatLogValue(field, change.to) }];
  });
}

/** The before and after of each field an event changed, ready to show. */
export function eventChanges(
  row: Pick<FeedRow, "action" | "changes">,
  payeeNames: ReadonlyMap<string, string> = new Map(),
): FieldChange[] {
  if (!isRequestRow(row)) return describeLogChanges(row);
  return describeRequestChanges({ action: requestAction(row), changes: row.changes }, payeeNames).map(
    ({ label, from, to }) => ({ label, from, to }),
  );
}

/** Events closer together than this, on one thing by one person, show as one item. */
const BURST_MS = 5 * 60 * 1000;
/** Changes to this many things at the same instant, like an import, show as one item. */
const BULK_SUBJECTS = 3;

export type ActivityItem = {
  /** "single": one thing's events close together. "bulk": many things changed at once. */
  type: "single" | "bulk";
  /** The newest event's ID. */
  key: string;
  /** When the newest event happened, which is where the item goes in the feed. */
  created_at: string;
  /** Oldest first. */
  events: FeedRow[];
};

/** What an event is about. An invite is about its person, so inviting someone reads as one thing. */
function subjectKey(row: FeedRow, inviteUsers: ReadonlyMap<string, string>): string {
  if (row.entity_type === "invite" && row.entity_id) {
    const userId = inviteUsers.get(row.entity_id);
    if (userId) return `user|${userId}`;
  }
  return row.entity_id ? `${row.entity_type}|${row.entity_id}` : `row|${row.id}`;
}

/** The order things happen in, for events at the same instant. */
const ACTION_ORDER = [
  ...Object.keys(REQUEST_ACTION_LABELS).map((action) => `request.${action}`),
  "user.created",
  "user.updated",
  "invite.created",
  "invite.updated",
  "auth.signed_in",
  "invite.deleted",
  "user.deleted",
];

function actionRank(action: string): number {
  const rank = ACTION_ORDER.indexOf(action);
  return rank === -1 ? ACTION_ORDER.length : rank;
}

/**
 * Newest-first rows as feed items, the way finances groups a request's
 * history: one person's events on one thing go together while each is
 * within 5 minutes of the last and on the same LA day. An event with no
 * one behind it, like the account an invite makes, joins whoever's item it
 * belongs with. Events at one instant by one person across 3 or more
 * things, which only an import makes, go together as a bulk item.
 */
export function groupActivity(rows: readonly FeedRow[], inviteUsers: ReadonlyMap<string, string>): ActivityItem[] {
  const instantOf = (row: FeedRow) => `${row.actor_id}|${row.created_at}`;
  const subjectsAt = new Map<string, Set<string>>();
  for (const row of rows) {
    const subjects = subjectsAt.get(instantOf(row)) ?? new Set();
    subjectsAt.set(instantOf(row), subjects.add(subjectKey(row, inviteUsers)));
  }

  const items: ActivityItem[] = [];
  const bulks = new Map<string, ActivityItem>();
  // Each subject's newest item, which older events can join, and who it's by.
  const bursts = new Map<string, { item: ActivityItem; actor: string | null }>();
  const start = (type: ActivityItem["type"], row: FeedRow) => {
    const item: ActivityItem = { type, key: row.id, created_at: row.created_at, events: [row] };
    items.push(item);
    return item;
  };

  for (const row of rows) {
    const instant = instantOf(row);
    if (subjectsAt.get(instant)!.size >= BULK_SUBJECTS) {
      const bulk = bulks.get(instant);
      if (bulk) bulk.events.push(row);
      else bulks.set(instant, start("bulk", row));
      continue;
    }

    const subject = subjectKey(row, inviteUsers);
    const burst = bursts.get(subject);
    const oldest = burst?.item.events.at(-1);
    if (
      burst &&
      oldest &&
      Date.parse(oldest.created_at) - Date.parse(row.created_at) <= BURST_MS &&
      laDateOf(oldest.created_at) === laDateOf(row.created_at) &&
      (row.actor_id === null || burst.actor === null || row.actor_id === burst.actor)
    ) {
      burst.item.events.push(row);
      burst.actor ??= row.actor_id;
    } else {
      bursts.set(subject, { item: start("single", row), actor: row.actor_id });
    }
  }

  // Oldest first. Events at the same instant go in the order things happen,
  // and otherwise keep the feed's order, reversed.
  for (const item of items) {
    const position = new Map(item.events.map((row, index) => [row, index]));
    item.events.sort(
      (a, b) =>
        Date.parse(a.created_at) - Date.parse(b.created_at) ||
        actionRank(a.action) - actionRank(b.action) ||
        position.get(b)! - position.get(a)!,
    );
  }
  return items;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function upperFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const FILE_COUNT_TITLES: Partial<Record<string, (count: number) => string>> = {
  "request.receipt_added": (count) => `${count} files added`,
  "request.receipt_removed": (count) => `${count} files removed`,
};

/** Rows an invite makes on its own, which "Invited" already says. */
function isPartOfInvite(row: FeedRow): boolean {
  return row.action === "user.created" || (row.action === "user.updated" && eventTitle(row) === "Roles changed");
}

/**
 * An item's headline. One event keeps its own title. A burst lists each
 * action once, in order, counting files: "Created, 2 files added". A bulk
 * item says how many things it touched.
 */
export function itemTitle(item: Pick<ActivityItem, "type" | "events">): string {
  if (item.type === "bulk") {
    const count = new Set(item.events.map((row) => `${row.entity_type}|${row.entity_id}`)).size;
    if (!item.events.every(isRequestRow)) return `${count} changes at once`;
    const actions = new Set(item.events.map(requestAction));
    const imported = [...actions].every((action) => action === "created" || action === "recorded_paid");
    if (imported && actions.has("recorded_paid")) return `Imported ${count} paid requests`;
    if (actions.size === 1 && actions.has("created")) return `Created ${count} requests at once`;
    return `Changed ${count} requests at once`;
  }

  const invited = item.events.some((row) => row.action === "invite.created");
  const events = invited ? item.events.filter((row) => !isPartOfInvite(row)) : item.events;
  if (events.length === 1) return eventTitle(events[0]);

  const counts = new Map<string, { row: FeedRow; count: number }>();
  for (const row of events) {
    const key = row.action in FILE_COUNT_TITLES ? row.action : eventTitle(row);
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { row, count: 1 });
  }
  const parts = [...counts.values()].map(({ row, count }) => {
    const counted = FILE_COUNT_TITLES[row.action];
    return count > 1 && counted ? counted(count) : eventTitle(row);
  });
  return upperFirst(parts.map(lowerFirst).join(", "));
}

/** Which actions say the most about an item, most first. */
const LEAD_ACTIONS: readonly (readonly string[])[] = [
  ["request.paid", "request.recorded_paid", "request.unpaid"],
  [
    "request.submitted",
    "request.approved",
    "request.unapproved",
    "request.info_requested",
    "request.rejected",
    "request.cancelled",
  ],
  ["request.receipt_added", "request.receipt_removed"],
  ["invite.created", "invite.updated", "invite.deleted"],
  ["user.deleted", "user.updated"],
];

/** The event that best sums up an item, for its icon: the latest of the kind that says the most. */
function leadEvent(events: readonly FeedRow[]): FeedRow {
  for (const actions of LEAD_ACTIONS) {
    const found = events.findLast((row) => actions.includes(row.action));
    if (found) return found;
  }
  return events[events.length - 1];
}

/** The picture beside an item. The screen picks the icon for each. */
export type ActivityIcon =
  | "created"
  | "edited"
  | "submitted"
  | "approved"
  | "paid"
  | "question"
  | "rejected"
  | "cancelled"
  | "undo"
  | "file"
  | "bulk"
  | "person"
  | "roles"
  | "access_removed"
  | "access_restored"
  | "invite"
  | "sign_in"
  | "download"
  | "deleted";

const ACTION_ICONS: Partial<Record<string, ActivityIcon>> = {
  "request.created": "created",
  "request.updated": "edited",
  "request.submitted": "submitted",
  "request.approved": "approved",
  "request.recorded_paid": "paid",
  "request.paid": "paid",
  "request.info_requested": "question",
  "request.rejected": "rejected",
  "request.cancelled": "cancelled",
  "request.unapproved": "undo",
  "request.unpaid": "undo",
  "request.receipt_added": "file",
  "request.receipt_removed": "file",
  "user.created": "person",
  "user.deleted": "deleted",
  "invite.created": "invite",
  "invite.updated": "invite",
  "invite.deleted": "invite",
  "auth.signed_in": "sign_in",
  "export.downloaded": "download",
  "activity.exported": "download",
};

function iconOf(row: FeedRow): ActivityIcon {
  if (row.action === "user.updated") {
    const title = eventTitle(row);
    if (title === "Access removed") return "access_removed";
    if (title === "Access restored") return "access_restored";
    return "roles";
  }
  const icon = ACTION_ICONS[row.action];
  if (icon) return icon;
  const verb = row.action.split(".")[1];
  return verb === "created" ? "created" : verb === "deleted" ? "deleted" : "edited";
}

/** "R-0012 · Test Payee · $12.00 · Costco" */
function requestLine(request: FeedRequest): string {
  return [
    formatRequestNumber(request.request_number),
    request.payee_name ?? "Unknown payee",
    formatCents(request.amount_cents),
    requestTitle(request),
  ].join(" · ");
}

const MISSING_REQUEST = "A request that's gone";

/** The person a row is about, for accounts, invites, and sign-ins. */
function personOf(row: FeedRow, ctx: FeedContext): string | null {
  if (row.entity_type === "user") return row.entity_id;
  if (row.entity_type === "invite" && row.entity_id) return ctx.inviteUsers.get(row.entity_id) ?? null;
  return null;
}

/** What a row is about: a request, a person by their current name, or a downloaded file. */
function subjectOf(row: FeedRow, ctx: FeedContext): string | null {
  if (isRequestRow(row)) {
    const request = row.entity_id ? ctx.requests.get(row.entity_id) : undefined;
    return request ? requestLine(request) : MISSING_REQUEST;
  }
  if (row.entity_type === "user" || row.entity_type === "invite") {
    const person = personOf(row, ctx);
    return (person && ctx.names.get(person)) || row.entity_name || "Someone";
  }
  if (row.action === "export.downloaded") return row.entity_name ?? "A finance report";
  return row.entity_name;
}

export type ItemLink = { href: string; label: string };

function linkOf(row: FeedRow, ctx: FeedContext): ItemLink | null {
  if (isRequestRow(row)) {
    if (!ctx.financesUrl || !row.entity_id || !ctx.requests.has(row.entity_id)) return null;
    return { href: `${ctx.financesUrl}/admin/requests/${row.entity_id}`, label: "Open in Finances" };
  }
  const person = personOf(row, ctx);
  // Someone deleted has no page left to open.
  if (ctx.canOpenPeople && person && ctx.names.has(person)) return { href: `/people/${person}`, label: "Open person" };
  return null;
}

/** One event in an item's details. */
export type EventView = {
  key: string;
  title: string;
  time: string;
  changes: FieldChange[];
  filename: string | null;
  note: string | null;
};

/** One feed item, ready for the screen. Plain data, so it can go to the client. */
export type EntryView = {
  key: string;
  createdAt: string;
  time: string;
  /** e.g. "Today at 7:02 PM", for the details. */
  when: string;
  scope: ActivityScope;
  icon: ActivityIcon;
  title: string;
  subject: string | null;
  /** "by Test Owner", left off when it's you, no one, or the person the item is about. */
  byline: string | null;
  /** Who did it, for the details: "You", a name, or null when no one did. */
  actor: string | null;
  /** Oldest first. */
  events: EventView[];
  link: ItemLink | null;
  /** A bulk item's requests, with links where there are any. */
  related: { label: string; href: string | null }[];
};

export type DayView = { date: IsoDate; label: string; entries: EntryView[] };

/** The heading for a day in the feed: "Today", "Yesterday", or e.g. "Fri, Sep 25". */
export function dayLabel(date: IsoDate, today: IsoDate): string {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  return formatWeekdayDate(date, today);
}

function actorName(actorId: string | null, ctx: FeedContext): string | null {
  if (!actorId) return null;
  if (actorId === ctx.meId) return "You";
  return ctx.names.get(actorId) ?? "Someone";
}

function eventView(row: FeedRow, ctx: FeedContext): EventView {
  return {
    key: row.id,
    title: eventTitle(row),
    time: formatTime(row.created_at),
    changes: eventChanges(row, ctx.payeeNames),
    filename: isRequestRow(row) ? eventFilename({ action: requestAction(row), changes: row.changes }) : null,
    note: row.note,
  };
}

function relatedOf(item: ActivityItem, ctx: FeedContext): EntryView["related"] {
  const rows = [...new Map(item.events.map((row) => [`${row.entity_type}|${row.entity_id}`, row])).values()];
  const numberOf = (row: FeedRow) =>
    (row.entity_id && ctx.requests.get(row.entity_id)?.request_number) || Number.MAX_SAFE_INTEGER;
  return rows
    .sort((a, b) => numberOf(a) - numberOf(b))
    .map((row) => ({ label: subjectOf(row, ctx) ?? eventTitle(row), href: linkOf(row, ctx)?.href ?? null }));
}

function entryView(item: ActivityItem, ctx: FeedContext): EntryView {
  const lead = leadEvent(item.events);
  const actorId = lead.actor_id ?? item.events.find((row) => row.actor_id)?.actor_id ?? null;
  const actor = actorName(actorId, ctx);
  const bulk = item.type === "bulk";
  const hideByline = !actorId || actorId === ctx.meId || actorId === personOf(lead, ctx);
  const time = formatTime(item.created_at);

  return {
    key: item.key,
    createdAt: item.created_at,
    time,
    when: `${dayLabel(laDateOf(item.created_at), ctx.today)} at ${time}`,
    scope: lead.scope,
    icon: bulk ? "bulk" : iconOf(lead),
    title: itemTitle(item),
    subject: bulk ? null : subjectOf(lead, ctx),
    byline: hideByline ? null : `by ${actor}`,
    actor,
    events: item.events.map((row) => eventView(row, ctx)),
    link: bulk ? null : linkOf(lead, ctx),
    related: bulk ? relatedOf(item, ctx) : [],
  };
}

/** Newest-first rows as items under a heading for each LA day. */
export function buildActivityDays(rows: readonly FeedRow[], ctx: FeedContext): DayView[] {
  const days: DayView[] = [];
  for (const item of groupActivity(rows, ctx.inviteUsers)) {
    const date = laDateOf(item.created_at);
    const entry = entryView(item, ctx);
    const last = days.at(-1);
    if (last?.date === date) last.entries.push(entry);
    else days.push({ date, label: dayLabel(date, ctx.today), entries: [entry] });
  }
  return days;
}

/** "Roles: None → Site editor", "Roles: Site editor" for something new, "Roles: was Owner" for something deleted. */
function changeText({ label, from, to }: FieldChange): string {
  if (from === null) return `${label}: ${to}`;
  if (to === null) return `${label}: was ${from}`;
  return `${label}: ${from} → ${to}`;
}

const CSV_HEADER = ["Date", "Time", "App", "Who", "What", "About", "Changes", "Note"];

/** The rows as a CSV file, one line per event, newest first. */
export function activityCsv(rows: readonly FeedRow[], ctx: FeedContext): string {
  const lines = rows.map((row): CsvValue[] => {
    const view = eventView(row, ctx);
    const changes = view.changes.map(changeText);
    if (view.filename) changes.push(`File: ${view.filename}`);
    return [
      laDateOf(row.created_at),
      view.time,
      SCOPE_LABELS[row.scope],
      row.actor_id ? (ctx.names.get(row.actor_id) ?? "Someone") : "",
      view.title,
      subjectOf(row, ctx),
      changes.join("; "),
      row.note,
    ];
  });
  return toCsv(CSV_HEADER, lines);
}
