"use client";

import Link from "next/link";
import type { ReactNode, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "gold";
type Size = "sm" | "md" | "lg";

interface BaseProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-olive-600 text-cream-50 hover:bg-olive-700 active:bg-olive-800",
  secondary:
    "bg-cream-50 text-forest-700 hover:bg-cream-100 border border-cream-300",
  outline:
    "bg-transparent text-forest-700 border border-olive-500 hover:bg-olive-600 hover:text-cream-50 hover:border-olive-600",
  ghost: "bg-transparent text-forest-700 hover:bg-cream-100",
  gold: "bg-warmbrown-500 text-cream-50 hover:bg-warmbrown-600 font-medium",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-sm",
  lg: "px-8 py-4 text-base",
};

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-olive-300 focus:ring-offset-2 focus:ring-offset-cream-50 disabled:opacity-50 disabled:cursor-not-allowed tracking-wide";

export function Button({
  variant = "primary",
  size = "md",
  className,
  fullWidth,
  children,
  ...rest
}: BaseProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

interface LinkButtonProps extends BaseProps {
  href: string;
  onClick?: () => void;
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  fullWidth,
  children,
  onClick,
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className,
      )}
    >
      {children}
    </Link>
  );
}
