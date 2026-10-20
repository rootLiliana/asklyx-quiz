// Tres puntos que se encienden en secuencia ("esperando…").
export function LoadingDots({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`inline-flex gap-1.5 ${className}`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-2.5 animate-blink rounded-full bg-fuchsia-300" style={{ animationDelay: `${i * 0.2}s` }} />
      ))}
    </span>
  );
}
