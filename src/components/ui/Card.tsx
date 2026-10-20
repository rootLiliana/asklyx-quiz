import type { ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

type CardProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
  /** "glass" = tarjeta principal; "soft" = bloque dentro de otra; "good"/"bad" = resultado. */
  tone?: CardTone;
};

export type CardTone = "glass" | "soft" | "good" | "bad";

const TONES: Record<CardTone, string> = {
  glass: "rounded-3xl border border-white/10 bg-white/10 shadow-2xl shadow-black/30 backdrop-blur-xl",
  soft: "rounded-2xl border border-white/10 bg-white/5",
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
