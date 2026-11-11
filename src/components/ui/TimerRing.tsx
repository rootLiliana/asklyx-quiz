import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface TimerRingProps {
  seconds: number;
  total: number;
  /** Diámetro en px. */
  size?: number;
}

// Cronómetro circular: el anillo (degradado de perla) se vacía con el tiempo y
// cambia a dorado y luego a rojo cuando queda poco. Con 3 s o menos late.
export function TimerRing({ seconds, total, size = 96 }: TimerRingProps) {
  const reduce = useReducedMotion();
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = total > 0 ? Math.max(0, Math.min(1, seconds / total)) : 0;
  const gradientId = `timer-pearl-${useId().replace(/:/g, "")}`;
  const color = seconds <= 3 ? "#EF4444" : seconds <= total * 0.35 ? "#FACC15" : `url(#${gradientId})`;
  const urgent = seconds > 0 && seconds <= 3 && !reduce;

  return (
    <motion.div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
      animate={urgent ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={urgent ? { duration: 0.8, repeat: Infinity } : { duration: 0.2 }}
      role="timer"
      aria-label={`${seconds} segundos restantes`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F0A9C8" />
            <stop offset="0.55" stopColor="#B9B4F5" />
            <stop offset="1" stopColor="#9FE3D6" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
        />
      </svg>
      <span className="absolute font-display text-3xl font-semibold tabular-nums">{seconds}</span>
    </motion.div>
  );
}
