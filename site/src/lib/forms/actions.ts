"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { drainEmails } from "@/lib/email/drain";
import { readFormEnv } from "@/lib/env";
import { reportError } from "@/lib/errors/report";
import { saveMessage } from "@/lib/supabase/admin";
import type { MessageKind } from "./schemas";
import { handleMessage, type SubmitResult } from "./submit";
import { verifyTurnstile } from "./turnstile";

/** The sender's address. Vercel sets x-real-ip itself, so a sender can't pick their own. */
async function senderAddress(): Promise<string | null> {
  const sent = await headers();
  const forwarded = sent.get("x-forwarded-for")?.split(",")[0]?.trim();
  return sent.get("x-real-ip")?.trim() || forwarded || null;
}

/**
 * Sends a message from one of the forms. The database pokes the email
 * drain when it queues the alert, but that poke only reaches production,
 * so the alert also goes from here once the person has their answer. Each
 * email is claimed once, so the two never send it twice.
 */
export async function submitMessage(kind: MessageKind, data: FormData): Promise<SubmitResult> {
  return handleMessage(kind, data, {
    env: () => readFormEnv(),
    ip: await senderAddress(),
    verify: (token, ip, secret) => verifyTurnstile(token, { secret, ip }),
    save: saveMessage,
    sendAlerts: () =>
      after(async () => {
        try {
          await drainEmails();
        } catch (error) {
          reportError("Form alert", error);
        }
      }),
    report: reportError,
  });
}
