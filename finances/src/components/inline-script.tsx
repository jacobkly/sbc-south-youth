/**
 * A script that runs from the server's HTML, as the browser reads it, before
 * the page first paints. On the client it's inert text, so React doesn't warn
 * about rendering a script.
 */
export function InlineScript({ code }: { code: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: code }}
    />
  );
}
