import { LoadError } from "@/components/portal/load-error";
import { formatDayLabel, laDateOf } from "@/lib/dates";
import { readPortalEnv } from "@/lib/env";
import { loadSuppressions, type Suppression } from "@/lib/portal/email/queries";
import { reportPortalError } from "@/lib/portal/errors";
import { BlockedAddresses } from "./blocked-addresses";

/** Loads the blocked addresses as the owner. A failure only hides this section. */
export async function BlockedSection() {
  let suppressions: Suppression[];
  try {
    suppressions = await loadSuppressions();
  } catch (error) {
    await reportPortalError("Blocked addresses", error);
    return <LoadError text="Blocked addresses couldn't load." />;
  }

  const dates = Object.fromEntries(suppressions.map(({ id, createdAt }) => [id, formatDayLabel(laDateOf(createdAt))]));
  // Staging shares production's data, so it unblocks nothing.
  const readOnly = readPortalEnv().appEnv === "staging";
  return <BlockedAddresses suppressions={suppressions} dates={dates} readOnly={readOnly} />;
}
