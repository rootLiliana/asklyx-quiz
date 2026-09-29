import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { API } from "../config/api";
import { studentFetch } from "../lib/studentSession";
import type { IceBreaker } from "../types/IceBreaker";
import type { QuestionResponse } from "../types/QuestionResponse";

const POLL_MS = 2000;

// Sala de espera. Se pasa al quiz en cuanto el juego empieza (haya o no
// rompehielos) o cuando la host cierra el rompehielos.
export default function IceBreakerPage() {
  const navigate = useNavigate();
  const code = localStorage.getItem("gameCode");

  const [icebreaker, setIcebreaker] = useState<IceBreaker | null>(null);
  const [missing, setMissing] = useState(!code);
  const [answer, setAnswer] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    const encoded = encodeURIComponent(code);

    const load = () => {
      Promise.all([fetch(`${API}/games/${encoded}/question`), fetch(`${API}/games/${encoded}/icebreaker`)])
        .then(async ([questionResponse, icebreakerResponse]) => {
          if (cancelled) return;
          if (questionResponse.status === 404) { setMissing(true); return; }

          if (questionResponse.ok) {
            const status: QuestionResponse = await questionResponse.json();
            if (!("waiting" in status)) { navigate("/quiz"); return; }
          }

          if (icebreakerResponse.ok) {
            const data: IceBreaker = await icebreakerResponse.json();
            if (cancelled) return;
            if (!data.active) { navigate("/quiz"); return; }
            setIcebreaker(data);
          } else if (icebreakerResponse.status === 404) {
            setIcebreaker(null);
          }
        })
        .catch((err: unknown) => console.error("Error cargando la sala:", err));
    };

    load();
    const interval = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [code, navigate]);

  const submitAnswer = async () => {
    if (!code || !answer.trim()) return;

    setSending(true);
    setError("");
    try {
      const response = await studentFetch(`/games/${encodeURIComponent(code)}/icebreaker/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: answer.trim() }),
      });

      if (response.status === 401 || response.status === 403) { navigate("/join"); return; }
      // 400 aquí significa "ya habías respondido": para el jugador es lo mismo.
      if (response.ok || response.status === 400) { setSent(true); return; }
      setError("No pudimos enviar tu respuesta. Intenta otra vez.");
    } catch (err) {
      console.error("Error enviando respuesta del rompehielos:", err);
      setError("Sin conexión. Revisa tu internet e intenta otra vez.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-purple-900 via-indigo-900 to-black flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 sm:p-10 w-full max-w-3xl">
        <h1 className="text-white text-4xl sm:text-5xl font-bold text-center mb-8 sm:mb-10">💬 Ice Breaker</h1>

        {missing ? (
          <div className="text-center text-white space-y-4">
            <p className="text-6xl">🔌</p>
            <h2 className="text-2xl font-bold">Este juego ya no está disponible</h2>
            <button onClick={() => navigate("/join")} className="rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 px-6 py-3 font-bold">
              Volver a entrar
            </button>
          </div>
        ) : !icebreaker ? (
          <div className="text-center text-white space-y-4">
            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="text-6xl">
              ⏳
            </motion.div>
            <h2 className="text-2xl font-bold text-fuchsia-300">¡Ya estás en la sala!</h2>
            <p className="text-gray-300">Esperando a que empiece el juego...</p>
          </div>
        ) : (
          <>
            <h2 className="text-fuchsia-300 text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8 break-words">
              {icebreaker.question}
            </h2>

            {!sent ? (
              <>
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  maxLength={500}
                  placeholder="Escribe tu respuesta abierta aquí..."
                  className="w-full h-40 rounded-xl p-4 sm:p-5 text-black text-base sm:text-lg focus:outline-none focus:ring-4 focus:ring-fuchsia-400"
                />
                {error && <p className="mt-3 text-center text-amber-300">{error}</p>}
                <button
                  onClick={() => void submitAnswer()}
                  disabled={!answer.trim() || sending}
                  className="mt-6 w-full rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 transition-all text-white font-bold p-4 text-lg disabled:opacity-50"
                >
                  {sending ? "Enviando..." : "Enviar Respuesta"}
                </button>
              </>
            ) : (
              <div className="text-center text-white">
                <h2 className="text-5xl mb-4">🎉</h2>
                <p className="text-2xl font-bold text-green-400">¡Respuesta enviada con éxito!</p>
                <p className="mt-4 text-lg text-gray-300">
                  Mira la pantalla principal para ver lo que opinan tus compañeros. El quiz comenzará en breve...
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
