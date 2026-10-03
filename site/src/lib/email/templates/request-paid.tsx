import type { ReactElement } from "react";
import type { Database } from "@/lib/database.types";
import { formatDate, laDateOf } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { EmailButton, EmailHeading, EmailLayout, EmailNote, EmailText } from "./layout";

export type PaymentMethod = Database["public"]["Enums"]["payment_method"];

/** How each method reads after "was paid". "Other" says nothing it doesn't know. */
const PAID_THROUGH: Record<PaymentMethod, string | null> = {
  cash_app: "through Cash App",
  bank_transfer: "by bank transfer",
  check: "by check",
  cash: "in cash",
  other: null,
};

export type RequestPaidInput = {
  subject: string;
  amountCents: number;
  vendor: string | null;
  paymentMethod: PaymentMethod | null;
  /** When it was paid, as an instant. */
  paidAt: string | null;
  /** The requester's own copy of the request in finances. */
  url: string;
};

/** Tells the requester their request was paid, and how. */
export function requestPaidEmail(input: RequestPaidInput): ReactElement {
  const { subject, amountCents, vendor, paymentMethod, paidAt, url } = input;
  const how = paymentMethod ? PAID_THROUGH[paymentMethod] : null;
  const paid = [
    `Your ${formatCents(amountCents)} request${vendor ? ` from ${vendor}` : ""} was paid`,
    how,
    paidAt && `on ${formatDate(laDateOf(paidAt))}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <EmailLayout
      preview={`${paid}.`}
      reason="You're getting this because you asked to be paid back through SBC South Youth finances."
    >
      <EmailHeading>{subject}</EmailHeading>
      <EmailText>{paid}.</EmailText>
      <EmailButton href={url}>View your request</EmailButton>
      <EmailNote>If it hasn&apos;t arrived or something looks off, let an owner know.</EmailNote>
    </EmailLayout>
  );
}
