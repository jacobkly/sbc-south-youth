"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/button";

type Status = "idle" | "copied" | "failed";

/** The old way to copy, for browsers that block the clipboard API. */
function legacyCopy(text: string): boolean {
  const focused = document.activeElement;
  const field = document.createElement("textarea");
  field.value = text;
  field.readOnly = true;
  // Pinned in view, so selecting it doesn't scroll the page.
  field.style.cssText = "position:fixed;top:0;left:0;opacity:0";
  document.body.append(field);
  field.select();
  field.setSelectionRange(0, text.length);
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
    // Selecting the field moved focus off the button, so put it back.
    if (focused instanceof HTMLElement) focused.focus({ preventScroll: true });
  }
}

/** Copies text to the clipboard, then says so for a couple of seconds. */
export function CopyButton({
  text,
  label,
  variant = "secondary",
  size,
  className,
}: {
  text: string;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    let next: Status = "copied";
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      if (!legacyCopy(text)) next = "failed";
    }
    setStatus(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus("idle"), 2400);
  }

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={copy}>
        {status === "copied" ? <Check aria-hidden /> : <Copy aria-hidden />}
        {status === "copied" ? "Copied" : status === "failed" ? "Couldn't copy" : label}
      </Button>
      <span aria-live="polite" className="sr-only">
        {status === "copied" ? `Copied ${text}` : status === "failed" ? `Couldn't copy. Select ${text} to copy it.` : ""}
      </span>
    </>
  );
}
