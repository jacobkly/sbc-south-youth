"use client";

import { useEffect } from "react";
import { InlineScript } from "@/components/inline-script";
import { fetchAccountTheme, saveAccountTheme } from "@/lib/portal/account-theme";
import { createClient } from "@/lib/supabase/client";
import { accountThemeScript, readSavedTheme, reconcileTheme, saveTheme, type Theme } from "@/lib/portal/theme";

/** The user whose saved theme this page load has already checked. */
let checkedFor: string | null = null;

/**
 * Keeps this device on the theme saved to the account. On a full page load
 * the server's HTML applies it before the first paint. Signing in doesn't
 * reload the page, so it also applies once from here. A device that picked a
 * theme before the account had one saves it there. When the app comes back
 * into view, it picks up a theme changed on another device.
 */
export function AccountTheme({
  userId,
  theme,
  readOnly = false,
}: {
  userId: string;
  theme: Theme | null;
  /** On staging: apply the account's theme, but never save one to it. */
  readOnly?: boolean;
}) {
  useEffect(() => {
    if (checkedFor === userId) return;
    checkedFor = userId;
    const next = reconcileTheme(theme, readSavedTheme());
    if (next && "apply" in next) {
      saveTheme(next.apply);
    } else if (next && !readOnly) {
      saveAccountTheme(createClient(), userId, next.upload).catch(() => {
        // It tries again on the next page load.
      });
    }
  }, [userId, theme, readOnly]);

  useEffect(() => {
    const onShow = async () => {
      if (document.visibilityState !== "visible") return;
      const account = await fetchAccountTheme(createClient(), userId);
      if (account && account !== readSavedTheme()) saveTheme(account);
    };
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [userId]);

  return theme ? <InlineScript html={accountThemeScript(theme)} /> : null;
}
