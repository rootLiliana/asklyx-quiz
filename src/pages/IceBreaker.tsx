import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "../config/api";
import type { IceBreaker } from "../types/IceBreaker";
import { motion } from "framer-motion";


export default function IceBreaker() {
const [icebreaker, setIcebreaker] =
  useState<IceBreaker | null>(null);

const [answer, setAnswer] =
  useState("");

const [sent, setSent] =
  useState(false);

const navigate = useNavigate();

const code =
  localStorage.getItem("gameCode");

const loadIceBreaker = useCallback(async () => {
  if (!code) return;

  try {
    const response = await fetch(`${API}/games/${code}/icebreaker`);

    if (response.status === 404) {
      setIcebreaker(null); 
      return;
    }

    if (!response.ok) return;

    const data = await response.json();

    if (data && data.active === false) {
      navigate("/quiz");
      return;
    }

    setIcebreaker(data);
  } catch (error) {
    console.error("Error cargando el IceBreaker:", error);
  }
}, [code, navigate]);

useEffect(() => {

  void loadIceBreaker();

  const interval =
    setInterval(() => {
      void loadIceBreaker();
    }, 2000);

  return () =>
    clearInterval(interval);

}, [loadIceBreaker]);

const submitAnswer = async () => {

  const playerName =
    localStorage.getItem("playerName");

  if (!playerName) return;

  await fetch(
    `${API}/games/${code}/icebreaker/answer`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        playerName,
        text: answer,
      }),
    }
  );

  setSent(true);

};

return (
  <div
    className="
      min-h-screen
      bg-gradient-to-br
      from-purple-900
      via-indigo-900
      to-black
      flex
      items-center
      justify-center
      p-6
    "
  >
    <div
      className="
        bg-white/10
        backdrop-blur-xl
        rounded-3xl
        p-10
        w-full
        max-w-3xl
      "
    >
      <h1 className="text-white text-5xl font-bold text-center mb-10">
        💬 Ice Breaker
      </h1>

      {!icebreaker ? (
        <div className="text-center text-white space-y-4">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-6xl"
          >
            ⏳
          </motion.div>
          <h2 className="text-2xl font-bold text-fuchsia-300">
            ¡Ya estás en la sala!
          </h2>
          <p className="text-gray-300">
            Esperando a que el LiliHost lance la pregunta ...
          </p>
        </div>
      ) : (
        <>
          <h2 className="text-fuchsia-300 text-3xl font-bold text-center mb-8">
            {icebreaker.question}
          </h2>

          {!sent ? (
            <>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Escribe tu respuesta abierta aquí..."
                className="w-full h-40 rounded-xl p-5 text-black text-lg focus:outline-none focus:ring-4 focus:ring-fuchsia-400"
              />

              <button
                onClick={submitAnswer}
                disabled={!answer.trim()}
                className="mt-6 w-full rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 transition-all text-white font-bold p-4 text-lg disabled:opacity-50"
              >
                Enviar Respuesta
              </button>
            </>
          ) : (
            /* CASO 3: El alumno ya respondió y espera que empiece la trivia de Pandas */
            <div className="text-center text-white">
              <h2 className="text-5xl mb-4">🎉</h2>
              <p className="text-2xl font-bold text-green-400">
                ¡Respuesta enviada con éxito!
              </p>
              <p className="mt-4 text-lg text-gray-300">
                Mira la pantalla principal para ver lo que opinan tus compañeras. 
                El quiz comenzará en breve...
              </p>
            </div>
          )}
        </>
      )}
    </div>
  </div>
)}