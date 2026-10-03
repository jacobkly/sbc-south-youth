import { emptySpots } from "@/lib/portal/photos/placement";
import type { LibraryPhoto } from "@/lib/portal/photos/queries";

/**
 * The spots on the site still waiting for a photo, by page, so editors
 * can fill every one before launch. Gone once they're all filled.
 */
export function EmptySpots({ photos }: { photos: LibraryPhoto[] }) {
  const pages = emptySpots(photos);
  if (pages.length === 0) return null;
  const count = pages.reduce((total, [, labels]) => total + labels.length, 0);

  return (
    <section aria-labelledby="empty-spots-heading" className="space-y-3">
      <div className="space-y-1">
        <h2 id="empty-spots-heading" className="text-lg font-semibold">
          {count === 1 ? "1 spot needs a photo" : `${count} spots need a photo`}
        </h2>
        <p className="text-sm text-muted-foreground">
          Until then, the site shows a placeholder graphic there. Tap a photo, then pick where it shows.
        </p>
      </div>

      <ul className="divide-y rounded-xl border">
        {pages.map(([page, labels]) => (
          <li key={page} className="space-y-0.5 px-4 py-3">
            <p className="text-sm font-medium">{page}</p>
            <p className="text-sm text-muted-foreground">{labels.join(" · ")}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
