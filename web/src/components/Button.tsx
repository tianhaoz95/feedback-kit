import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "dark";
type Size = "sm" | "md";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-neutral-900 text-white hover:bg-neutral-800 shadow-sm shadow-neutral-900/10 disabled:hover:bg-neutral-900",
  secondary:
    "border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 disabled:hover:bg-white",
  danger:
    "border border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50 disabled:hover:bg-white",
  ghost: "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:hover:bg-transparent",
  // For a button sitting on a dark surface (e.g. a code block) rather than
  // the app's light background.
  dark: "border border-neutral-700 bg-transparent text-neutral-300 hover:bg-neutral-800 disabled:hover:bg-transparent",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-3.5 py-2 text-sm gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    />
  );
}
