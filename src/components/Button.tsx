import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { Icon } from "./Icon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "quiet";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-navy text-white hover:bg-navy-soft border border-navy",
  secondary: "bg-card text-ink border border-line hover:bg-page",
  ghost: "bg-transparent text-ink-2 border border-transparent hover:bg-page",
  danger: "bg-neg text-white border border-neg hover:bg-neg/90",
  quiet: "bg-navy/8 text-navy border border-navy/20 hover:bg-navy/15",
};

export function buttonCls(variant: ButtonVariant = "primary", extra = ""): string {
  return [
    "inline-flex items-center justify-center gap-2 h-11 px-4 rounded-md text-sm font-bold",
    "transition-colors select-none disabled:opacity-50 disabled:cursor-not-allowed",
    VARIANTS[variant],
    extra,
  ].join(" ");
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  children: ReactNode;
  /** React 19: ref as a prop. */
  ref?: Ref<HTMLButtonElement>;
}

export function Button({ variant = "primary", loading = false, children, className = "", disabled, ...rest }: Props) {
  return (
    <button className={buttonCls(variant, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <Icon name="spinner" size={16} />}
      {children}
    </button>
  );
}
