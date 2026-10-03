import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Confetti from "react-confetti";
import { AnimatePresence, motion } from "framer-motion";
import { API } from "../config/api";
import type { Player } from "../types/Player";

// Línea de tiempo de la revelación (ms desde que llega el leaderboard).
//   calculating -> las nubes tapan todo
//   opening     -> la cortina de nubes se abre y aparece el escenario
//   third/second-> se abre la nube de ese lugar y sale el anunciador
//   drumroll    -> redoble antes del 1er lugar
//   first       -> 1er lugar, confeti, título y el resto del ranking
const STEPS = ["calculating", "opening", "third", "second", "drumroll", "first"] as const;
type Step = (typeof STEPS)[number];
const STEP_AT_MS: Record<Step, number> = {
  calculating: 0,
  opening: 2200,
  third: 3800,
  second: 6000,
  drumroll: 8200,
  first: 10400,
};

const DEMO_PLAYERS: Player[] = [
  { id: "1", name: "Sofi_Data", score: 8400 },
  { id: "2", name: "PandasMaster", score: 7900 },
  { id: "3", name: "Mariana.py", score: 7350 },
  { id: "4", name: "Diego_SQL", score: 6100 },
  { id: "5", name: "Vale", score: 5200 },
  { id: "6", name: "Luis", score: 3900 },
];

interface PlaceStyle {
  place: 1 | 2 | 3;
  revealStep: Step;
  medal: string;
  label: string;
  announcer: string;
  burst: string[];
  pedestal: string;
  pedestalHeight: string;
  nameClass: string;
}

const PLACES: Record<1 | 2 | 3, PlaceStyle> = {
  1: {
    place: 1,
    revealStep: "first",
    medal: "🥇",
    label: "¡PRIMER LUGAR!",
    announcer: "🥳",
    burst: ["🏆", "👑", "🎉", "⭐", "✨", "🥇", "💛", "🎊"],
    pedestal: "from-yellow-300 via-amber-400 to-amber-600 shadow-[0_0_60px_rgba(251,191,36,0.55)]",
    pedestalHeight: "h-36 sm:h-44 md:h-56",
    nameClass: "text-yellow-300 text-base sm:text-xl md:text-3xl font-black",
  },
  2: {
    place: 2,
    revealStep: "second",
    medal: "🥈",
    label: "¡Segundo lugar!",
    announcer: "😎",
    burst: ["🥈", "✨", "🎉", "💫", "🙌"],
    pedestal: "from-slate-200 via-slate-300 to-slate-500",
    pedestalHeight: "h-24 sm:h-32 md:h-40",
    nameClass: "text-white text-sm sm:text-lg md:text-2xl font-bold",
  },
  3: {
    place: 3,
    revealStep: "third",
    medal: "🥉",
    label: "¡Tercer lugar!",
    announcer: "🤩",
    burst: ["🥉", "🎉", "✨", "👏", "🔥"],
    pedestal: "from-orange-300 via-orange-400 to-orange-700",
    pedestalHeight: "h-16 sm:h-24 md:h-28",
    nameClass: "text-white text-sm sm:text-lg md:text-2xl font-bold",
  },
};

// Pseudoaleatorio determinista (sin Math.random en el render).
function seeded(index: number, salt: number): number {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function hasReached(current: Step, target: Step): boolean {
  return STEPS.indexOf(current) >= STEPS.indexOf(target);
}

function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return size;
}

// Nube en SVG (círculos unidos) para que se vea nítida en cualquier tamaño.
function Cloud({ className = "", tint = "#ffffff" }: { className?: string; tint?: string }) {
  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`cloud-${tint.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor={tint} />
        </linearGradient>
      </defs>
      <g fill={`url(#cloud-${tint.slice(1)})`}>
        <circle cx="55" cy="70" r="38" />
        <circle cx="95" cy="50" r="46" />
        <circle cx="140" cy="62" r="40" />
        <circle cx="170" cy="82" r="28" />
        <circle cx="28" cy="88" r="26" />
        <rect x="28" y="75" width="145" height="40" rx="20" />
      </g>
    </svg>
  );
}

// Emojis que salen disparados hacia arriba desde el centro.
function EmojiBurst({ emojis, count, spread }: { emojis: string[]; count: number; spread: number }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-30">
      {Array.from({ length: count }, (_, i) => {
        const angle = -Math.PI / 2 + (seeded(i, 1) - 0.5) * Math.PI * 1.4;
        const distance = spread * (0.5 + seeded(i, 2) * 0.7);
        return (
          <motion.span
            key={i}
            className="absolute text-2xl sm:text-3xl md:text-4xl select-none"
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.3, rotate: 0 }}
            animate={{
              x: Math.cos(angle) * distance,
              y: [0, Math.sin(angle) * distance, Math.sin(angle) * distance + 60],
              opacity: [0, 1, 1, 0],
              scale: [0.3, 1.2, 1],
              rotate: (seeded(i, 3) - 0.5) * 120,
            }}
            transition={{ duration: 2.2, delay: seeded(i, 4) * 0.25, ease: "easeOut" }}
          >
            {emojis[i % emojis.length]}
          </motion.span>
        );
      })}
    </div>
  );
}

function PodiumColumn({ player, style, step }: { player: Player | undefined; style: PlaceStyle; step: Step }) {
  const stageVisible = hasReached(step, "opening");
  const revealed = hasReached(step, style.revealStep) && Boolean(player);
  const isFirst = style.place === 1;
  const shaking = isFirst && step === "drumroll";

  return (
    <motion.div
      className="relative flex w-1/3 max-w-[15rem] flex-col items-center justify-end"
      initial={{ y: 200, opacity: 0 }}
      animate={stageVisible ? { y: 0, opacity: 1 } : { y: 200, opacity: 0 }}
      transition={{ type: "spring", stiffness: 70, damping: 14, delay: (3 - style.place) * 0.15 }}
    >
      {/* Anunciador: emoji con globo de texto */}
      <div className="relative flex h-24 sm:h-28 md:h-32 w-full items-end justify-center">
        <AnimatePresence>
          {revealed && player && (
            <motion.div
              className="flex flex-col items-center"
              initial={{ y: 60, scale: 0, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 12, delay: 0.35 }}
            >
              <div className="relative mb-1 max-w-[7.5rem] sm:max-w-[10rem] md:max-w-[13rem] rounded-2xl bg-white px-2 py-1 sm:px-3 sm:py-2 text-center text-[10px] sm:text-xs md:text-sm font-bold leading-tight text-purple-900 shadow-lg">
                {style.label}
                <span className="block break-all pb-0.5 font-black text-fuchsia-600">¡{player.name}!</span>
                <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-white" />
              </div>
              <motion.span
                className="text-3xl sm:text-4xl md:text-5xl"
                animate={{ rotate: [0, -12, 12, -8, 0], y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 1.6, repeatDelay: 0.6 }}
              >
                {style.announcer}
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Medalla, nombre y puntos */}
      <div className="relative flex w-full flex-col items-center px-1 pb-2 text-center">
        <AnimatePresence>
          {revealed && player && (
            <motion.div
              className="flex w-full flex-col items-center"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 160, damping: 12 }}
            >
              {isFirst && (
                <motion.span
                  className="text-3xl sm:text-4xl md:text-5xl drop-shadow-[0_0_14px_rgba(250,204,21,0.8)]"
                  animate={{ y: [0, -8, 0], rotate: [-6, 6, -6] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  👑
                </motion.span>
              )}
              <span className="text-3xl sm:text-4xl md:text-5xl">{style.medal}</span>
              <span className={`mt-1 w-full break-words leading-tight ${style.nameClass}`}>{player.name}</span>
              <span className="mt-1 rounded-full bg-black/30 px-2 py-0.5 font-mono text-xs sm:text-sm font-bold text-white/90">
                {player.score.toLocaleString("es-MX")} pts
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nube que tapa el lugar hasta su revelación. Siempre montada: al
            revelarse se desvanece y crece (no depende de una animación de
            salida para dejar de tapar). */}
        {player && (
          <motion.div
            className="pointer-events-none absolute inset-x-0 bottom-0 flex h-20 sm:h-24 md:h-28 items-end justify-center"
            initial={false}
            animate={revealed ? { opacity: 0, scale: 1.5, y: -30 } : { opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <motion.div
              className="relative h-full w-[130%]"
              animate={shaking ? { x: [-4, 4, -4], rotate: [-1.5, 1.5, -1.5] } : { y: [0, -5, 0] }}
              transition={shaking ? { repeat: Infinity, duration: 0.18 } : { repeat: Infinity, duration: 3, ease: "easeInOut" }}
            >
              <Cloud className="absolute inset-0 h-full w-full drop-shadow-xl" tint={isFirst ? "#fde68a" : "#e9d5ff"} />
              <span className="absolute inset-0 flex items-center justify-center pt-3 text-2xl sm:text-3xl font-black text-purple-900/70">
                {style.place}
              </span>
            </motion.div>
          </motion.div>
        )}

        {revealed && <EmojiBurst emojis={style.burst} count={isFirst ? 22 : 12} spread={isFirst ? 190 : 120} />}
      </div>

      {/* Pedestal */}
      <div
        className={`relative flex w-full items-start justify-center rounded-t-2xl bg-gradient-to-b pt-2 sm:pt-3 ${style.pedestal} ${style.pedestalHeight}`}
      >
        <span className="text-3xl sm:text-4xl md:text-6xl font-black text-white/80 drop-shadow">{style.place}</span>
      </div>
    </motion.div>
  );
}

export default function Podium() {
  const [searchParams] = useSearchParams();
  const isDemo = searchParams.get("demo") === "1";
  // El Host abre /podium?code=XXXX; las alumnas llegan con el código guardado al unirse.
  const code = searchParams.get("code") ?? localStorage.getItem("gameCode");

  const [leaderboard, setLeaderboard] = useState<Player[] | null>(() => (isDemo ? DEMO_PLAYERS : null));
  const [loadError, setLoadError] = useState(false);
  const [step, setStep] = useState<Step>("calculating");
  const [replayKey, setReplayKey] = useState(0);
  const { width, height } = useWindowSize();

  useEffect(() => {
    if (isDemo || !code) return;
    let cancelled = false;

    fetch(`${API}/games/${code}/leaderboard`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`status ${response.status}`);
        const data: Player[] = await response.json();
        if (!cancelled) setLeaderboard(data);
      })
      .catch((error: unknown) => {
        console.error("Error cargando el leaderboard:", error);
        if (!cancelled) setLoadError(true);
      });

    return () => { cancelled = true; };
  }, [code, isDemo]);

  useEffect(() => {
    if (!leaderboard) return;

    const timers = STEPS.map((item) => setTimeout(() => setStep(item), STEP_AT_MS[item]));
    return () => timers.forEach(clearTimeout);
  }, [leaderboard, replayKey]);

  const players = leaderboard ?? [];
  const [first, second, third] = players;
  const rest = players.slice(3);
  const curtainOpen = hasReached(step, "opening");
  const finale = step === "first";

  if (!isDemo && (!code || loadError)) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-950 to-purple-950 flex items-center justify-center p-6 text-center text-white">
        <p className="text-xl">No pudimos cargar los resultados de este juego.</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-b from-indigo-950 via-purple-900 to-fuchsia-900 text-white">
      {finale && (
        <Confetti width={width} height={height} recycle={false} numberOfPieces={width < 640 ? 250 : 500} />
      )}

      {/* Estrellas de fondo */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {Array.from({ length: 40 }, (_, i) => (
          <motion.span
            key={i}
            className="absolute h-1 w-1 rounded-full bg-white"
            style={{ left: `${seeded(i, 5) * 100}%`, top: `${seeded(i, 6) * 70}%` }}
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ repeat: Infinity, duration: 2 + seeded(i, 7) * 3, delay: seeded(i, 8) * 2 }}
          />
        ))}
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center px-3 pb-10 pt-8 sm:px-6 md:pt-12">
        {/* Título */}
        <div className="flex min-h-[6.5rem] sm:min-h-[8rem] items-center justify-center text-center">
          <AnimatePresence mode="wait">
            {finale ? (
              <motion.div key="finale" initial={{ scale: 0, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 140 }}>
                <p className="text-5xl sm:text-6xl">🏆</p>
                <h1 className="bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-400 bg-clip-text text-3xl font-black tracking-wide text-transparent sm:text-5xl md:text-6xl">
                  ¡Campeones Lilihoot!
                </h1>
              </motion.div>
            ) : step === "drumroll" ? (
              <motion.h1
                key="drumroll"
                className="text-2xl font-black uppercase tracking-widest sm:text-4xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, scale: [1, 1.08, 1] }}
                transition={{ scale: { repeat: Infinity, duration: 0.45 } }}
              >
                🥁 ¡Redoble de tambores! 🥁
              </motion.h1>
            ) : curtainOpen ? (
              <motion.h1 key="results" className="text-2xl font-bold text-white/60 sm:text-4xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                Resultados finales
              </motion.h1>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Podio: 2º - 1º - 3º */}
        <div className="mt-2 flex w-full items-end justify-center gap-2 sm:gap-4 md:gap-6">
          <PodiumColumn player={second} style={PLACES[2]} step={step} />
          <PodiumColumn player={first} style={PLACES[1]} step={step} />
          <PodiumColumn player={third} style={PLACES[3]} step={step} />
        </div>
        <div className="h-3 w-full max-w-3xl rounded-full bg-white/10" />

        {players.length === 0 && curtainOpen && (
          <p className="mt-8 text-white/70">Nadie respondió en este juego.</p>
        )}

        {/* Resto del ranking */}
        {finale && rest.length > 0 && (
          <section className="mt-10 w-full max-w-2xl">
            <h2 className="mb-3 px-2 text-sm font-bold uppercase tracking-wider text-white/60">Resto de jugadores</h2>
            <div className="space-y-2">
              {rest.map((player, index) => (
                <motion.div
                  key={player.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur sm:p-4"
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.2 + index * 0.12, type: "spring", stiffness: 90 }}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="w-7 shrink-0 text-center font-mono font-bold text-white/50">#{index + 4}</span>
                    <span className="truncate font-semibold">{player.name}</span>
                  </span>
                  <span className="shrink-0 rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/20 px-3 py-1 font-mono font-black text-fuchsia-200">
                    {player.score.toLocaleString("es-MX")}
                  </span>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Jugadores (no la host, que abre el podio con ?code=): ver su % del quiz. */}
        {!isDemo && finale && !searchParams.get("code") && localStorage.getItem("studentToken") && (
          <a href="/mis-resultados" className="mt-10 rounded-xl bg-white/15 px-5 py-3 font-semibold hover:bg-white/25">
            📊 Ver mis resultados
          </a>
        )}

        {isDemo && finale && (
          <button
            onClick={() => { setStep("calculating"); setReplayKey((current) => current + 1); }}
            className="mt-10 rounded-xl bg-white/15 px-5 py-3 font-semibold hover:bg-white/25"
          >
            ↻ Ver de nuevo (demo)
          </button>
        )}
      </main>

      {/* Cortina de nubes que tapa todo al inicio y se abre hacia los lados */}
      <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden="true">
        {(["left", "right"] as const).map((side) => (
          <motion.div
            key={side}
            className={`absolute top-0 h-full w-[65%] ${side === "left" ? "left-0" : "right-0"}`}
            initial={false}
            // 160%: las nubes sobresalen del panel, hay que sacarlas del todo.
            animate={{ x: curtainOpen ? (side === "left" ? "-160%" : "160%") : "0%" }}
            transition={{ duration: 1.3, ease: [0.65, 0, 0.35, 1] }}
          >
            <div className={`absolute inset-0 bg-gradient-to-b from-violet-200 to-fuchsia-200 ${side === "left" ? "rounded-r-[40%]" : "rounded-l-[40%]"}`} />
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="absolute inset-x-0" style={{ top: `${i * 17 - 5}%` }}>
                <Cloud
                  tint="#f5d0fe"
                  className={`absolute w-[70%] min-w-[220px] drop-shadow-2xl ${side === "left" ? "-right-[20%]" : "-left-[20%]"}`}
                />
              </div>
            ))}
          </motion.div>
        ))}

        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-purple-900"
          initial={false}
          animate={curtainOpen ? { opacity: 0, scale: 1.2 } : { opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <motion.p className="text-6xl" animate={{ rotate: [0, 12, -12, 0] }} transition={{ repeat: Infinity, duration: 1.2 }}>
            ☁️
          </motion.p>
          <motion.p
            className="mt-4 text-2xl font-black tracking-widest sm:text-3xl"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 1.4 }}
          >
            CALCULANDO RESULTADOS...
          </motion.p>
        </motion.div>

        {/* Al abrirse, salen emojis por el hueco entre las nubes */}
        {curtainOpen && step === "opening" && (
          <EmojiBurst emojis={["🎉", "✨", "⭐", "🎊", "💜", "🌟"]} count={18} spread={width < 640 ? 180 : 320} />
        )}
      </div>
    </div>
  );
}
