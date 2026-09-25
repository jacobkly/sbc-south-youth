import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { REQUEST_STATUS_LABELS, type RequestStatus } from "@/lib/requests/format";

// Soft tints, so each status is easy to spot in a list without shouting.
const STATUS_STYLES: Record<RequestStatus, string> = {
  draft: "border-border bg-transparent text-muted-foreground",
  submitted: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  needs_info: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  approved: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  paid: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  rejected: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  cancelled: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  return <Badge className={cn(STATUS_STYLES[status], className)}>{REQUEST_STATUS_LABELS[status]}</Badge>;
}
