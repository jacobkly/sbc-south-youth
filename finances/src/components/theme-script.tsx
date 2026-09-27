"use client";

import { useLayoutEffect } from "react";
import { applyTheme, THEME_CONFIG, THEME_KEY, THEME_SCRIPT } from "@/lib/theme";

/**
 * Goes in `<head>`. Its script puts the saved theme on `<html>` before the
 * first paint. After that it keeps the theme applied: when the phone switches
 * between light and dark (for System), when another tab changes it, and after
 * React's development remount clears `<html>`'s classes.
 */
export function ThemeScript() {
  useLayoutEffect(() => {
    const reapply = () => applyTheme(THEME_CONFIG);
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_KEY || event.key === null) reapply();
    };
    const media = matchMedia("(prefers-color-scheme: dark)");

    reapply();
    media.addEventListener("change", reapply);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", reapply);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    // It only needs to run from the server's HTML. On the client it's inert
    // text, so React doesn't warn about rendering a script.
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
    />
  );
}
