import type { ReactElement } from "react";
import { EmailButton, EmailHeading, EmailLayout, EmailNote, EmailText } from "@/lib/email/templates/layout";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, sortRoles, type AppRole } from "@/lib/portal/roles";
import type { AccountLinks } from "./invite";

export type InviteEmailInput = {
  /** A first invite (or a resend of one), or new roles for someone who already signs in. */
  kind: "invite" | "access";
  fullName: string;
  email: string;
  inviterName: string;
  /** Every role for an invite, and only the new ones for access. */
  roles: readonly AppRole[];
  links: AccountLinks;
};

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** Each role and what it lets them do, as a short list. */
function RoleList({ roles }: { roles: readonly AppRole[] }) {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0} style={{ margin: "0 0 8px" }}>
      <tbody>
        {sortRoles(roles).map((role) => (
          <tr key={role}>
            <td style={{ padding: "0 0 12px" }}>
              <EmailText>
                <strong>{ROLE_LABELS[role]}</strong>
                <br />
                {ROLE_DESCRIPTIONS[role]}
              </EmailText>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The email an owner's invite sends. Its link is the plain setup or sign-in
 * page, with nothing about the person in it: they prove the address by
 * typing it there and getting a code, so the link can't go stale.
 */
export function inviteEmail(input: InviteEmailInput): { subject: string; body: ReactElement } {
  const { kind, fullName, email, inviterName, roles, links } = input;
  const name = firstName(fullName);
  const inviter = firstName(inviterName);

  if (kind === "access") {
    return {
      subject: `You have new access in ${links.appName}`,
      body: (
        <EmailLayout
          preview={`${inviter} gave you new access.`}
          reason="You're getting this because an owner changed your access."
        >
          <EmailHeading>Hi {name}</EmailHeading>
          <EmailText>
            {inviter} gave you new access in {links.appName}. Now you can also use:
          </EmailText>
          <RoleList roles={roles} />
          {roles.includes("owner") && (
            <EmailText>
              Owners also enter a code from an authenticator app when they sign in. You&apos;ll set one up the next
              time you open the portal.
            </EmailText>
          )}
          <EmailButton href={links.signInUrl}>Sign in</EmailButton>
          <EmailNote>
            Sign in with {email} and your password. If you don&apos;t remember it, choose Forgot password? on the
            sign-in page.
          </EmailNote>
        </EmailLayout>
      ),
    };
  }

  return {
    subject: `Set up your ${links.appName} account`,
    body: (
      <EmailLayout
        preview="Set up your account in a couple of minutes."
        reason="You're getting this because an owner of SBC South Youth invited you."
      >
        <EmailHeading>Welcome, {name}</EmailHeading>
        <EmailText>
          {inviter} invited you to {links.appName}. Here&apos;s what you&apos;ll be able to do:
        </EmailText>
        <RoleList roles={roles} />
        <EmailButton href={links.setupUrl}>Set up your account</EmailButton>
        <EmailNote>
          On that page, enter {email} to get a 6-digit code, then pick a password. This invite doesn&apos;t expire.
          If you weren&apos;t expecting it, you can ignore this email.
        </EmailNote>
      </EmailLayout>
    ),
  };
}
