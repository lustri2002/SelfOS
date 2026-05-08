import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

const fieldClass =
  "sb-focus w-full min-h-10 rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] px-3 py-2 text-sm text-[var(--sb-text)] shadow-[var(--sb-shadow-sm)] placeholder-[var(--sb-muted)] transition-colors focus:border-[var(--sb-accent)] disabled:cursor-not-allowed disabled:opacity-50";

export function TextField({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClass, className)} {...props} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldClass, "resize-none", className)} {...props} />;
}

export function SelectField({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldClass, "cursor-pointer", className)} {...props} />;
}
