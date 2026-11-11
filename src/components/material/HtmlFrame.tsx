import { useRef } from "react";

// Material interactivo: una página HTML completa dentro de un iframe aislado.
//
// sandbox SIN allow-same-origin: la página corre en un origen "opaco", así que
// no puede leer el token ni el localStorage de la app, ni tocar esta ventana,
// aunque traiga JavaScript. Sí puede correr sus scripts, abrir enlaces en otra
// pestaña y usar formularios. Su propio localStorage falla (los materiales lo
// envuelven en try/catch), así que no guarda preferencias entre visitas.
const SANDBOX = "allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals";

export default function HtmlFrame({ html, title }: { html: string; title: string }) {
  const wrapper = useRef<HTMLDivElement>(null);

  const fullscreen = () => {
    const element = wrapper.current;
    if (!element) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else element.requestFullscreen?.().catch((err: unknown) => console.error("No se pudo abrir en pantalla completa", err));
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <div className="flex items-center justify-between gap-2 bg-black/30 px-3 py-2 text-sm">
        <span className="min-w-0 truncate text-slate-300">🧩 {title}</span>
        <button onClick={fullscreen} className="shrink-0 rounded-lg bg-white/10 px-3 py-1 font-semibold hover:bg-white/20">
          ⛶ Pantalla completa
        </button>
      </div>
      {/* Fondo blanco: las páginas asumen fondo propio, no el de la app. */}
      <div ref={wrapper} className="bg-white">
        <iframe
          title={title}
          srcDoc={html}
          sandbox={SANDBOX}
          referrerPolicy="no-referrer"
          className="block h-[75vh] w-full border-0 [:fullscreen_&]:h-screen"
        />
      </div>
    </div>
  );
}
