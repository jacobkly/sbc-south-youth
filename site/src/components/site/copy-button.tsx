"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/button";
import { copyText } from "@/lib/clipboard";

type Status = "idle" | "copied" | "failed";

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
    setStatus((await copyText(text)) ? "copied" : "failed");
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
