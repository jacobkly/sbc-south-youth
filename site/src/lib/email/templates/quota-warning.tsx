import type { ReactElement } from "react";
import { EmailButton, EmailHeading, EmailLayout, EmailText } from "./layout";

export type QuotaWarningInput = {
  /** The log's subject, which carries the month's count. */
  subject: string;
  /** The portal's Email screen. */
  url: string;
};

/**
 * Tells every owner, once a month, that the last 31 days passed 80% of the
 * 3,000 emails Resend's free plan sends, before anything is held back.
 */
export function quotaWarningEmail({ subject, url }: QuotaWarningInput): ReactElement {
  return (
    <EmailLayout
      preview="The portal, finances, and the site are over 80% of the free plan's emails for the month."
      reason="Owners get this at most once a month, when email use passes 80% of the free plan."
    >
      <EmailHeading>{subject}</EmailHeading>
      <EmailText>
        The portal, finances, and the site have sent over 80% of the 3,000 emails a month that Resend&apos;s free
        plan allows, counted over the last 31 days.
      </EmailText>
      <EmailText>
        Once 2,900 have gone out, only sign-in codes still send, so nobody gets locked out. Everything else starts
        again as older emails age out of the count.
      </EmailText>
      <EmailText>The Email screen shows what&apos;s been sending and anything that bounced.</EmailText>
      <EmailButton href={url}>Open Email</EmailButton>
    </EmailLayout>
  );
}
