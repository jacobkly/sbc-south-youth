import { handleResendWebhook } from "@/lib/email/webhook";
import { readEmailEnv } from "@/lib/env";
import { emailRecordWebhook } from "@/lib/supabase/admin";

/**
 * Resend's delivery events, at portal.sbcsouthyouth.com/api/webhooks/resend.
 * The signature is the only check: Resend never has a sign-in.
 */
export async function POST(request: Request) {
  return handleResendWebhook(request, { secret: readEmailEnv().webhookSecret, record: emailRecordWebhook });
}
