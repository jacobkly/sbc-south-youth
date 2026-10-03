import Link from "next/link";
import { TriangleAlertIcon } from "lucide-react";
import { formatDayLabel, laDateOf, type IsoDate } from "@/lib/dates";
import type { TakenDownPhoto } from "@/lib/portal/photos/queries";
import { DeleteFilesButton } from "./remove-photo";

/**
 * Photos that came down, newest first: when, who, and why. One whose files
 * didn't delete says so, with a button to try again.
 */
export function TakenDown({
  photos,
  filesLeft,
  names,
  today,
  showRequests,
  readOnly,
}: {
  photos: TakenDownPhoto[];
  filesLeft: ReadonlySet<string>;
  names: Record<string, string>;
  today: IsoDate;
  /** Whether they can open takedown requests, in Messages. */
  showRequests: boolean;
  readOnly: boolean;
}) {
  if (photos.length === 0) return null;

  return (
    <section aria-labelledby="taken-down-heading" className="space-y-3">
      <div className="space-y-1">
        <h2 id="taken-down-heading" className="text-lg font-semibold">
          Taken down
        </h2>
        <p className="text-sm text-muted-foreground">Kept for 2 years without the photo, so there&apos;s a record.</p>
      </div>

      <ul className="divide-y rounded-xl border">
        {photos.map((photo) => {
          const by = photo.removedBy ? names[photo.removedBy] : undefined;
          const when = formatDayLabel(laDateOf(photo.removedAt), today);
          return (
            <li key={photo.id} className="space-y-2 p-4">
              <p className="line-clamp-2 text-sm font-medium">{photo.alt}</p>
              <p className="text-sm text-muted-foreground">
                {[when, by, photo.reason].filter(Boolean).join(" · ")}
              </p>
              {showRequests && photo.messageId && (
                <Link
                  href={`/messages/${photo.messageId}`}
                  className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
                >
                  See the takedown request
                </Link>
              )}
              {filesLeft.has(photo.id) && (
                <div className="space-y-2 rounded-lg bg-destructive/10 p-3">
                  <p className="flex items-start gap-2 text-sm text-destructive">
                    <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                    Its files are still stored, so it can still be opened by its link.
                  </p>
                  <DeleteFilesButton id={photo.id} readOnly={readOnly} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
