import { z } from "zod";
import { APP_ROLES, type AppRole } from "@/lib/portal/roles";

/**
 * The roles an invite can give. Owner isn't one: it's given on a person's
 * page once they've set up their account, with two-step sign-in.
 */
export const INVITE_ROLES = APP_ROLES.filter((role) => role !== "owner") as Exclude<AppRole, "owner">[];

/** Which payee a new requester gets: a new one, or one already in finances. */
export type PayeeChoice = { kind: "new" } | { kind: "existing"; id: string };

export type Invite = {
  fullName: string;
  email: string;
  roles: AppRole[];
  /** Only for requesters. */
  payee: PayeeChoice | null;
};

export type InviteErrors = Partial<Record<"fullName" | "email" | "roles" | "adult" | "payee", string>>;

export type InviteCheck = { ok: true; invite: Invite } | { ok: false; errors: InviteErrors };

const MESSAGES = {
  name: "Enter their name.",
  nameLength: "Keep the name to 100 characters or fewer.",
  email: "Enter their email address.",
  emailShape: "Enter a whole email address, like name@example.com.",
  roles: "Choose at least one role.",
  adult: "Only adults get an account. Check this to confirm they're 18 or older.",
  payee: "Pick a payee.",
};

const text = z.preprocess((value) => (typeof value === "string" ? value : ""), z.string());

const inviteSchema = z.object({
  fullName: text
    .transform((value) => value.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(1, MESSAGES.name).max(100, MESSAGES.nameLength)),
  email: text
    .transform((value) => value.trim().toLowerCase())
    .pipe(z.string().min(1, MESSAGES.email).max(254, MESSAGES.emailShape).pipe(z.email(MESSAGES.emailShape))),
  roles: z
    .array(z.enum(INVITE_ROLES), MESSAGES.roles)
    .min(1, MESSAGES.roles)
    .transform((roles) => APP_ROLES.filter((role) => roles.includes(role as Exclude<AppRole, "owner">))),
  adult: z.literal(true, MESSAGES.adult),
  payee: text.transform((value) => value.trim()),
});

/**
 * Checks the invite form. Every problem comes back at once, keyed by field,
 * in words the form can show as they are.
 */
export function checkInvite(input: unknown): InviteCheck {
  const values = input && typeof input === "object" ? input : {};
  const result = inviteSchema.safeParse(values);
  const errors: InviteErrors = {};

  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof InviteErrors;
      // A role list with one bad entry reports it once, on the list.
      errors[field] ??= field === "roles" ? MESSAGES.roles : issue.message;
    }
  }

  // The payee is checked whenever the roles are fine, so its problem shows up with the rest.
  const fields = values as Record<string, unknown>;
  const rolesCheck = inviteSchema.shape.roles.safeParse(fields.roles);
  let payee: PayeeChoice | null = null;
  if (rolesCheck.success && rolesCheck.data.includes("finance_requester")) {
    const picked = inviteSchema.shape.payee.parse(fields.payee);
    if (picked === "" || picked === "new") payee = { kind: "new" };
    else if (z.uuid().safeParse(picked).success) payee = { kind: "existing", id: picked.toLowerCase() };
    else errors.payee = MESSAGES.payee;
  }

  if (!result.success || Object.keys(errors).length > 0) return { ok: false, errors };
  const { fullName, email, roles } = result.data;
  return { ok: true, invite: { fullName, email, roles, payee } };
}
