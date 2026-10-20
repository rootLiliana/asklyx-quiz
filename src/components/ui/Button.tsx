import type { ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

export type ButtonVariant = "primary" | "secondary" | "gold" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Muestra un indicador y bloquea el botón mientras termina una petición. */
  loading?: boolean;
  block?: boolean;
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white shadow-glow hover:from-fuchsia-400 hover:to-purple-500",
  secondary: "border border-white/15 bg-white/10 text-white hover:bg-white/20",
  gold: "bg-gradient-to-r from-yellow-400 to-amber-500 text-purple-950 shadow-glow-gold hover:from-yellow-300 hover:to-amber-400",
  ghost: "text-white/70 hover:bg-white/10 hover:text-white",
  danger: "bg-gradient-to-r from-red-500 to-rose-600 text-white hover:from-red-400 hover:to-rose-500",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "rounded-xl px-3.5 py-2 text-sm",
  md: "rounded-xl px-5 py-3 text-base",
  lg: "rounded-2xl px-6 py-4 text-lg",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  block = false,
  disabled,
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  const inactive = disabled || loading;

  return (
    <motion.button
      type={type}
      disabled={inactive}
      aria-busy={loading || undefined}
      whileHover={inactive ? undefined : { y: -2 }}
      whileTap={inactive ? undefined : { scale: 0.97 }}
      className={`inline-flex items-center justify-center gap-2 font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${
        block ? "w-full" : ""
      } ${className}`}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </motion.button>
  );
}

export function Spinner({ className = "size-4" }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />;
}
