import * as z from "zod/mini";
import { connect } from "@/content/connect";
import { teamsFor } from "@/content/serve-teams";
import type { AudienceFilter } from "@/lib/audience";

/**
 * The message forms: Contact, Plan a visit, Join a group, and Serve. The
 * page and the server action check them with these same rules, so the
 * page never accepts a message the server would refuse. It's zod/mini
 * because it ships to the browser.
 *
 * Keep the lists on the Privacy page (content/privacy.ts) in step with
 * the fields here.
 */

export const messageKinds = ["contact", "visit", "join", "serve"] as const;
export type MessageKind = (typeof messageKinds)[number];

/** Who's writing in on the Contact form. */
export const contactRoles = ["hs", "college", "parent", "other"] as const;
export type ContactRole = (typeof contactRoles)[number];

const studentBands = ["hs", "college"] as const satisfies readonly AudienceFilter[];

export const limits = { name: 80, email: 254, phone: 25, message: 2000, note: 500 } as const;

const textFields = ["name", "email", "phone", "gradeBand", "group", "parentEmail", "message"] as const;

/** A form's answers: trimmed text with blanks left out, and the checked teams. */
export type MessageInput = Partial<Record<(typeof textFields)[number], string>> & { teams?: string[] };

/** A field's problem, by field name. `reach` is the email-or-phone pair. */
export type FieldName = keyof MessageInput | "reach";
export type FieldErrors = Partial<Record<FieldName, string>>;

/** A message that passed every check, ready to save. */
export type Message = {
  kind: MessageKind;
  name: string;
  email?: string;
  phone?: string;
  gradeBand: ContactRole;
  group?: string;
  teams?: string[];
  message?: string;
  parentEmail?: string;
};

export type CheckResult = { ok: true; message: Message } | { ok: false; errors: FieldErrors };

/** Reads the form fields, whether from the page or the server action. */
export function readMessageInput(data: FormData): MessageInput {
  const input: MessageInput = {};
  for (const field of textFields) {
    const value = data.get(field);
    if (typeof value !== "string") continue;
    // Browsers send a line break as \r\n, but a textarea counts it as one.
    const text = value.replace(/\r\n?/g, "\n").trim();
    if (text) input[field] = text;
  }
  const teams = data.getAll("teams").filter((value): value is string => typeof value === "string" && value !== "");
  if (teams.length > 0) input.teams = teams;
  return input;
}

/** A phone number with its area code: 10 to 15 digits and the usual punctuation. */
export function isPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "").length;
  return /^\+?[\d\s().-]+$/.test(value) && digits >= 10 && digits <= 15;
}

const tooLong = (max: number) => `Keep it under ${max} characters.`;
const badEmail = "That email doesn't look right.";

function email(missing = badEmail) {
  return z
    .email({ error: (issue) => (issue.input === undefined ? missing : badEmail) })
    .check(z.maxLength(limits.email, badEmail));
}

const name = z.string({ error: "Add your name." }).check(z.maxLength(limits.name, tooLong(limits.name)));
const phone = z.string().check(z.refine(isPhone, "Add the area code, like 555-555-0123."));
const studentBand = z.enum(studentBands, "Pick high school or college.");
const note = z.string().check(z.maxLength(limits.note, tooLong(limits.note)));

const schemas = {
  contact: z.object({
    name,
    email: email("Add your email so we can write back."),
    phone: z.optional(phone),
    gradeBand: z.enum(contactRoles, "Pick one."),
    message: z.string({ error: "Write a message." }).check(z.maxLength(limits.message, tooLong(limits.message))),
  }),
  visit: z.object({
    name,
    email: z.optional(email()),
    phone: z.optional(phone),
    gradeBand: studentBand,
    message: z.optional(note),
  }),
  join: z.object({
    name,
    email: z.optional(email()),
    phone: z.optional(phone),
    gradeBand: studentBand,
    group: z.enum(
      connect.join.options.map((option) => option.id),
      "Pick one.",
    ),
    parentEmail: z.optional(email()),
  }),
  serve: z.object({
    name,
    email: z.optional(email()),
    phone: z.optional(phone),
    gradeBand: studentBand,
    teams: z.optional(z.array(z.string())),
    message: z.optional(note),
  }),
};

function isStudentBand(value: string | undefined): value is AudienceFilter {
  return studentBands.some((band) => band === value);
}

/**
 * Checks a form's answers. It reports every problem at once, each under
 * its field, including the rules that span fields: an email or a phone,
 * a parent or guardian's email for high school, and teams for the grade
 * band.
 */
export function checkMessage(kind: MessageKind, input: MessageInput): CheckResult {
  const parsed = schemas[kind].safeParse(input);
  const errors: FieldErrors = {};
  for (const issue of parsed.error?.issues ?? []) {
    errors[issue.path[0] as FieldName] ??= issue.message;
  }

  if (kind !== "contact" && !input.email && !input.phone) {
    errors.reach = "Add an email or a phone number.";
  }
  if (kind === "join" && input.gradeBand === "hs") {
    if (!input.parentEmail) errors.parentEmail = "Add a parent or guardian's email.";
    else if (input.parentEmail.toLowerCase() === input.email?.toLowerCase()) {
      errors.parentEmail ??= "Use a parent's or guardian's email, not yours.";
    }
  }
  if (kind === "serve") {
    const offered = isStudentBand(input.gradeBand) ? teamsFor(input.gradeBand).map((team) => team.id) : null;
    if (!input.teams) errors.teams = "Pick at least one team.";
    else if (offered && input.teams.some((team) => !offered.includes(team))) errors.teams = "Pick teams from the list.";
  }

  if (!parsed.success || Object.keys(errors).length > 0) return { ok: false, errors };

  const message: Message = { kind, ...parsed.data };
  // Only high school students need a parent in the loop, so don't keep one otherwise.
  if (message.gradeBand !== "hs") delete message.parentEmail;
  return { ok: true, message };
}
