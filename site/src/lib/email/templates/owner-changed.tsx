import type { ReactElement } from "react";
import { formatDate, formatTime, laDateOf } from "@/lib/dates";
import { EmailButton, EmailHeading, EmailLayout, EmailText } from "./layout";

export type OwnerChangedInput = {
  /** The log's subject, which says whether they gained or lost Owner. */
  subject: string;
  /** The owner who made the change. Null when it was made outside the portal. */
  by: string | null;
  /** When the change was made, as an instant. */
  at: string;
  /** People in the portal. */
  url: string;
};

/**
 * Tells every owner, and anyone who just stopped being one, that someone
 * gained or lost Owner, so a change nobody expected can't go unnoticed.
 */
export function ownerChangedEmail({ subject, by, at, url }: OwnerChangedInput): ReactElement {
  const when = `${formatDate(laDateOf(at))} at ${formatTime(at)}`;
  const who = by ? `${by} made this change on ${when}.` : `This change was made on ${when}, outside the portal.`;

  return (
    <EmailLayout
      preview={who}
      reason="Every owner gets this, and so does anyone who stops being one, so a change nobody expected gets noticed."
    >
      <EmailHeading>{subject}</EmailHeading>
      <EmailText>{who}</EmailText>
      <EmailText>
        Owners can do everything in the portal and in finances, like inviting people, changing roles, and paying
        reimbursements.
      </EmailText>
      <EmailText>If nobody expected this, check People right away.</EmailText>
      <EmailButton href={url}>Open People</EmailButton>
    </EmailLayout>
  );
}
