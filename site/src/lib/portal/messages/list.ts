import type { Database, Tables } from "@/lib/database.types";
import { answersOf, readAnswers } from "@/lib/forms/answers";

/**
 * How the Messages screens sort, filter, and word messages. The filters
 * live in the URL so a view can be shared or reloaded. Only for what the
 * screen offers: RLS lets only the Messages role read any message.
 */

type Enums = Database["site"]["Enums"];
export type MessageKind = Enums["message_kind"];
export type MessageStatus = Enums["message_status"];
export type ServeOutcome = Enums["serve_outcome"];
export type MessageEnv = "production" | "staging";

export type MessageRow = Pick<
  Tables<{ schema: "site" }, "messages">,
  | "id"
  | "kind"
  | "name"
  | "email"
  | "phone"
  | "message"
  | "details"
  | "env"
  | "status"
  | "outcome"
  | "assigned_to"
  | "internal_note"
  | "handled_by"
  | "handled_at"
  | "notified_at"
  | "created_at"
>;

/** The inbox's tabs. Handled holds spam too, since both are closed. */
export const MESSAGE_TABS = ["new", "in_progress", "handled"] as const;
export type MessageTab = (typeof MESSAGE_TABS)[number];

export const TAB_LABELS: Record<MessageTab, string> = {
  new: "New",
  in_progress: "In progress",
  handled: "Handled",
};

export const STATUS_LABELS: Record<MessageStatus, string> = {
  new: "New",
  in_progress: "In progress",
  handled: "Handled",
  spam: "Spam",
};

/** The kinds in the order the chips show them. */
export const MESSAGE_KINDS = ["visit", "join", "serve", "contact", "takedown"] as const satisfies MessageKind[];

/** Each kind by the form it came from. */
export const KIND_LABELS: Record<MessageKind, string> = {
  visit: "Visit",
  join: "Join",
  serve: "Serve",
  contact: "Contact",
  takedown: "Takedown",
};

export const OUTCOME_LABELS: Record<ServeOutcome, string> = {
  placed: "Placed on a team",
  not_now: "Not right now",
};

export function statusesFor(tab: MessageTab): MessageStatus[] {
  return tab === "handled" ? ["handled", "spam"] : [tab];
}

export function tabOf(status: MessageStatus): MessageTab {
  return status === "spam" ? "handled" : status;
}

export function isClosed(status: MessageStatus): boolean {
  return status === "handled" || status === "spam";
}

export type MessageFilters = {
  tab: MessageTab;
  kind: MessageKind | "all";
  /** Production by default. Staging's are tests from staging.sbcsouthyouth.com. */
  env: MessageEnv;
  /** How many pages are showing, so "Show more" survives a reload. */
  pages: number;
};

export const DEFAULT_MESSAGE_FILTERS: MessageFilters = { tab: "new", kind: "all", env: "production", pages: 1 };

export const MESSAGE_PAGE_SIZE = 25;

/** Past this many pages, the oldest are in a narrower view. */
export const MAX_MESSAGE_PAGES = 20;

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function oneOf<T extends string>(choices: readonly T[], value: string | undefined): T | undefined {
  return choices.find((choice) => choice === value);
}

/** Reads the filters from the URL. Anything unknown falls back to the default. */
export function parseMessageFilters(params: SearchParams): MessageFilters {
  const pages = Number(first(params.pages));
  return {
    tab: oneOf(MESSAGE_TABS, first(params.tab)) ?? DEFAULT_MESSAGE_FILTERS.tab,
    kind: oneOf(MESSAGE_KINDS, first(params.kind)) ?? "all",
    env: first(params.env) === "staging" ? "staging" : "production",
    pages: Number.isInteger(pages) ? Math.min(Math.max(pages, 1), MAX_MESSAGE_PAGES) : 1,
  };
}

/**
 * The URL for these filters with any changes, leaving out defaults. A
 * change to anything but the page count starts again from the first page.
 */
export function messagesHref(filters: MessageFilters, changes: Partial<MessageFilters> = {}): string {
  const next = { ...filters, ...changes };
  if (changes.pages === undefined && Object.keys(changes).length > 0) next.pages = 1;
  const params = new URLSearchParams();
  if (next.tab !== DEFAULT_MESSAGE_FILTERS.tab) params.set("tab", next.tab);
  if (next.kind !== "all") params.set("kind", next.kind);
  if (next.env !== "production") params.set("env", next.env);
  if (next.pages > 1) params.set("pages", String(next.pages));
  const query = params.toString();
  return query ? `/messages?${query}` : "/messages";
}

/** The line under a message's name in the list: what they wrote, or else what the form asked. */
export function messagePreview(message: Pick<MessageRow, "message" | "details">): string {
  const written = message.message?.trim();
  if (written) return written;
  const answers = answersOf(readAnswers(message.details));
  if (answers.length > 0) return answers.map(([label, value]) => `${label}: ${value}`).join(" · ");
  return "No message";
}

/**
 * A link that calls or texts a number. Ten digits is a US number, so it
 * gets +1, and a number with a + keeps its country code. Null when there
 * aren't enough digits to dial.
 */
export function phoneHref(phone: string, scheme: "tel" | "sms"): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  if (phone.trim().startsWith("+")) return `${scheme}:+${digits}`;
  if (digits.length === 10) return `${scheme}:+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `${scheme}:+${digits}`;
  return `${scheme}:${digits}`;
}

/** How many new messages are waiting, for Home. */
export function newMessagesText(count: number): string {
  if (count === 0) return "You're all caught up.";
  return count === 1 ? "1 new message is waiting." : `${count.toLocaleString("en-US")} new messages are waiting.`;
}
