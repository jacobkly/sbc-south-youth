"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheckIcon } from "lucide-react";
import { actionCopy, ActionSheet, type ActionRequest, type OpenedAction } from "@/components/requests/action-dialogs";
import { Button } from "@/components/ui/button";
import { todayInLA } from "@/lib/dates";
import { availableActions, requesterActions, type RequestAction } from "@/lib/requests/actions";
import type { RequestStatus } from "@/lib/requests/format";
import { cn } from "@/lib/utils";

/** The usual next step for each status, shown first and full width. */
const PRIMARY: Partial<Record<RequestStatus, RequestAction>> = {
  draft: "submit",
  submitted: "approve",
  needs_info: "submit",
  approved: "mark_paid",
};

/**
 * The status changes open to the signed-in person, as a grid of buttons.
 * Each opens a sheet to confirm it, and the page reloads once it's done so
 * the status and history catch up.
 */
export function RequestActions({
  request,
  selfPayee,
  enteredBySelf,
  allowExternalApproval,
  requester = false,
}: {
  request: ActionRequest;
  /** The payee is linked to the signed-in person. */
  selfPayee: boolean;
  /** The signed-in person entered the request. */
  enteredBySelf: boolean;
  allowExternalApproval: boolean;
  /** Their own request, opened from My requests: they can only send it or take it back. */
  requester?: boolean;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [opened, setOpened] = useState<OpenedAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Counts openings, so each one starts with blank fields.
  const [opens, setOpens] = useState(0);

  const { status } = request;
  const actions = requester
    ? requesterActions(status)
    : availableActions({ status, selfPayee, enteredBySelf, allowExternalApproval });
  const primary = actions.find((action) => action === PRIMARY[status]);
  const others = actions.filter((action) => action !== primary);
  const selfApprovalBlocked =
    !requester && selfPayee && !allowExternalApproval && (status === "draft" || status === "submitted");

  function open(action: RequestAction) {
    setMessage(null);
    setOpens(opens + 1);
    // Taken when it opens, so a page left open overnight still allows today's date.
    setOpened({ action, today: todayInLA(), key: opens + 1 });
  }

  function reload() {
    startRefresh(() => router.refresh());
  }

  function button(action: RequestAction, wide: boolean) {
    const copy = actionCopy(action, status);
    return (
      <Button
        key={action}
        type="button"
        variant={action === primary ? "default" : copy.destructive ? "destructive" : "outline"}
        className={cn("h-11", wide && "col-span-2")}
        disabled={refreshing}
        onClick={() => open(action)}
      >
        {copy.label}
      </Button>
    );
  }

  return (
    <>
      {actions.length > 0 && (
        <section aria-labelledby="actions-heading" className="space-y-3">
          <h2 id="actions-heading" className="sr-only">
            Actions
          </h2>
          <div className="grid grid-cols-2 gap-3" aria-busy={refreshing || undefined}>
            {primary && button(primary, true)}
            {/* An odd one out fills the last row. */}
            {others.map((action, index) => button(action, others.length % 2 === 1 && index === others.length - 1))}
          </div>
          {selfApprovalBlocked && (
            <p className="text-sm text-muted-foreground">This is paid to you, so another admin has to approve it.</p>
          )}
        </section>
      )}

      {/* Always rendered, so screen readers announce the result when it appears. */}
      <p
        role="status"
        className={message ? "flex items-center gap-2 text-sm" : "sr-only"}
      >
        {message && <CircleCheckIcon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />}
        {message}
      </p>

      <ActionSheet
        opened={opened}
        request={request}
        selfPayee={selfPayee}
        allowExternalApproval={allowExternalApproval}
        requester={requester}
        onClose={() => setOpened(null)}
        onDone={(done) => {
          setOpened(null);
          setMessage(done);
          reload();
        }}
        onStale={reload}
      />
    </>
  );
}
