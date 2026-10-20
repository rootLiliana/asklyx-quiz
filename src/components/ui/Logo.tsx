import { motion, useReducedMotion } from "framer-motion";

// La lechuza de Lilihoot. Parpadea cada pocos segundos (salvo con "reducir movimiento").
export function Owl({ className = "size-16", blink = true }: { className?: string; blink?: boolean }) {
  const reduce = useReducedMotion();
  const eyes = blink && !reduce
    ? { animate: { scaleY: [1, 1, 0.1, 1] }, transition: { duration: 4, times: [0, 0.9, 0.95, 1], repeat: Infinity } }
    : {};

  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Lilihoot">
      <defs>
        <linearGradient id="owl-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E879F9" />
          <stop offset="1" stopColor="#9333EA" />
        </linearGradient>
      </defs>
      {/* orejas */}
      <path d="M14 18 L18 4 L26 14 Z" fill="#C026D3" />
      <path d="M50 18 L46 4 L38 14 Z" fill="#C026D3" />
      {/* cuerpo */}
      <rect x="10" y="10" width="44" height="50" rx="22" fill="url(#owl-body)" />
      {/* panza */}
      <ellipse cx="32" cy="46" rx="13" ry="11" fill="#F5D0FE" opacity="0.35" />
      {/* ojos */}
      <circle cx="23" cy="28" r="9" fill="#fff" />
      <circle cx="41" cy="28" r="9" fill="#fff" />
      <motion.g style={{ originY: "28px" }} {...eyes}>
        <circle cx="24" cy="29" r="4.5" fill="#3B0764" />
        <circle cx="40" cy="29" r="4.5" fill="#3B0764" />
        <circle cx="25.5" cy="27.5" r="1.4" fill="#fff" />
        <circle cx="41.5" cy="27.5" r="1.4" fill="#fff" />
      </motion.g>
      {/* pico */}
      <path d="M28.5 36 L35.5 36 L32 41 Z" fill="#FACC15" />
    </svg>
  );
}

export function Wordmark({ className = "text-5xl" }: { className?: string }) {
  return (
    <span className={`font-display font-semibold tracking-tight ${className}`}>
      <span className="bg-gradient-to-r from-fuchsia-300 to-fuchsia-100 bg-clip-text text-transparent">Lili</span>
      <span className="bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-400 bg-clip-text text-transparent">hoot</span>
    </span>
  );
}
