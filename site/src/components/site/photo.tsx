import Image from "next/image";
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
    <Image
      src={photo.src}
      alt={photo.alt}
      fill
      sizes={sizes}
      loading={eager ? "eager" : undefined}
      fetchPriority={eager ? "high" : undefined}
      className={`object-cover ${className}`}
    />
  );
}
