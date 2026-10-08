"use client";

import { useState, useSyncExternalStore } from "react";
import { cn } from "cn";
import { Label } from "@/components/portal/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/portal/ui/radio-group";
import { saveAccountTheme } from "@/lib/portal/account-theme";
import { createClient } from "@/lib/supabase/client";
import { parseTheme, readTheme, saveTheme, THEME_EVENT, THEME_LABELS, THEMES, type Appearance, type Theme } from "@/lib/portal/theme";

const ID = "settings-theme";

/** The classes that give a preview its theme's colors, whatever the page's theme is. */
const SCOPES: Record<Appearance, string> = { light: "light", grey: "dark grey", dark: "dark" };

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(THEME_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(THEME_EVENT, onChange);
  };
}

/** A tiny page in one theme's colors: a heading, a card, and a button. */
function Preview({ look, className }: { look: Appearance; className?: string }) {
  return (
    <span className={cn(SCOPES[look], "absolute inset-0 flex flex-col gap-1.5 bg-background p-2.5", className)}>
      <span className="h-1.5 w-2/5 rounded-full bg-foreground/80" />
      <span className="flex flex-1 flex-col justify-center gap-1.5 rounded-md border bg-card px-2">
        <span className="h-1 w-3/4 rounded-full bg-foreground/70" />
        <span className="h-1 w-1/2 rounded-full bg-muted-foreground/70" />
      </span>
      <span className="h-2.5 w-1/3 rounded-full bg-primary" />
    </span>
  );
}

function ThemePreview({ theme }: { theme: Theme }) {
  return (
    <span aria-hidden className="relative block aspect-video overflow-hidden rounded-md ring-1 ring-foreground/10">
      {theme === "system" ? (
        <>
          <Preview look="light" />
          {/* Dark fills the lower right half. */}
          <Preview look="dark" className="[clip-path:polygon(100%_0,100%_100%,0_100%)]" />
        </>
      ) : (
        <Preview look={theme} />
      )}
    </span>
  );
}

/**
 * Light, Grey, Dark, or System. It applies right away and is saved on this
 * device, then on the account so other devices and finances get it too.
 * Without a userId, as on staging, it stays on this device.
 */
export function ThemePicker({ userId, className }: { userId: string | null; className?: string }) {
  // Unknown until the page is in the browser, so nothing's picked while it loads.
  const theme = useSyncExternalStore(subscribe, readTheme, () => null);
  const [notSaved, setNotSaved] = useState(false);

  function pick(value: string) {
    const next = parseTheme(value);
    saveTheme(next);
    if (!userId) return;
    // Saves finish in order, so the last one to finish is the latest pick.
    saveAccountTheme(createClient(), userId, next).then(
      () => setNotSaved(false),
      () => setNotSaved(true),
    );
  }

  return (
    <section aria-labelledby={`${ID}-heading`} className={cn("space-y-3", className)}>
      <h2 id={`${ID}-heading`} className="text-lg font-semibold">
        Appearance
      </h2>
      <RadioGroup
        value={theme ?? ""}
        onValueChange={pick}
        aria-labelledby={`${ID}-heading`}
        aria-describedby={`${ID}-hint`}
        className="grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {THEMES.map((option) => (
          <Label
            key={option}
            htmlFor={`${ID}-${option}`}
            className="cursor-pointer flex-col items-stretch gap-2.5 rounded-xl border p-2 pb-3 font-normal transition-colors hover:bg-muted/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:ring-1 has-[[data-state=checked]]:ring-primary"
          >
            <ThemePreview theme={option} />
            <span className="flex items-center gap-2 px-1 text-base desktop:text-sm">
              <RadioGroupItem id={`${ID}-${option}`} value={option} />
              {THEME_LABELS[option]}
            </span>
          </Label>
        ))}
      </RadioGroup>
      <p id={`${ID}-hint`} className="text-sm text-muted-foreground">
        {userId
          ? "Saved to your account, so it's the same on every device and in finances."
          : "Saved on this device only."}{" "}
        System matches each device&apos;s light or dark mode.
      </p>
      {notSaved && (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t save it to your account, so only this device has it. Check your connection and pick it again.
        </p>
      )}
    </section>
  );
}
