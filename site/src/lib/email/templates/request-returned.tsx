import type { ReactElement } from "react";
import { formatCents } from "@/lib/money";
import { EmailButton, EmailHeading, EmailLayout, EmailQuote, EmailText } from "./layout";

export type RequestReturnedInput = {
  subject: string;
  amountCents: number;
  vendor: string | null;
  /** The owner who asked. Null when nobody signed in did. */
  by: string | null;
  /** What they asked. */
  note: string | null;
  /** The requester's own copy of the request in finances. */
  url: string;
};

/** Gives the requester an owner's question about their request. */
export function requestReturnedEmail(input: RequestReturnedInput): ReactElement {
  const { subject, amountCents, vendor, by, note, url } = input;
  const request = `your ${formatCents(amountCents)} request${vendor ? ` from ${vendor}` : ""}`;
  const asked = note
    ? `${by ?? "An owner"} has a question about ${request}:`
    : `${by ?? "An owner"} needs more info about ${request}.`;

  return (
    <EmailLayout
      preview={note ?? asked}
      reason="You're getting this because you asked to be paid back through SBC South Youth finances."
    >
      <EmailHeading>{subject}</EmailHeading>
      <EmailText>{asked}</EmailText>
      {note && <EmailQuote>{note}</EmailQuote>}
      <EmailText>Add what&apos;s missing, then choose Resubmit to send it back for review.</EmailText>
      <EmailButton href={url}>Open your request</EmailButton>
    </EmailLayout>
  );
}
