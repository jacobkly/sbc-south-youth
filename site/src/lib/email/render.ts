import "server-only";
import { render, toPlainText } from "@react-email/render";
import type { ReactElement } from "react";

export type RenderedEmail = { html: string; text: string };

/**
 * Turns an email template into the HTML and plain-text parts Resend sends.
 * The text part reads the finished HTML, so the two always say the same thing.
 */
export async function renderEmail(body: ReactElement): Promise<RenderedEmail> {
  const html = await render(body);
  // Headings keep their case: plain text would otherwise shout them.
  const text = toPlainText(html, {
    selectors: [
      { selector: "h1", options: { uppercase: false } },
      { selector: "h2", options: { uppercase: false } },
    ],
  }).trim();
  return { html, text };
}
