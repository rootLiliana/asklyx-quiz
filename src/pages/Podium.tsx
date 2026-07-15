import {
  useCallback,
  useEffect,
  useState,
} from "react";
import Confetti from "react-confetti"; // Nota: Asegúrate de importar correctamente 'react-confetti'
import { API } from "../config/api";
import type { Player } from "../types/Player";
import { motion, AnimatePresence, type Variants } from "framer-motion";

type RevealPhase = "calculating" | "third" | "second" | "dramatic_pause" | "first";

export default function Podium() {
  const [leaderboard, setLeaderboard] = useState<Player[]>([]); 
  const [phase, setPhase] = useState<RevealPhase>("calculating");
  const [windowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const code = localStorage.getItem("gameCode");

  const loadLeaderboard = useCallback(async () => {
    if (!code) return;
    try {
      const response = await fetch(`${API}/games/${code}/leaderboard`);
      const data = await response.json();
      setLeaderboard(data);
    } catch (error) {
      console.error("Error cargando el leaderboard:", error);
    }
  }, [code]);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  // Orquestador del suspenso
  useEffect(() => {
    if (leaderboard.length === 0) return;

    // 1. De "calculando" a mostrar el Tercer Lugar (2s)
    const t1 = setTimeout(() => setPhase("third"), 2000);
    
    // 2. De Tercer Lugar a Mostrar el Segundo Lugar (1.5s después)
    const t2 = setTimeout(() => setPhase("second"), 3500);
    
    // 3. De Segundo Lugar a la Pausa Dramática en negro (1.5s después)
    const t3 = setTimeout(() => setPhase("dramatic_pause"), 5000);
    
    // 4. De la Pausa Dramática al Clímax: ¡Primer lugar y resto del Top! (2s después)
    const t4 = setTimeout(() => setPhase("first"), 7000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [leaderboard]);

  // Variantes para la animación de entrada con delays dinámicos
  const podiumCardVariants = {
    hidden: { opacity: 0, y: 100 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { type: "spring", stiffness: 60 }
    }
  }as const;

const listRowVariants: Variants = {
  hidden: { opacity: 0, x: -30 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { 
      delay: i * 0.15, 
      type: "spring", 
      stiffness: 80 
    }
  })
};

  // --- RENDERS DE FASE ---

  // Fase 1: Calculando resultados
  if (phase === "calculating") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-indigo-950 to-black flex flex-col items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="text-6xl mb-6"
        >
          🏁
        </motion.div>
        <motion.h2 
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-white text-3xl font-black tracking-widest text-center"
        >
          CALCULANDO RESULTADOS...
        </motion.h2>
      </div>
    );
  }

  // Fase 4: Pausa dramática (Pantalla negra total y redobles)
  if (phase === "dramatic_pause") {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <motion.h2
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 0.5 }}
          className="text-white text-4xl md:text-5xl font-black tracking-widest text-center uppercase"
        >
          🥁 ¡Redoble de tambores! 🥁
        </motion.h2>
        <p className="text-zinc-500 text-sm mt-4">¿Quién se llevará la corona?</p>
      </div>
    );
  }

  // Fases Activas de Revelación (third, second, first)
  return (
    <>
      {/* Confetti masivo sin reciclado que explota de golpe solo cuando aparece el primer lugar */}
      {phase === "first" && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={450}
        />
      )}

      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-black flex flex-col items-center justify-start p-4 md:p-8 overflow-y-auto">
        
        {/* Encabezado animado sólo al final */}
        <div className="w-full max-w-4xl z-10 mt-6 text-center">
          {phase === "first" ? (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
              <h1 className="text-6xl md:text-7xl mb-2">🏆</h1>
              <h2 className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 text-center text-4xl md:text-6xl font-black mb-10 tracking-wide drop-shadow">
                ¡Campeonas Lilihoot!
              </h2>
            </motion.div>
          ) : (
            <h2 className="text-white/40 text-center text-3xl font-bold mb-10">
              Posiciones Finales
            </h2>
          )}
        </div>

        <div className="bg-white/5 backdrop-blur-2xl rounded-[36px] p-6 md:p-10 shadow-2xl w-full max-w-4xl z-10 border border-white/10">
          
          {/* PODIO PRINCIPAL (TOP 3) */}
          <div className="flex flex-col md:flex-row items-center md:items-end justify-center gap-8 md:gap-6 mb-12">
            
            {/* TERCER LUGAR (Visible en fases: third, second, first) */}
            <AnimatePresence>
              {(phase === "third" || phase === "second" || phase === "first") && leaderboard[2] && (
                <motion.div 
                  variants={podiumCardVariants}
                  initial="hidden"
                  animate="visible"
                  className="flex flex-col items-center text-center order-3 w-full md:w-auto"
                >
                  <h2 className="text-4xl md:text-5xl mb-2">🥉</h2>
                  <p className="text-white text-xl md:text-2xl mb-2 font-medium">
                    {leaderboard[2].name}
                  </p>
                  
                  {/* PC Bloque Bronce */}
                  <div className="hidden md:flex h-28 w-32 bg-gradient-to-b from-orange-400 to-orange-700 rounded-t-2xl items-center justify-center text-white font-extrabold text-xl shadow-lg border-t border-orange-300/30">
                    {leaderboard[2].score}
                  </div>
                  {/* Móvil Tarjeta Bronce */}
                  <div className="md:hidden w-full max-w-xs bg-gradient-to-r from-orange-400/20 to-orange-700/20 border border-orange-500/40 p-3 rounded-xl text-orange-300 font-bold">
                    {leaderboard[2].score} pts
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* SEGUNDO LUGAR (Visible en fases: second, first) */}
            <AnimatePresence>
              {(phase === "second" || phase === "first") && leaderboard[1] && (
                <motion.div 
                  variants={podiumCardVariants}
                  initial="hidden"
                  animate="visible"
                  className="flex flex-col items-center text-center order-2 w-full md:w-auto"
                >
                  <h2 className="text-4xl md:text-5xl mb-2">🥈</h2>
                  <p className="text-white text-xl md:text-2xl mb-2 font-semibold">
                    {leaderboard[1].name}
                  </p>
                  
                  {/* PC Bloque Plata */}
                  <div className="hidden md:flex h-40 w-32 bg-gradient-to-b from-slate-300 to-slate-500 rounded-t-2xl items-center justify-center text-white font-extrabold text-2xl shadow-lg border-t border-slate-200/40">
                    {leaderboard[1].score}
                  </div>
                  {/* Móvil Tarjeta Plata */}
                  <div className="md:hidden w-full max-w-xs bg-gradient-to-r from-slate-400/20 to-slate-500/20 border border-slate-300/40 p-3 rounded-xl text-slate-300 font-bold">
                    {leaderboard[1].score} pts
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* PRIMER LUGAR (Solo visible en la fase final: first) */}
            <AnimatePresence>
              {phase === "first" && leaderboard[0] && (
                <motion.div 
                  variants={podiumCardVariants}
                  initial="hidden"
                  animate="visible"
                  className="flex flex-col items-center text-center order-1 w-full md:w-auto mb-4 md:mb-0"
                >
                  {/* Animación de flotado continuo y glow dorado para el rey del podio */}
                  <motion.div
                    animate={{ y: [0, -15, 0], scale: [1, 1.04, 1] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    className="flex flex-col items-center select-none"
                  >
                    <h2 className="text-5xl md:text-6xl mb-1 filter drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]">👑</h2>
                    <h2 className="text-4xl md:text-5xl mb-2">🥇</h2>
                    <p className="text-yellow-400 text-2xl md:text-4xl font-black mb-3 tracking-wide drop-shadow-md">
                      {leaderboard[0].name}
                    </p>

                    {/* PC Bloque Oro con súper resplandor */}
                    <div className="hidden md:flex h-56 w-36 bg-gradient-to-b from-yellow-400 to-amber-500 rounded-t-2xl items-center justify-center text-white font-black text-3xl shadow-[0_0_60px_rgba(255,215,0,0.6)] border-t border-yellow-200">
                      {leaderboard[0].score}
                    </div>
                  </motion.div>

                  {/* Móvil Tarjeta Oro */}
                  <div className="md:hidden w-full max-w-xs bg-yellow-500/20 border-2 border-yellow-400 p-4 rounded-xl text-yellow-300 font-black text-2xl shadow-[0_0_25px_rgba(250,204,21,0.4)]">
                    {leaderboard[0].score} pts
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>

          {/* LISTADO RESTANTE DEL TOP (4 en adelante - Solo aparece en la fase final 'first') */}
          {phase === "first" && leaderboard.length > 3 && (
            <div className="mt-10 border-t border-white/10 pt-8 max-w-2xl mx-auto space-y-3">
              <h3 className="text-slate-400 font-bold text-sm uppercase tracking-wider mb-4 px-2">
                Resto de competidoras
              </h3>
              {leaderboard.slice(3).map((player, index) => (
                <motion.div
                  key={player.id}
                  custom={index}
                  variants={listRowVariants}
                  initial="hidden"
                  animate="visible"
                  className="flex justify-between items-center bg-white/5 hover:bg-white/10 transition-colors p-4 rounded-2xl border border-white/5 shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-zinc-500 font-bold text-lg w-6">
                      {index + 4}️⃣
                    </span>
                    <span className="text-white font-semibold text-base md:text-lg">
                      {player.name}
                    </span>
                  </div>
                  <span className="font-mono font-black text-fuchsia-400 bg-fuchsia-500/10 px-3 py-1 rounded-lg border border-fuchsia-500/20">
                    {player.score}
                  </span>
                </motion.div>
              ))}
            </div>
          )}

        </div>
      </div>
    </>
  );
}