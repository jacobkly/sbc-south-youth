import "server-only";
import { createHmac } from "node:crypto";
import { failures } from "@/content/forms";
import type { FormEnv } from "@/lib/env";
import type { MessageSave, MessageSaved } from "@/lib/supabase/admin";
import { looksAutomated, TURNSTILE_FIELD } from "./guard";
import { checkMessage, type FieldErrors, messageKinds, type MessageKind, readMessageInput } from "./schemas";

/**
 * What happens when someone sends a message form. Nothing here talks to
 * the network, so it's tested with fakes, and actions.ts wires in the real
 * Turnstile, database, and email drain.
 */

export type SubmitResult =
  | { status: "invalid"; errors: FieldErrors }
  | { status: "sent"; firstName: string }
  | { status: "failed"; message: string };

export type SaveInput = MessageSave;

const NOT_SET_UP = "Set TURNSTILE_SECRET_KEY and FORM_IP_SALT before the forms can save messages.";

/** Everything handleMessage() talks to, so tests can swap in fakes. */
export type SubmitDeps = {
  /** Read on each send, so a missing setting stops only the forms. */
  env: () => FormEnv;
  /** The sender's address, as the host saw it. */
  ip: string | null;
  verify: (token: string | null, ip: string | null, secret: string) => Promise<boolean>;
  save: (input: SaveInput) => Promise<MessageSaved>;
  /** Sends the alert the save just queued, once the person has their answer. */
  sendAlerts: () => void;
  /** Puts an error on the owners' error log, so a message that didn't save never goes unnoticed. */
  report: (source: string, error: unknown) => void;
};

/**
 * Keys the sender's address into a hash, so the hourly limit can count
 * their messages without the address ever being stored. An unknown
 * address shares one count, which only ever limits sooner.
 */
function hashAddress(ip: string | null, salt: string): string {
  return createHmac("sha256", salt)
    .update(ip ?? "unknown")
    .digest("hex");
}

/**
 * Checks and saves a message. Anyone can send anything here, so it checks
 * everything again instead of trusting the page. A bot caught by the
 * honeypot or the timing gets the same "sent" a person does, so it can't
 * tell it was caught. A person Turnstile turns away, or who hits a setup
 * problem, is told it didn't send and how else to reach us.
 */
export async function handleMessage(kind: MessageKind, data: FormData, deps: SubmitDeps): Promise<SubmitResult> {
  if (!messageKinds.includes(kind)) return { status: "failed", message: "That form doesn't exist." };

  const result = checkMessage(kind, readMessageInput(data));
  if (!result.ok) return { status: "invalid", errors: result.errors };

  const { kind: form, reason, ...payload } = result.message;
  const firstName = payload.name.split(/\s+/)[0];
  if (looksAutomated(data)) return { status: "sent", firstName };

  let env: FormEnv;
  try {
    env = deps.env();
  } catch (error) {
    deps.report("Message forms", error);
    return { status: "failed", message: failures.notSetUp };
  }
  const { turnstileSecret, ipSalt } = env;
  if (!turnstileSecret || !ipSalt) {
    deps.report("Message forms", new Error(NOT_SET_UP));
    return { status: "failed", message: failures.notSetUp };
  }

  const token = data.get(TURNSTILE_FIELD);
  if (!(await deps.verify(typeof token === "string" ? token : null, deps.ip, turnstileSecret))) {
    return { status: "failed", message: failures.notChecked };
  }

  let saved: MessageSaved;
  try {
    saved = await deps.save({
      // A takedown request comes through the Contact form, and is filed as one.
      kind: reason ?? form,
      payload,
      ipHash: hashAddress(deps.ip, ipSalt),
      env: env.appEnv,
      alertTo: env.alertTo,
    });
  } catch (error) {
    deps.report(`${kind[0].toUpperCase()}${kind.slice(1)} form`, error);
    return { status: "failed", message: failures.notSaved };
  }
  if (saved.status === "limited") return { status: "failed", message: saved.message };

  if (env.alertTo) deps.sendAlerts();
  return { status: "sent", firstName };
}
