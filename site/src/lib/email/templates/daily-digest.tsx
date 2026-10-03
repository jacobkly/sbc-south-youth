import type { ReactElement } from "react";
import type { Database } from "@/lib/database.types";
import { MESSAGE_SUMMARY, sentAt } from "./form-alert";
import {
  EmailButton,
  EmailFacts,
  EmailHeading,
  EmailLayout,
  EmailLink,
  EmailNote,
  EmailQuote,
  EmailSubheading,
  EmailText,
} from "./layout";

export type DigestMessage = {
  kind: Database["site"]["Enums"]["message_kind"];
  name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  /** The form's answers, as the form showed them, like "Parent or guardian". */
  answers: readonly (readonly [label: string, value: string])[];
  /** When it was sent, as an instant. */
  at: string;
  /** The message in the portal. */
  url: string;
};

export type DailyDigestInput = {
  /** The log's subject, with how many are waiting. */
  subject: string;
  /** How many the digest lists, which can be more than it shows. */
  total: number;
  /** The ones it shows, takedowns first and then the oldest. */
  messages: readonly DigestMessage[];
  /** Tests from the staging site, which nobody else hears about. */
  staging: boolean;
  /** The portal's Messages inbox. */
  url: string;
};

/** How much of a message the digest shows. The portal has the rest. */
const MESSAGE_LIMIT = 500;

/** Cuts a long message at a word, so the digest stays readable. */
function shorten(message: string): string {
  const characters = [...message];
  if (characters.length <= MESSAGE_LIMIT) return message;
  const cut = characters.slice(0, MESSAGE_LIMIT).join("");
  const lastSpace = cut.search(/\s\S*$/);
  return `${(lastSpace > MESSAGE_LIMIT / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * The morning's list of messages whose alerts never went out, because the
 * outbox was full, Resend refused them, or email was off. Unlike an alert,
 * it has no Reply-To, since it's from several people at once.
 */
export function dailyDigestEmail(input: DailyDigestInput): ReactElement {
  const { subject, total, messages, staging, url } = input;
  const more = total - messages.length;
  const reply = staging
    ? "Tests from the staging site. There's nobody to write back to."
    : "Replying to this email won't reach them. Write back to each person at their email, or call or text.";

  return (
    <EmailLayout
      preview={messages.map(({ kind, name }) => MESSAGE_SUMMARY[kind](name)).join(" ")}
      reason="You're getting this because this address takes messages from the SBC South Youth website."
    >
      <EmailHeading>{subject}</EmailHeading>
      <EmailText>
        These came in through the website, but their emails didn&apos;t go out at the time, so here they are
        together.
      </EmailText>
      {more > 0 && (
        <EmailText>
          Here are {messages.length} of them. The other {more} are in the portal.
        </EmailText>
      )}
      <EmailText>{reply}</EmailText>
      {messages.map((message) => {
        const facts: [string, string][] = [];
        if (message.email) facts.push(["Email", message.email]);
        if (message.phone) facts.push(["Phone", message.phone]);
        facts.push(...message.answers.map(([label, value]): [string, string] => [label, value]));
        facts.push(["Sent", sentAt(message.at)]);
        return (
          <div key={message.url}>
            <EmailSubheading>{MESSAGE_SUMMARY[message.kind](message.name)}</EmailSubheading>
            {message.message && <EmailQuote>{shorten(message.message)}</EmailQuote>}
            <EmailFacts facts={facts} />
            <EmailLink href={message.url}>Open in the portal</EmailLink>
          </div>
        );
      })}
      <EmailButton href={url}>Open Messages</EmailButton>
      <EmailNote>Mark each one handled in the portal once someone has answered, so nobody answers twice.</EmailNote>
    </EmailLayout>
  );
}
