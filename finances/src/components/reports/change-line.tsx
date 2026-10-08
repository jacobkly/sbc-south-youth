import { TrendIcon } from "@/components/dashboard/stat-cards";
import { changeSentence, compareAmounts, formatChange } from "@/lib/reports/comparison";

/** How an amount changed from the period before, with an arrow and, for screen readers, in words. */
export function ChangeLine({ current, before, label }: { current: number; before: number; label: string }) {
  const change = compareAmounts(current, before);
  const { amount, percent } = formatChange(change);
  return (
    <span className="flex flex-wrap items-center justify-end gap-x-1 text-sm text-muted-foreground @md:justify-start">
      <span aria-hidden className="flex items-center gap-1 whitespace-nowrap">
        <TrendIcon direction={change.direction} />
        {amount}
      </span>
      {percent && (
        <span aria-hidden className="whitespace-nowrap">
          {percent}
        </span>
      )}
      <span className="sr-only">{changeSentence(current, before, label)}</span>
    </span>
  );
}
