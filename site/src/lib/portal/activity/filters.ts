import { hasRole, type AppRole } from "@/lib/portal/roles";

/**
 * Which activity someone can see and how they've narrowed it. The filters
 * live in the URL so a filtered view can be shared or reloaded. Only for
 * what the screen offers: RLS on activity_log and each request decides
 * which rows anyone can actually read.
 */

/** The apps activity comes from. Platform covers people, invites, sign-ins, and backups. */
export const ACTIVITY_SCOPES = ["site", "finances", "platform"] as const;
export type ActivityScope = (typeof ACTIVITY_SCOPES)[number];

export const SCOPE_LABELS: Record<ActivityScope, string> = {
  site: "Site",
  finances: "Finances",
  platform: "People",
};

/**
 * The apps someone's roles let them read, matching the activity_log policy.
 * Requesters see none: their own requests' history stays in finances.
 */
export function scopesFor(roles: readonly AppRole[]): ActivityScope[] {
  const scopes: ActivityScope[] = [];
  if (hasRole(roles, "site_editor", "site_messages")) scopes.push("site");
  if (hasRole(roles, "finance_viewer")) scopes.push("finances");
  if (roles.includes("owner")) scopes.push("platform");
  return scopes;
}

/** Kinds of action to narrow to, each a set of logged actions in one or more apps. */
const KINDS = {
  posts: {
    label: "Heads-ups",
    scopes: ["site"],
    actions: ["post.created", "post.updated", "post.deleted"],
  },
  events: {
    label: "Events",
    scopes: ["site"],
    actions: ["event.created", "event.updated", "event.deleted"],
  },
  requests: {
    label: "Request edits",
    scopes: ["finances"],
    actions: ["request.created", "request.updated", "request.corrected"],
  },
  status: {
    label: "Status changes",
    scopes: ["finances"],
    actions: [
      "request.submitted",
      "request.approved",
      "request.unapproved",
      "request.info_requested",
      "request.rejected",
      "request.cancelled",
    ],
  },
  payments: {
    label: "Payments",
    scopes: ["finances"],
    actions: ["request.paid", "request.recorded_paid", "request.unpaid"],
  },
  receipts: {
    label: "Receipt files",
    scopes: ["finances"],
    actions: ["request.receipt_added", "request.receipt_removed"],
  },
  access: {
    label: "Roles and access",
    scopes: ["platform"],
    actions: ["user.created", "user.updated", "user.deleted"],
  },
  invites: {
    label: "Invites",
    scopes: ["platform"],
    actions: ["invite.created", "invite.updated", "invite.deleted"],
  },
  sign_ins: {
    label: "Sign-ins",
    scopes: ["platform"],
    actions: ["auth.signed_in"],
  },
  downloads: {
    label: "Downloads",
    scopes: ["finances", "platform"],
    actions: ["export.downloaded", "activity.exported"],
  },
  backups: {
    label: "Backups",
    scopes: ["platform"],
    actions: ["backup.completed"],
  },
} as const satisfies Record<string, { label: string; scopes: readonly ActivityScope[]; actions: readonly string[] }>;

export type ActivityKind = keyof typeof KINDS;

const KIND_KEYS = Object.keys(KINDS) as ActivityKind[];

export function kindLabel(kind: ActivityKind): string {
  return KINDS[kind].label;
}

export type ActivityFilters = {
  scope: ActivityScope | "all";
  /** Only what this person did. */
  person: string | null;
  kind: ActivityKind | "all";
  /** How many pages are showing, so "Load more" survives a reload. */
  pages: number;
};

export const DEFAULT_ACTIVITY_FILTERS: ActivityFilters = { scope: "all", person: null, kind: "all", pages: 1 };

export const ACTIVITY_PAGE_SIZE = 25;

/** Past this many pages the download has the rest. */
export const MAX_ACTIVITY_PAGES = 40;

/** The kinds worth offering for the apps shown, in menu order. */
export function kindsFor(visible: readonly ActivityScope[], scope: ActivityFilters["scope"]): ActivityKind[] {
  const shown = scope === "all" ? visible : visible.filter((s) => s === scope);
  return KIND_KEYS.filter((kind) => KINDS[kind].scopes.some((s) => shown.includes(s)));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Reads the filters from the URL. Anything unknown, or outside what
 * someone can see, falls back to showing everything.
 */
export function parseActivityFilters(params: SearchParams, visible: readonly ActivityScope[]): ActivityFilters {
  const app = first(params.app);
  const scope = visible.find((s) => s === app) ?? "all";

  const action = first(params.action);
  const kind = kindsFor(visible, scope).find((k) => k === action) ?? "all";

  const person = first(params.person);
  const pages = Number(first(params.pages));

  return {
    scope,
    person: person && UUID.test(person) ? person.toLowerCase() : null,
    kind,
    pages: Number.isInteger(pages) ? Math.min(Math.max(pages, 1), MAX_ACTIVITY_PAGES) : 1,
  };
}

/** The URL for these filters, leaving out defaults. Downloads ignore the page count. */
export function activityHref(filters: ActivityFilters, path = "/activity"): string {
  const params = new URLSearchParams();
  if (filters.scope !== "all") params.set("app", filters.scope);
  if (filters.person) params.set("person", filters.person);
  if (filters.kind !== "all") params.set("action", filters.kind);
  if (filters.pages > 1 && path === "/activity") params.set("pages", String(filters.pages));
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/** Switches app, keeping the action when the new app has it. */
export function withScope(filters: ActivityFilters, scope: ActivityFilters["scope"]): ActivityFilters {
  const keep = filters.kind !== "all" && KINDS[filters.kind].scopes.some((s) => scope === "all" || s === scope);
  return { ...filters, scope, kind: keep ? filters.kind : "all", pages: 1 };
}

export type ActivityQuery = {
  scopes: ActivityScope[];
  /** Null for every action. */
  actions: string[] | null;
  actorId: string | null;
};

/** What to ask the feed for. */
export function activityQuery(filters: ActivityFilters, visible: readonly ActivityScope[]): ActivityQuery {
  return {
    scopes: filters.scope === "all" ? [...visible] : visible.filter((s) => s === filters.scope),
    actions: filters.kind === "all" ? null : [...KINDS[filters.kind].actions],
    actorId: filters.person,
  };
}
