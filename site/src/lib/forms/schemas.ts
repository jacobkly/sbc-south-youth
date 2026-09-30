import * as z from "zod/mini";
import { serveAreas } from "@/content/serve-areas";

/**
 * The message forms: Contact, Plan a visit, Join the chat, and Serve. The
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
export const contactRoles = ["student", "parent", "other"] as const;
export type ContactRole = (typeof contactRoles)[number];

const studentBands = ["hs", "college", "not-in-school"] as const;

/**
 * High school, college, or not in school, on the Join form, so a leader
 * knows when they're adding a minor to the chat. It's optional.
 */
export type StudentBand = (typeof studentBands)[number];

export const limits = { name: 80, email: 254, phone: 25, message: 2000, note: 500 } as const;

const textFields = ["name", "email", "phone", "role", "band", "message"] as const;

/** A form's answers: trimmed text with blanks left out, and the checked areas. */
export type MessageInput = Partial<Record<(typeof textFields)[number], string>> & { areas?: string[] };

/** A field's problem, by field name. `reach` is the email-or-phone pair. */
export type FieldName = keyof MessageInput | "reach";
export type FieldErrors = Partial<Record<FieldName, string>>;

/** A message that passed every check, ready to save. */
export type Message = {
  kind: MessageKind;
  name: string;
  email?: string;
  phone?: string;
  role?: ContactRole;
  band?: StudentBand;
  areas?: string[];
  message?: string;
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
  const areas = data.getAll("areas").filter((value): value is string => typeof value === "string" && value !== "");
  if (areas.length > 0) input.areas = areas;
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
const note = z.string().check(z.maxLength(limits.note, tooLong(limits.note)));

const schemas = {
  contact: z.object({
    name,
    email: email("Add your email so we can write back."),
    phone: z.optional(phone),
    role: z.enum(contactRoles, "Pick one."),
    message: z.string({ error: "Write a message." }).check(z.maxLength(limits.message, tooLong(limits.message))),
  }),
  visit: z.object({
    name,
    email: z.optional(email()),
    phone: z.optional(phone),
    message: z.optional(note),
  }),
  join: z.object({
    name,
    email: z.optional(email()),
    phone: z.optional(phone),
    band: z.optional(z.enum(studentBands, "Pick one.")),
  }),
  serve: z.object({
    name,
    email: z.optional(email()),
    phone: z.optional(phone),
    areas: z.optional(z.array(z.string())),
    message: z.optional(note),
  }),
};

const areaIds = serveAreas.map((area) => area.id);

/**
 * Checks a form's answers. It reports every problem at once, each under
 * its field, including the rules that span fields: an email or a phone,
 * and areas from the list.
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
  if (kind === "serve") {
    if (!input.areas) errors.areas = "Pick at least one area.";
    else if (input.areas.some((area) => !areaIds.includes(area))) errors.areas = "Pick areas from the list.";
  }

  if (!parsed.success || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, message: { kind, ...parsed.data } };
}
