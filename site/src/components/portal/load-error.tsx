import { CircleAlertIcon } from "lucide-react";
import { RetryButton } from "./retry-button";

/** In place of a section that couldn't load, so the rest of the screen still shows. */
export function LoadError({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm">
      <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
        <p className="text-muted-foreground">{text}</p>
        <RetryButton />
      </div>
    </div>
  );
}
