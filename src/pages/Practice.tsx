import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import PracticePlayer from "../components/practice/PracticePlayer";
import { studentFetch } from "../lib/studentSession";
import type { PracticeEngine, PublicPracticeQuiz } from "../types/Practice";

function Shell({ children, onBack }: { children: ReactNode; onBack: () => void }) {
  return (
    <div className="min-h-dvh bg-gradient-to-br from-purple-900 via-indigo-900 to-black px-4 py-8 sm:p-8 flex justify-center">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-3xl">
        <button onClick={onBack} className="text-white/60 text-sm mb-4 hover:text-white transition">← Volver a Mi grupo</button>
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-5 sm:p-8 text-white shadow-2xl">{children}</div>
      </motion.div>
    </div>
  );
}

// Práctica de la alumna: el servidor califica y guarda cada intento.
export default function Practice() {
  const { quizId = "" } = useParams();
  const navigate = useNavigate();
  const goBack = () => navigate("/mi-grupo");

  const [quiz, setQuiz] = useState<PublicPracticeQuiz | null>(null);
  const [loadError, setLoadError] = useState(false);
  const attemptId = useRef("");

  useEffect(() => {
    let cancelled = false;

    studentFetch(`/me/practice/${encodeURIComponent(quizId)}`)
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) { navigate("/join"); return; }
        if (!response.ok) throw new Error(`status ${response.status}`);
        const data: PublicPracticeQuiz = await response.json();
        if (!cancelled) setQuiz(data);
      })
      .catch((err: unknown) => {
        console.error("Error abriendo práctica:", err);
        if (!cancelled) setLoadError(true);
      });

    return () => { cancelled = true; };
  }, [quizId, navigate]);

  const engine: PracticeEngine = useMemo(() => {
    const post = async <T,>(path: string, body: unknown = {}): Promise<T> => {
      let response: Response;
      try {
        response = await studentFetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        throw new Error("Sin conexión. Revisa tu internet e intenta otra vez.");
      }
      if (response.status === 401 || response.status === 403) {
        navigate("/join");
        throw new Error("Tu sesión expiró.");
      }
      if (!response.ok) {
        throw new Error(response.status === 400 ? "Revisa tu respuesta e intenta de nuevo." : "No pudimos guardar. Intenta otra vez.");
      }
      return await response.json() as T;
    };

    return {
      async start() {
        const result = await post<{ attemptId: string; quiz: PublicPracticeQuiz }>(`/me/practice/${encodeURIComponent(quizId)}/attempts`);
        attemptId.current = result.attemptId;
        return result.quiz;
      },
      answer: (input) => post(`/me/practice-attempts/${attemptId.current}/answers`, input),
      reveal: (questionId, answerText) => post(`/me/practice-attempts/${attemptId.current}/reveal`, { questionId, answerText }),
      finish: () => post(`/me/practice-attempts/${attemptId.current}/finish`),
    };
  }, [quizId, navigate]);

  return (
    <Shell onBack={goBack}>
      {loadError ? (
        <p className="text-red-300">Esta práctica no está disponible.</p>
      ) : !quiz ? (
        <p className="text-white/70">Cargando...</p>
      ) : (
        <PracticePlayer quiz={quiz} engine={engine} onExit={goBack} exitLabel="Volver a Mi grupo" />
      )}
    </Shell>
  );
}
