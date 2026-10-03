import type { Photo as PhotoData } from "@/lib/content/types";
import { PlaceholderArt } from "./placeholder-art";

/**
 * A photo that fills its parent, or generated art when there isn't one.
 * The parent sets the size and needs `relative`.
 */
export function Photo({
  photo,
  seed,
  label,
  sizes,
  eager = false,
  className = "",
}: {
  photo?: PhotoData;
  /** Picks the art when there's no photo. */
  seed: string;
  /** A big word on the art. Leave it out when text sits on top. */
  label?: string;
  sizes: string;
  /** For the image above the fold that's likely the largest paint. */
  eager?: boolean;
  className?: string;
}) {
  if (!photo) return <PlaceholderArt seed={seed} label={label} className={className} />;

  return (
    // The portal already made a phone size and a large size, so the browser
    // picks one from Storage and nothing goes through the image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.src}
      srcSet={photo.srcSet}
      sizes={sizes}
      alt={photo.alt}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      decoding="async"
      className={`absolute inset-0 size-full object-cover ${className}`}
    />
  );
}
