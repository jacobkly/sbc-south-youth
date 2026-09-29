import { getImageProps } from "next/image";
import type { CSSProperties } from "react";
import type { Photo as PhotoData } from "@/lib/content/types";
import { Photo } from "./photo";

// Full width on phones, and the poster inside the page gutters on desktop.
const WIDE = "(min-width: 64rem)";
const sizes = `(min-width: 79rem) 1200px, ${WIDE} calc(100vw - 4rem), 100vw`;

/**
 * The home poster's photo, which is likely the largest paint, so it loads
 * first. Phones get the portrait crop when there is one, or else the wide
 * photo cropped around `focus`. The parent sets the size and adds the
 * scrim that keeps text on top readable.
 */
export function HeroMedia({
  photo,
  portrait,
  focus = "50% 50%",
  className = "",
}: {
  photo?: PhotoData;
  portrait?: PhotoData;
  /** An `object-position` for the phone crop of a wide photo, like "62% 50%". */
  focus?: string;
  className?: string;
}) {
  if (photo && portrait) {
    const common = { alt: photo.alt, fill: true, sizes, loading: "eager", fetchPriority: "high" } as const;
    const {
      props: { srcSet: wide },
    } = getImageProps({ ...common, src: photo.src });
    const { props: phone } = getImageProps({ ...common, src: portrait.src });

    return (
      <div className={className}>
        <picture>
          <source media={WIDE} srcSet={wide} sizes={sizes} />
          <img {...phone} alt={photo.alt} className="object-cover" />
        </picture>
      </div>
    );
  }

  return (
    <div className={className} style={{ "--focus": focus } as CSSProperties}>
      <Photo photo={photo} seed="home" sizes={sizes} eager className="object-(--focus) lg:object-center" />
    </div>
  );
}
