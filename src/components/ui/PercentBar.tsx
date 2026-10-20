import { motion } from "framer-motion";

// Cortes iguales a los de la asistencia y los resultados (lib/percentage.ts).
function tier(value: number) {
  if (value >= 80) return { label: "Excelente", bar: "from-green-500 to-emerald-500", chip: "bg-green-500/15 text-green-300" };
  if (value >= 60) return { label: "Bien", bar: "from-yellow-400 to-amber-500", chip: "bg-yellow-400/15 text-yellow-300" };
  return { label: "Reforzar", bar: "from-red-500 to-rose-500", chip: "bg-red-500/15 text-red-300" };
}

// Barra de % de aciertos con marcas en 60 y 80 para comparar de un vistazo,
// y una etiqueta que dice qué significa ese número.
export function PercentBar({ value, showChip = true }: { value: number; showChip?: boolean }) {
  const t = tier(value);
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`${value}% de aciertos, ${t.label}`}>
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${t.bar}`}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        <span aria-hidden="true" className="absolute inset-y-0 left-[60%] w-px bg-white/30" />
        <span aria-hidden="true" className="absolute inset-y-0 left-[80%] w-px bg-white/30" />
      </div>
      {showChip && <span className={`w-20 shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-bold ${t.chip}`}>{t.label}</span>}
    </div>
  );
}
