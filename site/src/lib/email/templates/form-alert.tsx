import type { ReactElement } from "react";
import type { Database } from "@/lib/database.types";
import { formatDate, formatTime, laDateOf } from "@/lib/dates";
import { EmailButton, EmailFacts, EmailHeading, EmailLayout, EmailNote, EmailQuote, EmailText } from "./layout";

export type FormAlertInput = {
  /** The log's subject, with the kind and the sender's first name. */
  subject: string;
  kind: Database["site"]["Enums"]["message_kind"];
  name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  /** The form's answers, as the form showed them, like "Parent or guardian". */
  answers: readonly (readonly [label: string, value: string])[];
  /** When it was sent, as an instant. */
  at: string;
  /** A test from the staging site, which nobody else hears about. */
  staging: boolean;
  /** The message in the portal. */
  url: string;
};

const SUMMARY: Record<FormAlertInput["kind"], (name: string) => string> = {
  contact: (name) => `${name} sent a message from the Contact page.`,
  takedown: (name) => `${name} asked us to take down a photo.`,
  visit: (name) => `${name} is planning a visit.`,
  join: (name) => `${name} wants to join the group chat.`,
  serve: (name) => `${name} wants to serve.`,
};

/**
 * Tells the youth inbox someone sent a form, with the whole message, so a
 * leader can answer from the email. Its Reply-To is the sender's email.
 */
export function formAlertEmail(input: FormAlertInput): ReactElement {
  const { subject, kind, name, email, phone, message, answers, at, staging, url } = input;
  const firstName = name.split(/\s+/)[0];
  const summary = SUMMARY[kind](name);
  const facts: [string, string][] = [];
  if (email) facts.push(["Email", email]);
  if (phone) facts.push(["Phone", phone]);
  facts.push(...answers.map(([label, value]): [string, string] => [label, value]));
  facts.push(["Sent", `${formatDate(laDateOf(at))} at ${formatTime(at)}`]);

  const reply = staging
    ? "A test from the staging site. Replying won't reach the sender."
    : email
      ? `Reply to this email to write back to ${firstName}.`
      : `${firstName} left a phone number, so call or text to write back.`;

  return (
    <EmailLayout
      preview={summary}
      reason="You're getting this because this address takes messages from the SBC South Youth website."
    >
      <EmailHeading>{subject}</EmailHeading>
      <EmailText>{summary}</EmailText>
      {message && <EmailQuote>{message}</EmailQuote>}
      <EmailFacts facts={facts} />
      <EmailText>{reply}</EmailText>
      <EmailButton href={url}>Open in the portal</EmailButton>
      <EmailNote>Mark it handled in the portal once someone has answered, so nobody answers twice.</EmailNote>
    </EmailLayout>
  );
}
