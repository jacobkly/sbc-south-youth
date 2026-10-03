import { z } from "zod";
import { usageLevel, type UsageLevel } from "@/lib/portal/home/storage";

/**
 * The owner's Email screen: emails counted toward Resend's free plan, 100 a
 * day and 3,000 a month, over the same rolling 24 hours and 31 days
 * email_reserve() checks, since Resend doesn't say when its own windows
 * reset. Amber from 80% and red from 95%, like the storage bar.
 */

export const DAILY_LIMIT = 100;
export const MONTHLY_LIMIT = 3000;

const STATUSES = [
  "skipped_quota",
  "suppressed",
  "queued",
  "sending",
  "sent",
  "failed",
  "delivered",
  "bounced",
  "complained",
] as const;

export type EmailStatus = (typeof STATUSES)[number];

const summarySchema = z.object({
  day: z.number().int().nonnegative(),
  month: z.number().int().nonnegative(),
  templates: z.array(
    z.object({
      template: z.string(),
      status: z.enum(STATUSES),
      counted: z.boolean(),
      emails: z.number().int().positive(),
    }),
  ),
  warned_at: z.string().nullable(),
});

/** What email_summary() returns: counts only, never an address or a subject. */
export type EmailSummary = z.infer<typeof summarySchema>;

/** Checks what email_summary() returned. Throws rather than show wrong numbers. */
export function parseEmailSummary(data: unknown): EmailSummary {
  return summarySchema.parse(data);
}

const TEMPLATE_LABELS: Record<string, string> = {
  auth: "Sign-in codes",
  invite: "Invites",
  access: "New access",
  "owner-changed": "Owner changes",
  "request-submitted": "Requests to review",
  "request-returned": "Requests sent back",
  "request-paid": "Requests paid",
  "form-alert": "Form alerts",
  "daily-digest": "Daily digest",
  "quota-warning": "Quota warnings",
};

/** A template's name for people, or its own name if it's new. */
export function templateLabel(template: string): string {
  return Object.hasOwn(TEMPLATE_LABELS, template) ? TEMPLATE_LABELS[template] : template;
}

/** The statuses that need an owner's eye, most serious first. */
export const PROBLEMS = [
  { status: "complained", label: "Marked as spam" },
  { status: "bounced", label: "Bounced" },
  { status: "failed", label: "Failed" },
  { status: "skipped_quota", label: "Skipped for the limit" },
] as const satisfies readonly { status: EmailStatus; label: string }[];

export type ProblemStatus = (typeof PROBLEMS)[number]["status"];

export type EmailUsage = {
  used: number;
  limit: number;
  /** Whole percent used, rounded down. Can pass 100. */
  percent: number;
  level: UsageLevel;
  /** At or past the limit. */
  full: boolean;
};

export type TemplateRow = {
  template: string;
  label: string;
  /** What Resend took, which is what counts toward the limits. Bounces count too. */
  sent: number;
  problems: { status: ProblemStatus; label: string; emails: number }[];
};

export type EmailOverview = {
  day: EmailUsage;
  month: EmailUsage;
  /** What the limits are holding back right now, or null when everything sends. */
  note: { level: Exclude<UsageLevel, "ok">; text: string } | null;
  templates: TemplateRow[];
  /** When owners were warned this month, or null. */
  warnedAt: string | null;
};

function usage(used: number, limit: number): EmailUsage {
  const percent = Math.floor((used * 100) / limit);
  return { used, limit, percent, level: usageLevel(percent), full: used >= limit };
}

/**
 * Mirrors email_reserve()'s caps: finance emails and form alerts stop at 80
 * in a day, invites and owner alerts at 90, the digest at 100, and
 * everything the apps send at 2,900 in a month. Sign-in codes go straight
 * from Supabase to Resend, so only Resend's own 100 and 3,000 stop them.
 */
function quotaNote(day: number, month: number): EmailOverview["note"] {
  if (month >= MONTHLY_LIMIT) {
    return {
      level: "critical",
      text:
        "Resend's monthly limit is reached, so nothing sends and sign-in codes may fail. Sending picks up as " +
        "the last 31 days drop below 3,000.",
    };
  }
  if (day >= DAILY_LIMIT) {
    return {
      level: "critical",
      text:
        "Resend's daily limit is reached, so nothing sends and sign-in codes may fail. Sending picks up as the " +
        "last 24 hours drop below 100.",
    };
  }
  if (month >= 2900) {
    return {
      level: "critical",
      text: "Only sign-in codes send for now. Everything else sends again once the last 31 days drop below 2,900.",
    };
  }
  if (day >= 90) {
    return {
      level: "warning",
      text:
        "Only sign-in codes and the daily digest send for now. Invites and owner alerts send again once the " +
        "last 24 hours drop below 90, and everything else below 80.",
    };
  }
  if (day >= 80) {
    return {
      level: "warning",
      text:
        "Finance emails and form alerts are skipped for now, to keep room for sign-in codes, invites and the " +
        "digest. They send again once the last 24 hours drop below 80.",
    };
  }
  return null;
}

/** One row per template from the last 31 days, busiest first, with its problems beside it. */
function templateRows(templates: EmailSummary["templates"]): TemplateRow[] {
  const rows = new Map<string, TemplateRow>();
  for (const { template, status, counted, emails } of templates) {
    const row = rows.get(template) ?? { template, label: templateLabel(template), sent: 0, problems: [] };
    if (counted) row.sent += emails;
    const problem = PROBLEMS.find((candidate) => candidate.status === status);
    if (problem) {
      const existing = row.problems.find((item) => item.status === problem.status);
      if (existing) existing.emails += emails;
      else row.problems.push({ ...problem, emails });
    }
    rows.set(template, row);
  }

  const rank = (status: ProblemStatus) => PROBLEMS.findIndex((problem) => problem.status === status);
  return [...rows.values()]
    .map((row) => ({ ...row, problems: row.problems.toSorted((a, b) => rank(a.status) - rank(b.status)) }))
    .toSorted((a, b) => b.sent - a.sent || a.label.localeCompare(b.label));
}

/** Works out how full both limits are, what they hold back, and the per-template counts. */
export function emailOverview(summary: EmailSummary): EmailOverview {
  return {
    day: usage(summary.day, DAILY_LIMIT),
    month: usage(summary.month, MONTHLY_LIMIT),
    note: quotaNote(summary.day, summary.month),
    templates: templateRows(summary.templates),
    warnedAt: summary.warned_at,
  };
}

const LEVEL_RANK: Record<UsageLevel, number> = { ok: 0, warning: 1, critical: 2 };

export type EmailAlert = { level: Exclude<UsageLevel, "ok">; title: string; text: string };

/**
 * What an owner's Home says once either limit passes 80%: the fuller one,
 * and what's being skipped, or what will be. Null below 80%.
 */
export function emailAlert({ day, month, note }: EmailOverview): EmailAlert | null {
  const levels: UsageLevel[] = [day.level, month.level, note?.level ?? "ok"];
  const level = levels.reduce((worst, next) => (LEVEL_RANK[next] > LEVEL_RANK[worst] ? next : worst));
  if (level === "ok") return null;

  const [usage, name] = day.percent > month.percent ? [day, "today's"] : [month, "this month's"];
  return {
    level,
    title: `${usage.percent}% of ${name} email is used`,
    // Without a note, the month is past 80% but still under 2,900.
    text: note?.text ?? "Once the last 31 days reach 2,900, only sign-in codes send.",
  };
}
