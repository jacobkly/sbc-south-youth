import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "light" | "inverse";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:brightness-110",
  secondary: "bg-surface-2 text-fg ring-1 ring-line-strong ring-inset hover:bg-surface",
  ghost: "text-fg hover:bg-surface-2",
  // For use over photos, where the page colors don't apply.
  light: "bg-white/12 text-white ring-1 ring-white/25 ring-inset backdrop-blur-md hover:bg-white/20",
  // For use on an accent fill.
  inverse: "bg-on-accent text-accent hover:opacity-90",
};

const sizes: Record<ButtonSize, string> = {
  // Looks 36 px tall, but the invisible edge makes the tap target 44 px.
  sm: "relative h-9 px-4 text-sm after:absolute after:-inset-1",
  md: "h-11 px-5 text-[0.9375rem]",
  lg: "h-14 px-7 text-base",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className = "",
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}): string {
  return [
    "pressable inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none",
    "disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[1.15em] [&_svg]:shrink-0",
    variants[variant],
    sizes[size],
    className,
  ].join(" ");
}

type Common = { variant?: ButtonVariant; size?: ButtonSize; className?: string; children: ReactNode };

/** A pill button. Pass `href` for a link that looks like a button. */
export function Button(props: Common & ComponentProps<"button">) {
  const { variant, size, className, children, type = "button", ...rest } = props;
  return (
    <button type={type} className={buttonClasses({ variant, size, className })} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink(props: Common & ComponentProps<typeof Link>) {
  const { variant, size, className, children, ...rest } = props;
  return (
    <Link className={buttonClasses({ variant, size, className })} {...rest}>
      {children}
    </Link>
  );
}
