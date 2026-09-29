"use client";

import { Check, Share } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/button";
import { copyText } from "@/lib/clipboard";

type Status = "idle" | "copied" | "failed";

/**
 * Opens the share sheet on phones and anywhere else that has one.
 * Elsewhere it copies the link and says so for a couple of seconds.
 */
export function ShareButton({
  title,
  path,
  variant = "secondary",
  size,
  className,
}: {
  title: string;
  /** The page to share, like "/events/beach-day". */
  path: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function share() {
    const data = { title, url: new URL(path, window.location.origin).toString() };
    if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
      try {
        await navigator.share(data);
        return;
      } catch (error) {
        // Closing the sheet isn't a failure. Anything else falls back to copying.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    setStatus((await copyText(data.url)) ? "copied" : "failed");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus("idle"), 2400);
  }

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={share}>
        {status === "copied" ? <Check aria-hidden /> : <Share aria-hidden />}
        {status === "copied" ? "Link copied" : status === "failed" ? "Couldn't copy" : "Share"}
      </Button>
      <span aria-live="polite" className="sr-only">
        {status === "copied" ? "Link copied" : status === "failed" ? "Couldn't copy the link. Copy it from the address bar." : ""}
      </span>
    </>
  );
}
