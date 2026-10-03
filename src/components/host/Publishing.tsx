import { fieldClass, labelClass } from "../../lib/hostStyles";
import { formatDateTime, publishModeOf, type PublishMode } from "../../lib/publishing";

export function StatusBadge({ publishedAt }: { publishedAt: string | null }) {
  const mode = publishModeOf(publishedAt);
  if (mode === "draft") return <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">📝 Borrador</span>;
  if (mode === "scheduled") {
    return <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-200">🗓️ Se publica {formatDateTime(publishedAt!)}</span>;
  }
  return <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-200">✅ Publicado</span>;
}

export function PublishPicker({ mode, onModeChange, scheduledAt, onScheduledAtChange }: {
  mode: PublishMode;
  onModeChange: (mode: PublishMode) => void;
  scheduledAt: string;
  onScheduledAtChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl bg-black/20 p-4">
      <p className={labelClass}>¿Cuándo lo ven los alumnos?</p>
      <div className="flex flex-wrap gap-2">
        {([
          ["draft", "📝 Borrador (no lo ven)"],
          ["published", "✅ Publicado"],
          ["scheduled", "🗓️ Programar"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onModeChange(value)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${mode === value ? "bg-fuchsia-600" : "bg-white/10 hover:bg-white/20"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "scheduled" && (
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => onScheduledAtChange(e.target.value)}
          className={`${fieldClass} mt-3 sm:max-w-xs`}
        />
      )}
    </div>
  );
}
