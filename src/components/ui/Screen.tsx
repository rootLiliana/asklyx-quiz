import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface ScreenProps {
  children: ReactNode;
  /** Centra el contenido vertical y horizontalmente (pantallas de una sola tarjeta). */
  center?: boolean;
  className?: string;
}

// Fondo de todas las pantallas: el degradado de la marca con dos luces suaves
// que se mueven despacio. Con "reducir movimiento" las luces se quedan quietas.
export function Screen({ children, center = false, className = "" }: ScreenProps) {
  const reduce = useReducedMotion();

  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-br from-purple-900 via-indigo-900 to-black text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -left-32 -top-32 size-[28rem] rounded-full bg-fuchsia-500/25 blur-3xl"
          animate={reduce ? undefined : { x: [0, 60, 0], y: [0, 40, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-40 -right-24 size-[32rem] rounded-full bg-indigo-500/20 blur-3xl"
          animate={reduce ? undefined : { x: [0, -50, 0], y: [0, -30, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div
        className={`relative px-4 py-6 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-8 sm:py-10 ${
          center ? "flex min-h-dvh items-center justify-center" : ""
        } ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
