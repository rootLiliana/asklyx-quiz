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
  // Rosa perla sólido con texto oscuro: sobrio y con buen contraste.
  primary: "bg-pearl text-fuchsia-950 shadow-glow hover:bg-fuchsia-300",
  secondary: "border border-white/12 bg-white/[0.06] text-white hover:bg-white/[0.12]",
  // Champán: el mismo oro suave del podio.
  gold: "bg-gradient-to-r from-[#f6e3b4] to-[#d9b56a] text-fuchsia-950 shadow-glow-gold hover:from-[#faecc8] hover:to-[#e2c17e]",
  ghost: "text-white/70 hover:bg-white/10 hover:text-white",
  danger: "bg-red-500/90 text-white hover:bg-red-500",
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
