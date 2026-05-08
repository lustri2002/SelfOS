import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonVariant = "default" | "subtle" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  default:
    "border-[var(--sb-accent)] bg-[var(--sb-accent)] text-white shadow-[var(--sb-shadow-sm)] hover:bg-[var(--sb-accent-strong)]",
  subtle:
    "border-[var(--sb-border)] bg-[var(--sb-surface)] text-[var(--sb-text)] shadow-[var(--sb-shadow-sm)] hover:bg-[var(--sb-hover)]",
  ghost:
    "border-transparent bg-transparent text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]",
  danger:
    "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/15 hover:text-red-300",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "min-h-8 rounded-lg px-2.5 text-xs",
  md: "min-h-10 rounded-lg px-3 text-sm",
  icon: "h-10 w-10 rounded-lg p-0",
};

export function Button({
  className,
  variant = "subtle",
  size = "md",
  leadingIcon,
  trailingIcon,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "sb-focus inline-flex cursor-pointer items-center justify-center gap-2 border font-medium transition-colors sb-press disabled:cursor-not-allowed disabled:opacity-50",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...props}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}

export function IconButton({
  "aria-label": ariaLabel,
  children,
  ...props
}: Omit<ButtonProps, "size" | "children"> & {
  "aria-label": string;
  children: ReactNode;
}) {
  return (
    <Button size="icon" aria-label={ariaLabel} {...props}>
      {children}
    </Button>
  );
}
