import type { Metadata } from "next";
import Image from "next/image";
import logo from "@/assets/logo.png";

const description = "The new SBC South Youth website is under construction. Check back soon.";
const shareImage = { url: "/opengraph-image.png", width: 1200, height: 630, alt: "SBC South Youth logo" };

export const metadata: Metadata = {
  title: { absolute: "SBC South Youth" },
  description,
  // Page openGraph replaces the layout's and the file-based image, so it repeats every field.
  openGraph: {
    title: "SBC South Youth",
    description,
    siteName: "SBC South Youth",
    url: "/",
    type: "website",
    images: [shareImage],
  },
  twitter: { card: "summary_large_image", description, images: [shareImage] },
};

/**
 * The page every visitor sees while the launch gate is closed (see
 * `src/lib/launch-gate.ts`). It keeps its own black look in both themes.
 */
export default function ComingSoon() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-black px-6 pt-[max(3rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))] text-center text-white [color-scheme:dark]">
      <div aria-hidden className="grain pointer-events-none absolute inset-0 -z-10 opacity-[0.035]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-2/3 bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgb(255_255_255/0.07),transparent)]"
      />

      <div className="relative animate-rise motion-reduce:animate-none">
        <div
          aria-hidden
          className="absolute -inset-20 -z-10 animate-breathe rounded-full bg-[radial-gradient(closest-side,rgb(255_255_255/0.16),transparent)] motion-reduce:animate-none sm:-inset-28"
        />
        {/* The heading names the page, so the logo is decorative. Already small, so no resizing needed. */}
        <Image src={logo} alt="" preload unoptimized className="h-auto w-32 sm:w-40" />
      </div>

      <h1 className="mt-10 animate-rise text-4xl font-semibold tracking-tight [animation-delay:120ms] motion-reduce:animate-none sm:text-6xl">
        SBC South Youth
      </h1>

      <p className="mt-5 inline-flex animate-rise items-center gap-2.5 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-[0.2em] text-white/80 uppercase [animation-delay:240ms] motion-reduce:animate-none">
        <span aria-hidden className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2 rounded-full bg-amber-400" />
        </span>
        Under construction
      </p>

      <p className="mt-6 animate-rise text-base text-white/60 [animation-delay:360ms] motion-reduce:animate-none sm:text-lg">
        Our new website is on the way.
        <br />
        Check back soon.
      </p>
    </main>
  );
}
