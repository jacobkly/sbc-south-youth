import Link from "next/link";
import { ArrowRightIcon, MailWarningIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/portal/ui/button";
import { loadEmailOverview } from "@/lib/portal/email/queries";
import { emailAlert, type EmailAlert as Alert } from "@/lib/portal/email/summary";

const TONES: Record<Alert["level"], { card: string; box: string; icon: string }> = {
  warning: {
    card: "border-amber-500/60",
    box: "bg-amber-500/15",
    icon: "text-amber-700 dark:text-amber-300",
  },
  critical: {
    card: "border-red-600/60 dark:border-red-500/60",
    box: "bg-red-600/10 dark:bg-red-500/15",
    icon: "text-red-700 dark:text-red-300",
  },
};

/** A card on an owner's Home once either email limit passes 80%, linking to the Email screen. */
export function EmailAlert({ alert }: { alert: Alert }) {
  const tone = TONES[alert.level];
  return (
    <section
      aria-labelledby="email-alert-heading"
      className={cn("flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center", tone.card)}
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", tone.box)} aria-hidden>
        <MailWarningIcon className={cn("size-5", tone.icon)} />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <h2 id="email-alert-heading" className="font-semibold">
          {alert.title}
        </h2>
        <p className="text-sm text-muted-foreground">{alert.text}</p>
      </div>
      <Button asChild variant="outline" className="h-11 px-5">
        <Link href="/email">
          Open Email
          <ArrowRightIcon aria-hidden />
        </Link>
      </Button>
    </section>
  );
}

/** Nothing below 80%, or when the counts don't load, since the Email screen shows that error. */
export async function HomeEmailAlert() {
  let alert: Alert | null;
  try {
    alert = emailAlert(await loadEmailOverview());
  } catch (error) {
    console.error("[portal] Couldn't load the email summary for Home", error);
    return null;
  }
  return alert ? <EmailAlert alert={alert} /> : null;
}
