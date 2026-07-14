import {
  useCallback,
  useEffect,
  useState,
} from "react";

import Confetti from "react-confetti";

import { API } from "../config/api";

import type { Player } from "../types/Player";

import { motion } from "framer-motion";

export default function Podium() {

  const [leaderboard, setLeaderboard] =
    useState<Player[]>([]); 

const [windowSize] =
useState({
  width: window.innerWidth,
  height: window.innerHeight,
});


const code =
localStorage.getItem("gameCode");


const loadLeaderboard =
useCallback(async () => {

if (!code) return;

const response =
await fetch(
`${API}/games/${code}/leaderboard`
);

const data =
await response.json();

setLeaderboard(data);

}, [code]);

useEffect(() => {

void loadLeaderboard();

}, [loadLeaderboard]);

      return (
      <>
        <Confetti
          width={windowSize.width || 300}
          height={windowSize.height || 600}
          recycle={true}
          numberOfPieces={250}
        />

        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-black flex items-center justify-center p-4 md:p-6">
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 md:p-10 shadow-2xl w-full max-w-4xl z-10">

            <h1 className="text-5xl md:text-6xl text-center mb-4">🏆</h1>

            <h2 className="text-white text-center text-3xl md:text-5xl font-bold mb-10 md:mb-16">
              🏆 Campeonas Lilihoot 🏆
            </h2>

            {/* Contenedor del podio responsivo */}
            <div className="flex flex-col md:flex-row items-center md:items-end justify-center gap-8 md:gap-6">

              {/* SEGUNDO LUGAR (Aparece a la izquierda en PC [order-2], o segundo en móvil [order-2]) */}
              <div className="flex flex-col items-center text-center order-2 w-full md:w-auto">
                <h2 className="text-4xl md:text-5xl mb-2">🥈</h2>
                <p className="text-white text-xl md:text-2xl mb-2 font-semibold">
                  {leaderboard[1]?.name}
                </p>
                {/* En móvil se oculta el bloque alto y se muestra una etiqueta compacta, en PC vuelve el bloque */}
                <div className="hidden md:flex h-40 w-32 bg-slate-400 rounded-t-xl items-center justify-center text-white font-bold text-xl">
                  {leaderboard[1]?.score}
                </div>
                <div className="md:hidden w-full max-w-xs bg-slate-400/30 border border-slate-400/50 p-3 rounded-xl text-white font-bold">
                  {leaderboard[1]?.score} pts
                </div>
              </div>

              {/* PRIMER LUGAR (Aparece en el centro en PC [order-1 o order-2 dependiendo del flex-row], en móvil primero [order-1]) */}
              <div className="flex flex-col items-center text-center order-1 w-full md:w-auto mb-4 md:mb-0">
                <h2 className="text-5xl md:text-6xl mb-1">👑</h2>
                <h2 className="text-4xl md:text-5xl mb-2">🥇</h2>
                <motion.p
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="text-yellow-400 text-2xl md:text-3xl font-black mb-3 tracking-wide"
                >
                  {leaderboard[0]?.name}
                </motion.p>

                {/* Bloque para PC */}
                <motion.div
                  animate={{
                    y: [0, -8, 0],
                    boxShadow: [
                      "0 0 10px #facc15",
                      "0 0 35px #facc15",
                      "0 0 10px #facc15",
                    ],
                  }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="hidden md:flex h-56 w-36 bg-yellow-500 rounded-t-xl items-center justify-center text-white font-bold text-2xl"
                >
                  {leaderboard[0]?.score}
                </motion.div>

                {/* Tarjeta para Móvil */}
                <div className="md:hidden w-full max-w-xs bg-yellow-500/30 border-2 border-yellow-400 p-4 rounded-xl text-yellow-300 font-extrabold text-xl shadow-[0_0_15px_rgba(250,204,21,0.3)]">
                  {leaderboard[0]?.score} pts
                </div>
              </div>

              {/* TERCER LUGAR (Aparece a la derecha en PC [order-3], o tercero en móvil [order-3]) */}
              <div className="flex flex-col items-center text-center order-3 w-full md:w-auto">
                <h2 className="text-4xl md:text-5xl mb-2">🥉</h2>
                <p className="text-white text-xl md:text-2xl mb-2">
                  {leaderboard[2]?.name}
                </p>
                {/* Bloque para PC */}
                <div className="hidden md:flex h-28 w-32 bg-orange-700 rounded-t-xl items-center justify-center text-white font-bold text-lg">
                  {leaderboard[2]?.score}
                </div>
                {/* Tarjeta para Móvil */}
                <div className="md:hidden w-full max-w-xs bg-orange-700/30 border border-orange-700/50 p-3 rounded-xl text-white font-semibold">
                  {leaderboard[2]?.score} pts
                </div>
              </div>

            </div> {/* <-- Aquí se cierra correctamente el contenedor de las tarjetas */}
          </div>
        </div>
      </>
    );

}