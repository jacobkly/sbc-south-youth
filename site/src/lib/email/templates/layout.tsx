import type { CSSProperties, ReactNode } from "react";

/**
 * The shell every email shares, in the portal's neutral look. Email clients
 * drop most CSS, so styles are inline and the layout is tables. The one
 * <style> block only darkens the email in clients that honor dark mode
 * (Apple Mail, iOS Mail); Gmail picks its own dark colors.
 */

const font =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const colors = {
  page: "#f5f5f5",
  card: "#ffffff",
  border: "#e5e5e5",
  quote: "#d4d4d4",
  heading: "#0a0a0a",
  text: "#262626",
  muted: "#737373",
  button: "#171717",
  buttonText: "#fafafa",
};

const darkMode = `
:root { color-scheme: light dark; supported-color-schemes: light dark; }
@media (prefers-color-scheme: dark) {
  .email-page { background-color: #0a0a0a !important; }
  .email-card { background-color: #171717 !important; border-color: #262626 !important; }
  .email-heading, .email-wordmark { color: #fafafa !important; }
  .email-text { color: #e5e5e5 !important; }
  .email-muted { color: #a3a3a3 !important; }
  .email-button { background-color: #fafafa !important; color: #0a0a0a !important; }
  .email-link { color: #fafafa !important; }
  .email-rule { border-color: #262626 !important; }
  .email-quote { border-color: #525252 !important; }
}
`;

// Fills the inbox preview after the real preview text, so it doesn't run on
// into the start of the email.
const previewFiller = " ‌".repeat(90);

const footer: CSSProperties = { margin: 0, color: colors.muted, fontSize: 13, lineHeight: "18px" };

type Presentation = { children: ReactNode; style?: CSSProperties; className?: string };

/** A full-width table with one cell: the email-safe way to center and pad. */
function Box({ children, style, className }: Presentation) {
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      border={0}
      style={style}
      className={className}
    >
      <tbody>
        <tr>
          <td>{children}</td>
        </tr>
      </tbody>
    </table>
  );
}

export function EmailLayout({
  preview,
  reason,
  children,
}: {
  /** The line inboxes show after the subject. It isn't in the email itself. */
  preview: string;
  /** Why this person got the email, in the footer. */
  reason: string;
  children?: ReactNode;
}) {
  return (
    <html lang="en" dir="ltr">
      {/* An email document, not a Next page, so next/head doesn't apply. */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <meta name="x-apple-disable-message-reformatting" />
        <style>{darkMode}</style>
      </head>
      <body className="email-page" style={{ margin: 0, padding: 0, backgroundColor: colors.page, fontFamily: font }}>
        <div
          data-skip-in-text="true"
          style={{ display: "none", overflow: "hidden", lineHeight: "1px", maxHeight: 0, maxWidth: 0, opacity: 0 }}
        >
          {preview}
          {previewFiller}
        </div>
        <Box className="email-page" style={{ backgroundColor: colors.page }}>
          <table
            role="presentation"
            align="center"
            width="100%"
            cellPadding={0}
            cellSpacing={0}
            border={0}
            style={{ maxWidth: 560, margin: "0 auto" }}
          >
            <tbody>
              <tr>
                <td style={{ padding: "32px 16px 16px" }}>
                  <p
                    className="email-wordmark"
                    style={{
                      margin: 0,
                      color: colors.heading,
                      fontSize: 15,
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                      lineHeight: "20px",
                    }}
                  >
                    SBC South Youth
                  </p>
                </td>
              </tr>
              <tr>
                <td style={{ padding: "0 16px" }}>
                  <Box
                    className="email-card"
                    style={{
                      backgroundColor: colors.card,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 12,
                    }}
                  >
                    <div style={{ padding: "28px 24px 12px" }}>{children}</div>
                  </Box>
                </td>
              </tr>
              <tr>
                <td style={{ padding: "20px 16px 40px" }}>
                  <p className="email-muted" style={{ ...footer, margin: "0 0 8px" }}>
                    {reason}
                  </p>
                  <p className="email-muted" style={footer}>
                    SBC South Youth · sbcsouthyouth.com
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </Box>
      </body>
    </html>
  );
}

export function EmailHeading({ children }: { children?: ReactNode }) {
  return (
    <h1
      className="email-heading"
      style={{
        margin: "0 0 16px",
        color: colors.heading,
        fontSize: 22,
        fontWeight: 600,
        letterSpacing: "-0.01em",
        lineHeight: "28px",
      }}
    >
      {children}
    </h1>
  );
}

/** Starts one item in a list of several, like each message in a digest, with a rule above it. */
export function EmailSubheading({ children }: { children?: ReactNode }) {
  return (
    <h2
      className="email-heading email-rule"
      style={{
        margin: "24px 0 12px",
        paddingTop: 20,
        borderTop: `1px solid ${colors.border}`,
        color: colors.heading,
        fontSize: 18,
        fontWeight: 600,
        lineHeight: "24px",
      }}
    >
      {children}
    </h2>
  );
}

export function EmailText({ children }: { children?: ReactNode }) {
  return (
    <p className="email-text" style={{ margin: "0 0 16px", color: colors.text, fontSize: 16, lineHeight: "24px" }}>
      {children}
    </p>
  );
}

/** The one thing to do. A link styled as a button, since email can't run forms. */
export function EmailButton({ href, children }: { href: string; children?: ReactNode }) {
  return (
    <p style={{ margin: "24px 0" }}>
      <a
        href={href}
        className="email-button"
        style={{
          display: "inline-block",
          backgroundColor: colors.button,
          color: colors.buttonText,
          borderRadius: 8,
          fontSize: 16,
          fontWeight: 600,
          lineHeight: "20px",
          padding: "12px 20px",
          textDecoration: "none",
        }}
      >
        {children}
      </a>
    </p>
  );
}

/** A plain link on its own line, for when the email has more than one place to go. */
export function EmailLink({ href, children }: { href: string; children?: ReactNode }) {
  return (
    <p style={{ margin: "0 0 16px", fontSize: 16, lineHeight: "24px" }}>
      <a
        href={href}
        className="email-link"
        style={{ color: colors.heading, fontWeight: 600, textDecoration: "underline" }}
      >
        {children}
      </a>
    </p>
  );
}

/** A few labels and values, like a request's amount and store, one per row. */
export function EmailFacts({ facts }: { facts: readonly (readonly [label: string, value: ReactNode])[] }) {
  const cell: CSSProperties = { borderBottom: `1px solid ${colors.border}`, verticalAlign: "top" };
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      border={0}
      className="email-rule"
      style={{ margin: "0 0 20px", borderTop: `1px solid ${colors.border}` }}
      // Plain text lines the labels and values up in two columns.
      data-text-format="dataTable"
    >
      <tbody>
        {facts.map(([label, value]) => (
          <tr key={label}>
            <td
              className="email-muted email-rule"
              style={{
                ...cell,
                width: 88,
                padding: "10px 12px 10px 0",
                color: colors.muted,
                fontSize: 14,
                lineHeight: "22px",
              }}
            >
              {label}
            </td>
            <td
              className="email-text email-rule"
              style={{ ...cell, padding: "10px 0", color: colors.text, fontSize: 16, lineHeight: "22px" }}
            >
              {value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Someone's own words, like an owner's question, set apart from ours. Line breaks stay. */
export function EmailQuote({ children }: { children: string }) {
  const lines = children.split(/\r?\n/);
  return (
    <blockquote
      className="email-text email-quote"
      style={{
        margin: "0 0 16px",
        padding: "2px 0 2px 14px",
        borderLeft: `3px solid ${colors.quote}`,
        color: colors.text,
        fontSize: 16,
        lineHeight: "24px",
      }}
    >
      {lines.map((line, index) => (
        <span key={index}>
          {index > 0 && <br />}
          {line}
        </span>
      ))}
    </blockquote>
  );
}

/** Small print inside the card, like how long a link lasts. */
export function EmailNote({ children }: { children?: ReactNode }) {
  return (
    <p className="email-muted" style={{ margin: "0 0 16px", color: colors.muted, fontSize: 14, lineHeight: "20px" }}>
      {children}
    </p>
  );
}
