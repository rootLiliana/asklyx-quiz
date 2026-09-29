import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { API } from "../config/api";
import { studentFetch } from "../lib/studentSession";
import type { QuestionResponse, StudentQuestion } from "../types/QuestionResponse";
import type { SubmitAnswerResponse } from "../types/SubmitAnswerResponse";

type Screen = "loading" | "waiting" | "question" | "finished" | "missing";

const POLL_MS = 2000;

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-gradient-to-br from-purple-900 via-indigo-900 to-black flex items-center justify-center p-4 sm:p-6">
      {children}
    </div>
  );
}

export default function Quiz() {
  const navigate = useNavigate();
  const code = localStorage.getItem("gameCode");

  const [screen, setScreen] = useState<Screen>(code ? "loading" : "missing");
  const [question, setQuestion] = useState<StudentQuestion | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState<SubmitAnswerResponse | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const questionId = useRef<string | null>(null);

  // Estado del juego cada 2 s. Una pregunta nueva reinicia la pantalla y
  // sincroniza el cronómetro con el tiempo que calcula el servidor.
  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    const load = () => {
      fetch(`${API}/games/${encodeURIComponent(code)}/question`)
        .then(async (response) => {
          if (cancelled) return;
          if (response.status === 404) { setScreen("missing"); return; }
          if (!response.ok) return; // falla puntual: se reintenta en el siguiente ciclo

          const data: QuestionResponse = await response.json();
          if (cancelled) return;
          if ("waiting" in data) { setScreen("waiting"); return; }
          if ("finished" in data) { setScreen("finished"); return; }

          if (questionId.current !== data.id) {
            questionId.current = data.id;
            setTimeLeft(data.remainingSeconds);
            setResult(null);
            setChosen(null);
            setNotice("");
          }
          setQuestion(data);
          setScreen("question");
        })
        .catch((error: unknown) => console.error("Error cargando la pregunta:", error));
    };

    load();
    const interval = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [code]);

  useEffect(() => {
    if (screen === "finished") navigate("/podium");
  }, [screen, navigate]);

  useEffect(() => {
    if (screen !== "question" || result || timeLeft <= 0) return;
    const timer = setTimeout(() => setTimeLeft((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearTimeout(timer);
  }, [screen, result, timeLeft]);

  const submitAnswer = async (answer: number) => {
    if (!question || !code || result || sending) return;

    setSending(true);
    setChosen(answer);
    setNotice("");
    try {
      const response = await studentFetch(`/games/${encodeURIComponent(code)}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, answer }),
      });

      if (response.status === 401 || response.status === 403) {
        navigate("/join");
        return;
      }
      if (response.status === 409) {
        setChosen(null);
        setNotice("La pregunta cambió justo antes de tu respuesta. ¡Contesta la nueva!");
        return;
      }
      if (!response.ok) {
        setChosen(null);
        setNotice("No pudimos enviar tu respuesta. Intenta otra vez.");
        return;
      }

      setResult(await response.json());
    } catch (error) {
      console.error("Error enviando respuesta:", error);
      setChosen(null);
      setNotice("Sin conexión. Revisa tu internet e intenta otra vez.");
    } finally {
      setSending(false);
    }
  };

  if (screen === "missing") {
    return (
      <Shell>
        <div className="text-center text-white max-w-md">
          <p className="text-6xl mb-4">🔌</p>
          <h1 className="text-2xl font-bold mb-3">Este juego ya no está disponible</h1>
          <p className="text-white/70 mb-6">Pide a tu profe el código del juego y vuelve a entrar.</p>
          <button onClick={() => navigate("/join")} className="rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 px-6 py-3 font-bold">
            Volver a entrar
          </button>
        </div>
      </Shell>
    );
  }

  if (screen !== "question" || !question) {
    return (
      <Shell>
        <motion.h1
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-white text-3xl sm:text-4xl font-bold text-center"
        >
          {screen === "waiting" ? "🎮 Esperando al experto..." : "⏳ Cargando..."}
        </motion.h1>
      </Shell>
    );
  }

  const timeIsUp = timeLeft <= 0 && !result;
  const locked = Boolean(result) || sending || timeIsUp;
  const headline = result
    ? result.alreadyAnswered ? "⚠️ Ya habías respondido esta pregunta."
      : result.timeUp ? "⌛ Se acabó el tiempo"
        : result.correct ? "✅ Correcto" : "❌ Incorrecto"
    : timeIsUp ? "⌛ Tiempo agotado" : "";

  const optionClass = (index: number) => {
    if (result && index === result.correctAnswer) return "from-green-500 to-emerald-600 ring-4 ring-green-300";
    if (result && index === chosen) return "from-red-500 to-rose-600 opacity-90";
    if (locked) return "from-fuchsia-500/60 to-purple-600/60";
    return "from-fuchsia-500 to-purple-600";
  };

  return (
    <Shell>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white/10 backdrop-blur-xl rounded-3xl p-5 sm:p-8 shadow-2xl w-full max-w-4xl"
      >
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h2 className="text-white text-lg sm:text-xl font-bold">Pregunta</h2>
          <p className="text-fuchsia-300 font-bold text-lg sm:text-xl">⚡ {result ? result.score : timeLeft * 100} pts</p>
        </div>

        <motion.div
          animate={timeLeft <= 3 && !result ? { scale: [1, 1.1, 1] } : { scale: 1 }}
          transition={{ repeat: timeLeft <= 3 && !result ? Infinity : 0, duration: 0.8 }}
          className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-fuchsia-400 flex items-center justify-center text-white text-3xl sm:text-4xl font-bold mx-auto mb-6 sm:mb-8"
        >
          {timeLeft}
        </motion.div>

        <h1 className="text-white text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-10 break-words">
          {question.text}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {question.options.map((option, index) => (
            <motion.button
              key={index}
              whileTap={locked ? undefined : { scale: 0.96 }}
              disabled={locked}
              onClick={() => void submitAnswer(index)}
              className={`p-4 sm:p-6 rounded-2xl bg-gradient-to-r text-white text-lg sm:text-xl font-bold shadow-xl break-words transition disabled:cursor-default ${optionClass(index)}`}
            >
              {option}
            </motion.button>
          ))}
        </div>

        {(headline || notice) && (
          <div className="mt-6 sm:mt-8 text-center">
            {headline && <h2 className="text-2xl sm:text-3xl font-bold text-white">{headline}</h2>}
            {notice && <p className="mt-2 text-amber-300">{notice}</p>}
          </div>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 sm:mt-8 p-5 sm:p-6 rounded-2xl bg-white/10 border border-fuchsia-400/30 text-white"
          >
            <h3 className={`text-xl sm:text-2xl font-bold mb-3 ${result.correct ? "text-green-400" : "text-red-400"}`}>
              {result.correct ? "🎉 ¡Excelente!" : "📚 Aprendamos"}
            </h3>
            <p className="text-xl sm:text-2xl font-bold text-green-300 mb-4 break-words">{question.options[result.correctAnswer]}</p>
            {result.explanation && <p className="text-base sm:text-lg leading-relaxed">💡 {result.explanation}</p>}
          </motion.div>
        )}
      </motion.div>
    </Shell>
  );
}
