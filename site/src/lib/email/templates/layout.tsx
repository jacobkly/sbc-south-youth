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

/** Small print inside the card, like how long a link lasts. */
export function EmailNote({ children }: { children?: ReactNode }) {
  return (
    <p className="email-muted" style={{ margin: "0 0 16px", color: colors.muted, fontSize: 14, lineHeight: "20px" }}>
      {children}
    </p>
  );
}
