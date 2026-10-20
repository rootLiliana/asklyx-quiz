import { useEffect, useState, useSyncExternalStore } from "react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { AppRoutes } from "../App";
import { DEMO_QUESTIONS, demo, type DemoPhase } from "./mockApi";
import { DEMO_HOST } from "./hostFixtures";

// Vista previa con datos de ejemplo: las rutas reales de la app más un panel
// flotante para saltar entre pantallas y estados del juego.
export default function DemoApp() {
  return (
    <MemoryRouter initialEntries={["/"]}>
      <AppRoutes />
      <DemoPanel />
    </MemoryRouter>
  );
}

const usePhase = () => useSyncExternalStore(demo.subscribe, () => `${demo.phase}:${demo.index}`);

function DemoPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const snapshot = usePhase();
  const [phase, index] = snapshot.split(":") as [DemoPhase, string];
  const [open, setOpen] = useState(true);

  // Al terminar, el Quiz manda al podio.
  useEffect(() => {
    if (location.pathname === "/quiz" && phase === "finished") navigate("/podium");
  }, [location.pathname, phase, navigate]);

  const goHost = () => {
    try {
      localStorage.setItem("hostToken", "demo-host");
      localStorage.setItem("hostUser", JSON.stringify(DEMO_HOST));
    } catch {
      // sin almacenamiento: se verá la pantalla de entrada del panel
    }
    navigate("/host");
  };

  const goQuiz = (next: () => void) => {
    next();
    if (location.pathname !== "/quiz") navigate("/quiz");
  };

  const chip = (active: boolean) =>
    `rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${active ? "bg-fuchsia-500 text-white" : "bg-white/10 text-slate-200 hover:bg-white/20"}`;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-50 rounded-full bg-yellow-400 px-4 py-2 text-sm font-extrabold text-purple-950 shadow-glow-gold"
      >
        Vista previa
      </button>
    );
  }

  return (
    <aside className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-50 grid w-[min(20rem,calc(100vw-2rem))] gap-3 rounded-2xl border border-yellow-400/40 bg-slate-950/90 p-4 text-white shadow-2xl backdrop-blur-xl">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="m-0 text-xs font-extrabold uppercase tracking-wider text-yellow-300">Vista previa</p>
          <p className="m-0 text-xs text-slate-400">Datos de ejemplo, sin servidor.</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Ocultar panel">
          ✕
        </button>
      </div>

      <div className="grid gap-1.5">
        <span className="text-xs font-bold text-slate-400">Pantalla</span>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={chip(location.pathname === "/")} onClick={() => navigate("/")}>Inicio</button>
          <button type="button" className={chip(location.pathname === "/quiz")} onClick={() => navigate("/quiz")}>Quiz de la alumna</button>
          <button type="button" className={chip(location.pathname === "/host")} onClick={goHost}>Control Center</button>
          <button type="button" className={chip(location.pathname === "/podium")} onClick={() => navigate(`/podium?code=ANA-4821&v=${Date.now()}`)}>Podio</button>
        </div>
      </div>

      {location.pathname !== "/host" && <div className="grid gap-1.5">
        <span className="text-xs font-bold text-slate-400">Estado del juego</span>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={chip(phase === "waiting")} onClick={() => goQuiz(() => demo.setPhase("waiting"))}>Esperando</button>
          {DEMO_QUESTIONS.map((_, i) => (
            <button key={i} type="button" className={chip(phase === "question" && Number(index) === i)} onClick={() => goQuiz(() => demo.goTo(i))}>
              Pregunta {i + 1}
            </button>
          ))}
        </div>
        <button type="button" className={chip(false)} onClick={() => goQuiz(() => demo.restartQuestion())} disabled={phase !== "question"}>
          ↺ Repetir esta pregunta
        </button>
      </div>}

      <p className="m-0 text-xs leading-relaxed text-slate-400">
        {location.pathname === "/host"
          ? "Datos inventados; los cambios no se guardan. Para probar el juego en vivo: en Sesión elige un quiz y créalo. Las alumnas de ejemplo entran y contestan solas."
          : "Toca una opción para contestar. Las pantallas que no están en este panel todavía tienen el diseño anterior."}
      </p>
    </aside>
  );
}
