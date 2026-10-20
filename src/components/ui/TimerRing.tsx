import { motion, useReducedMotion } from "framer-motion";

interface TimerRingProps {
  seconds: number;
  total: number;
  /** Diámetro en px. */
  size?: number;
}

// Cronómetro circular: el anillo se vacía con el tiempo y cambia a dorado y
// luego a rojo cuando queda poco. Con 3 s o menos late para llamar la atención.
export function TimerRing({ seconds, total, size = 96 }: TimerRingProps) {
  const reduce = useReducedMotion();
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = total > 0 ? Math.max(0, Math.min(1, seconds / total)) : 0;
  const color = seconds <= 3 ? "#EF4444" : seconds <= total * 0.35 ? "#FACC15" : "#E879F9";
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
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth={stroke} />
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
