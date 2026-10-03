import type { ReactElement } from "react";
import { formatCents } from "@/lib/money";
import { EmailButton, EmailFacts, EmailHeading, EmailLayout, EmailText } from "./layout";

export type RequestSubmittedInput = {
  /** The log's subject, which says whether it's new or resubmitted. */
  subject: string;
  amountCents: number;
  vendor: string | null;
  description: string | null;
  /** Who sent it. Null when nobody signed in did. */
  by: string | null;
  /** Whether the sender is the payee, asking for their own money. */
  byPayee: boolean;
  payee: string;
  /** The request in finances. */
  url: string;
};

/** Tells every owner but the sender that a request is waiting for review. */
export function requestSubmittedEmail(input: RequestSubmittedInput): ReactElement {
  const { subject, amountCents, vendor, description, by, byPayee, payee, url } = input;
  const amount = formatCents(amountCents);
  const summary = !by
    ? `There's a ${amount} request for ${payee}.`
    : byPayee
      ? `${by} asked to be paid back ${amount}.`
      : `${by} sent a ${amount} request for ${payee}.`;
  const facts: [string, string][] = [["Amount", amount]];
  if (vendor) facts.push(["Store", vendor]);
  if (description) facts.push(["What for", description]);

  return (
    <EmailLayout preview={summary} reason="You're getting this because you're an owner of SBC South Youth finances.">
      <EmailHeading>{subject}</EmailHeading>
      <EmailText>{summary}</EmailText>
      <EmailFacts facts={facts} />
      <EmailButton href={url}>Review request</EmailButton>
    </EmailLayout>
  );
}
