import { drainEmails, handleDrainRequest } from "@/lib/email/drain";
import { readEmailEnv } from "@/lib/env";

/** A full outbox takes about 20 seconds, plus the batch that was sending when time ran out. */
export const maxDuration = 60;

/**
 * The database's poke, at portal.sbcsouthyouth.com/api/email/drain, when it
 * queues an email. The shared secret is the only check: the database never
 * has a sign-in. The morning digest pokes with `?digest=1`, which drains too.
 */
export async function POST(request: Request) {
  return handleDrainRequest(request, { secret: readEmailEnv().drainSecret, drain: () => drainEmails() });
}
