import type { ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

type CardProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
  /** "glass" = tarjeta principal (con borde de perla); "soft" = bloque dentro de otra; "good"/"bad" = resultado. */
  tone?: CardTone;
};

export type CardTone = "glass" | "soft" | "good" | "bad";

const TONES: Record<CardTone, string> = {
  glass: "relative rounded-3xl bg-purple-900/80 shadow-2xl shadow-black/40 backdrop-blur-xl pearl-border",
  soft: "rounded-2xl border border-white/[0.08] bg-white/[0.04]",
  good: "rounded-2xl border border-green-300/60 bg-green-500/15",
  bad: "rounded-2xl border border-red-400/50 bg-red-500/10",
};

export function Card({ children, tone = "glass", className = "", ...rest }: CardProps) {
  return (
    <motion.div className={`${TONES[tone]} ${className}`} {...rest}>
      {children}
    </motion.div>
  );
}
