import type { ReactNode } from "react";
import { cn } from "cn";
import { BackLink } from "@/components/nav/back-link";
import { Skeleton } from "@/components/ui/skeleton";

/*
 * Pieces for the loading screens. Every page has one: a link loads a page
 * ahead of the tap only when the part of the page the tap changes has a
 * loading screen, and without one a tap seems to do nothing until the whole
 * page arrives.
 */

/** Grey blocks where a page's content will go, announced as loading. */
export function Busy({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("space-y-4", className)} aria-busy="true" aria-label={label}>
      {children}
    </div>
  );
}

/** A form's fields: a label over each box. */
export function FieldsSkeleton({ count }: { count: number }) {
  return Array.from({ length: count }, (_, index) => (
    <div key={index} className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-11 w-full" />
    </div>
  ));
}

/** A request's page: its number, amount, and payee, then its details beside the receipts and history on a PC. */
export function RequestDetailSkeleton({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <div className="space-y-2">
      <BackLink fallbackHref={backHref} fallbackLabel={backLabel} />
      <Busy label="Loading the request" className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-6 w-44" />
        </div>
        <div className="flex flex-col gap-6 @4xl/main:grid @4xl/main:grid-cols-2 @4xl/main:items-start">
          <Skeleton className="h-56" />
          <Skeleton className="h-72" />
        </div>
      </Busy>
    </div>
  );
}

/** Editing a request: its title has its number, so it waits too. */
export function EditRequestSkeleton() {
  return (
    <Busy label="Loading the request" className="space-y-5">
      <Skeleton className="h-8 w-48" />
      <FieldsSkeleton count={5} />
    </Busy>
  );
}
