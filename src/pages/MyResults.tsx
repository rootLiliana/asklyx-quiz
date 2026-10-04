import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { studentFetch } from "../lib/studentSession";
import { percentageBarClass, percentageTextClass } from "../lib/percentage";
import type { StudentPracticeSummary } from "../types/Practice";
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
  // La práctica va aparte: no cuenta en el promedio de los quizzes en vivo.
  const [practice, setPractice] = useState<StudentPracticeSummary[] | null>(null);

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

    // Si falla, la sección de práctica simplemente no aparece.
    studentFetch("/me/practice")
      .then(async (response) => {
        if (!response.ok) throw new Error(`status ${response.status}`);
        const data: StudentPracticeSummary[] = await response.json();
        if (!cancelled) setPractice(data);
      })
      .catch((err: unknown) => console.error("Error cargando mis prácticas:", err));

    return () => { cancelled = true; };
  }, [navigate]);

  const practiced = practice?.filter((item) => item.attempts > 0).length ?? 0;

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

          <h2 className="text-lg font-bold text-white/90 mb-3">🎮 Quizzes en vivo</h2>

          {history && history.entries.length === 0 && (
            <p className="text-white/70 text-center py-6">
              Todavía no tienes resultados. Aparecen cuando terminas un quiz en clase. 🎮
            </p>
          )}

          {history && history.averagePercentage !== null && (
            <div className="mb-6 rounded-2xl bg-black/20 p-5 text-center">
              <p className="text-sm text-white/70">Tu promedio de aciertos en vivo</p>
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

          {practice && practice.length > 0 && (
            <section className="mt-8 border-t border-white/10 pt-6">
              <h2 className="text-lg font-bold text-white/90">✏️ Mis prácticas</h2>
              <p className="text-sm text-white/60 mb-4">
                Llevas {practiced} de {practice.length} {practice.length === 1 ? "práctica" : "prácticas"}. No cuentan en tu promedio: puedes repetirlas las veces que quieras.
              </p>
              <div className="grid grid-cols-1 gap-3">
                {practice.map((item) => (
                  <button
                    key={item.quizId}
                    onClick={() => navigate(`/practica/${item.quizId}`)}
                    className="rounded-2xl bg-white/5 hover:bg-white/10 p-4 text-left transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold break-words">{item.title}</p>
                        <p className="text-xs text-white/60 break-words">{item.lessonName}</p>
                      </div>
                      {item.bestPercentage === null ? (
                        <span className="shrink-0 rounded-full bg-fuchsia-600/80 px-3 py-1 text-xs font-bold">Pendiente</span>
                      ) : (
                        <p className="shrink-0 text-right">
                          <span className={`text-xl font-black ${percentageTextClass(item.bestPercentage)}`}>{item.bestPercentage}%</span>
                          <span className="block text-xs text-white/60">
                            tu mejor · {item.attempts} {item.attempts === 1 ? "intento" : "intentos"}
                          </span>
                        </p>
                      )}
                    </div>
                    {item.bestPercentage !== null && (
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/30">
                        <div className={`h-full rounded-full ${percentageBarClass(item.bestPercentage)}`} style={{ width: `${item.bestPercentage}%` }} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </motion.div>
    </div>
  );
}
