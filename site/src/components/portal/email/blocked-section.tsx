import { formatDayLabel, laDateOf } from "@/lib/dates";
import { readPortalEnv } from "@/lib/env";
import { loadSuppressions, type Suppression } from "@/lib/portal/email/queries";
import { BlockedAddresses } from "./blocked-addresses";
import { SectionError } from "./email-usage";

/** Loads the blocked addresses as the owner. A failure only hides this section. */
export async function BlockedSection() {
  let suppressions: Suppression[];
  try {
    suppressions = await loadSuppressions();
  } catch (error) {
    console.error("[portal] Couldn't load blocked addresses", error);
    return <SectionError text="Blocked addresses couldn't load. Refresh the page to try again." />;
  }

  const dates = Object.fromEntries(suppressions.map(({ id, createdAt }) => [id, formatDayLabel(laDateOf(createdAt))]));
  // Staging shares production's data, so it unblocks nothing.
  const readOnly = readPortalEnv().appEnv === "staging";
  return <BlockedAddresses suppressions={suppressions} dates={dates} readOnly={readOnly} />;
}
