"use client";

import { MfaChallengeForm } from "@/components/auth/mfa-challenge-form";
import { MfaSetup } from "@/components/account/mfa-setup";
import type { MfaDevice } from "@/lib/auth/mfa";

/**
 * The code step after the password: a code from one of the person's devices,
 * or, for an owner with none yet, setting one up. Either way it ends with a
 * session that has entered a code.
 */
export function MfaStep({ devices, next }: { devices: MfaDevice[]; next: string }) {
  // A full page load, so the server reads the upgraded session from the start.
  const done = () => window.location.replace(next);

  return (
    <div className="mt-8">
      {devices.length > 0 ? (
        <MfaChallengeForm devices={devices} onVerified={done} />
      ) : (
        <MfaSetup existingNames={[]} submitLabel="Turn on and continue" onDone={done} />
      )}
    </div>
  );
}
