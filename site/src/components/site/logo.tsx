import logo from "@/assets/logo.png";

/**
 * The cross-and-ribbon mark, drawn in the current text color. The PNG is
 * white on transparent, so it's used as a mask to work in both themes.
 */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block aspect-[334/363] shrink-0 bg-current ${className}`}
      style={{
        maskImage: `url(${logo.src})`,
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "center",
      }}
    />
  );
}
