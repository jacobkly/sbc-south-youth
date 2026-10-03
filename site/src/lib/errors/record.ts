/**
 * Server errors as rows for the owners' error log: where it happened, one
 * line of message, and a code. Never a stack. Email addresses and phone
 * numbers come out of the message, since a database error can quote the
 * row it refused.
 */

export const MAX_SOURCE = 200;
export const MAX_MESSAGE = 500;
const MAX_CODE = 20;

export type ErrorRecord = { source: string; message: string; code: string | null };

const EMAIL = /[^\s@()<>[\]"',;:]+@[^\s@()<>[\]"',;:]+\.[a-z]{2,}/gi;
// Not inside a longer run of digits or an ID, so times and UUIDs stay whole.
const PHONE = /(?<![\w-])(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}(?![\w-])/g;

function field(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null || !(key in value)) return undefined;
  return (value as Record<string, unknown>)[key];
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function oneLine(value: string, max: number): string {
  const line = value.replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/** The message, and what caused it when that says more, like the address a fetch couldn't reach. */
function messageOf(error: unknown): string {
  if (typeof error === "string") return error.trim() ? error : "No error message";
  const message = text(field(error, "message"));
  if (!message) return "No error message";
  const cause = text(field(field(error, "cause"), "message"));
  return cause && !message.includes(cause) ? `${message} (${cause})` : message;
}

/** A database or system code, or React's digest when it hid the message. */
function codeOf(error: unknown): string | null {
  const code = text(field(error, "code")) ?? text(field(field(error, "cause"), "code")) ?? text(field(error, "digest"));
  return code && code.length <= MAX_CODE ? code : null;
}

/** What goes in the error log for this error, from `source`. */
export function errorRecord(source: string, error: unknown): ErrorRecord {
  const message = messageOf(error).replace(EMAIL, "[email]").replace(PHONE, "[phone]");
  return {
    source: oneLine(source, MAX_SOURCE) || "Unknown",
    message: oneLine(message, MAX_MESSAGE),
    code: codeOf(error),
  };
}

/**
 * Redirects, 404s, and render bailouts travel as thrown errors with a
 * digest Next reads. They aren't problems, so they stay out of the log.
 */
export function isControlFlow(error: unknown): boolean {
  const digest = field(error, "digest");
  return typeof digest === "string" && /^(NEXT_|DYNAMIC_SERVER_USAGE|BAILOUT_TO_CLIENT_SIDE_RENDERING)/.test(digest);
}

const ROUTE_TYPES = { render: "page", route: "route", action: "action" } as const;

/**
 * Names an uncaught error's route the way the address bar shows it:
 * "Portal page /events/[id]" or "Site route /calendar.ics". It's the
 * route's pattern, never the address itself, so it holds no IDs or query.
 */
export function routeSource(routePath: string, routeType: "render" | "route" | "action" | "proxy"): string {
  if (routeType === "proxy") return "Proxy";
  const path = routePath
    .replace(/^\/app(?=\/)/, "")
    .replace(/\/\([^/]*\)/g, "")
    .replace(/\/(page|route)$/, "");
  const portal = /^\/portal(\/|$)/.test(path);
  const shown = (portal ? path.replace(/^\/portal/, "") : path) || "/";
  return `${portal ? "Portal" : "Site"} ${ROUTE_TYPES[routeType]} ${shown}`;
}
