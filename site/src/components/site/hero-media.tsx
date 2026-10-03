import type { Photo as PhotoData } from "@/lib/content/types";
import { photoSizes } from "@/lib/photo-sizes";
import { Photo } from "./photo";

/**
 * The home poster's photo, which is likely the largest paint, so it loads
 * first. Full width on phones, and the poster filling the frame on
 * desktop. The parent sets the size and adds the scrim that keeps text on
 * top readable.
 */
export function HeroMedia({ photo, className = "" }: { photo?: PhotoData; className?: string }) {
  return (
    <div className={className}>
      <Photo photo={photo} seed="home" sizes={photoSizes({ lg: 1 })} eager />
    </div>
  );
}
