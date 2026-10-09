"use client";

import { MfaChallengeForm } from "@/components/auth/mfa-challenge-form";
import type { MfaDevice } from "@/lib/auth/mfa";

/** The code step after the password: a code from one of the person's devices. */
export function MfaStep({ devices, next }: { devices: MfaDevice[]; next: string }) {
  // A full page load, so the server reads the upgraded session from the start.
  const done = () => window.location.replace(next);

  return (
    <div className="mt-8">
      <MfaChallengeForm devices={devices} onVerified={done} />
    </div>
  );
}
