"use client";

import { Navigation } from "lucide-react";
import type { MouseEvent } from "react";
import { buttonClasses } from "@/components/button";
import type { ButtonSize, ButtonVariant } from "@/components/button";
import { directionsUrl, isAppleMobile } from "@/lib/directions";

/**
 * Opens directions to an address: Apple Maps on an iPhone or iPad, Google
 * Maps everywhere else. The link works without JS; the tap swaps in Apple
 * Maps just before it opens, so the server and browser render the same.
 */
export function DirectionsButton({
  address,
  variant = "primary",
  size = "md",
  className = "",
}: {
  address: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (isAppleMobile(navigator)) event.currentTarget.href = directionsUrl(address, "apple");
  }

  return (
    <a href={directionsUrl(address, "google")} onClick={handleClick} className={buttonClasses({ variant, size, className })}>
      <Navigation aria-hidden />
      Directions
    </a>
  );
}
