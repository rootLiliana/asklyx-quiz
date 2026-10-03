import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { studentFetch } from "../lib/studentSession";
import { percentageBarClass, percentageTextClass } from "../lib/percentage";
import type { StudentHistory } from "../types/Results";

function formatPlayedAt(playedAt: string | null): string {
  if (!playedAt) return "—";
  return new Date(playedAt).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

// Solo los resultados de quien tiene la sesión (el servidor lo toma del token).
export default function MyResults() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<StudentHistory | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    studentFetch("/me/results")
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) { navigate("/join"); return; }
        if (!response.ok) throw new Error(`status ${response.status}`);
        const data: StudentHistory = await response.json();
        if (!cancelled) setHistory(data);
      })
      .catch((err: unknown) => {
        console.error("Error cargando mis resultados:", err);
        if (!cancelled) setError(true);
      });

    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="min-h-dvh bg-gradient-to-br from-purple-900 via-indigo-900 to-black px-4 py-8 sm:p-8 flex justify-center">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        <button onClick={() => navigate("/join")} className="text-white/60 text-sm mb-4 hover:text-white transition">
          ← Volver
        </button>

        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 sm:p-8 text-white shadow-2xl">
          <h1 className="text-3xl sm:text-4xl font-bold mb-6">📊 Mis resultados</h1>

          {error && <p className="text-red-300">No pudimos cargar tus resultados. Intenta más tarde.</p>}
          {!history && !error && <p className="text-white/70">Cargando...</p>}

          {history && history.entries.length === 0 && (
            <p className="text-white/70 text-center py-6">
              Todavía no tienes resultados. Aparecen cuando terminas un quiz en clase. 🎮
            </p>
          )}

          {history && history.averagePercentage !== null && (
            <div className="mb-6 rounded-2xl bg-black/20 p-5 text-center">
              <p className="text-sm text-white/70">Tu promedio de aciertos</p>
              <p className={`text-6xl font-black ${percentageTextClass(history.averagePercentage)}`}>{history.averagePercentage}%</p>
              <p className="text-xs text-white/60 mt-1">
                en {history.entries.length} {history.entries.length === 1 ? "quiz" : "quizzes"}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3">
            {history?.entries.map((entry) => (
              <div key={entry.sessionId} className="rounded-2xl bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold break-words">{entry.quizTitle}</p>
                    <p className="text-xs text-white/60">{formatPlayedAt(entry.playedAt)} · {entry.className}</p>
                  </div>
                  <p className="shrink-0 text-right">
                    <span className={`text-xl font-black ${percentageTextClass(entry.percentage)}`}>{entry.percentage}%</span>
                    <span className="block text-xs text-white/60">{entry.correctAnswers}/{entry.totalQuestions} aciertos</span>
                  </p>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/30">
                  <div className={`h-full rounded-full ${percentageBarClass(entry.percentage)}`} style={{ width: `${entry.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
