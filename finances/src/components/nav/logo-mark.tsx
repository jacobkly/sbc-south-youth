import Image from "next/image";
import { cn } from "cn";
import logo from "@/assets/logo.png";

/** The SBC logo on a dark tile, like an app icon. Decorative: the name always sits beside it. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-neutral-950 shadow-sm ring-1 ring-black/10",
        className,
      )}
    >
      {/* Already small, so no resizing needed. */}
      <Image src={logo} alt="" unoptimized className="h-3/5 w-auto" />
    </span>
  );
}
