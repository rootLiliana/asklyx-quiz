import { useId, type InputHTMLAttributes, type ReactNode } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  error?: string;
};

export const inputBaseClass =
  "w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-lg text-white placeholder:text-slate-400 transition focus:border-fuchsia-400 focus:bg-white/15 focus:outline-none focus:ring-4 focus:ring-fuchsia-500/30";

// Campo de texto con etiqueta, ayuda y error ligados por aria para lectores de pantalla.
export function Field({ label, hint, error, className = "", id, ...rest }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-slate-300">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        className={`${inputBaseClass} ${error ? "border-red-400 focus:border-red-400 focus:ring-red-500/30" : ""}`}
        {...rest}
      />
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-sm text-slate-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-sm font-semibold text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
