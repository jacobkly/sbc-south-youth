import { photoUrl } from "@/lib/photo-files";
import type { LibraryPhoto } from "@/lib/portal/photos/queries";

/** The library: each photo's small size, with its alt text under it. */
export function PhotoGrid({ photos, supabaseUrl }: { photos: LibraryPhoto[]; supabaseUrl: string }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Photos">
      {photos.map((photo) => (
        <li key={photo.id} className="min-w-0 space-y-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- already sized when it was uploaded */}
          <img
            src={photoUrl(supabaseUrl, photo.id, "sm", photo.mimeType)}
            alt={photo.alt}
            width={photo.width}
            height={photo.height}
            loading="lazy"
            decoding="async"
            className="aspect-4/3 w-full rounded-lg bg-muted object-cover"
          />
          <p className="line-clamp-2 text-xs text-muted-foreground" aria-hidden>
            {photo.alt}
          </p>
        </li>
      ))}
    </ul>
  );
}
