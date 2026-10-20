import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Confetti from "react-confetti";
import { API } from "../config/api";
import { studentFetch } from "../lib/studentSession";
import { Button, Card, LoadingDots, Owl, Screen, Spinner, TimerRing } from "../components/ui";
import type { QuestionResponse, StudentQuestion } from "../types/QuestionResponse";
import type { SubmitAnswerResponse } from "../types/SubmitAnswerResponse";

type View = "loading" | "waiting" | "question" | "finished" | "missing";

const POLL_MS = 2000;
const LETTERS = ["A", "B", "C", "D", "E", "F"];

export default function Quiz() {
  const navigate = useNavigate();
  const code = localStorage.getItem("gameCode");
  const nickname = localStorage.getItem("studentNickname");

  const [screen, setScreen] = useState<View>(code ? "loading" : "missing");
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
      <Screen center>
        <Card initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid max-w-md justify-items-center gap-4 p-8 text-center">
          <Owl className="size-20" blink={false} />
          <h1 className="m-0 font-display text-3xl font-semibold">Este juego ya no está disponible</h1>
          <p className="m-0 text-slate-300">Pide a tu profe el código del juego y vuelve a entrar.</p>
          <Button onClick={() => navigate("/join")} size="lg">
            Volver a entrar
          </Button>
        </Card>
      </Screen>
    );
  }

  if (screen !== "question" || !question) {
    return (
      <Screen center>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid justify-items-center gap-5 text-center">
          <Owl className="size-28 animate-float" />
          {screen === "waiting" ? (
            <>
              <h1 className="m-0 font-display text-4xl font-semibold sm:text-5xl">
                {nickname ? `¡Lista, ${nickname}!` : "¡Ya estás dentro!"}
              </h1>
              <p className="m-0 flex items-center gap-3 text-lg text-slate-200">
                Esperando a que la host empiece <LoadingDots />
              </p>
              <p className="m-0 max-w-sm text-sm text-slate-400">
                Contesta rápido: entre más tiempo te quede, más puntos ganas.
              </p>
            </>
          ) : (
            <p className="m-0 flex items-center gap-3 text-lg text-slate-200">
              <Spinner className="size-5" /> Cargando…
            </p>
          )}
        </motion.div>
      </Screen>
    );
  }

  const timeIsUp = timeLeft <= 0 && !result;
  const locked = Boolean(result) || sending || timeIsUp;

  const optionClass = (index: number) => {
    if (result && index === result.correctAnswer) return "from-green-500 to-emerald-600 ring-4 ring-green-300 shadow-glow-green";
    if (result && index === chosen) return "from-red-500 to-rose-600";
    if (index === chosen && sending) return "from-fuchsia-400 to-purple-500 ring-4 ring-fuchsia-200";
    if (locked) return "from-fuchsia-500/40 to-purple-600/40 text-white/70";
    return "from-fuchsia-500 to-purple-600 shadow-glow hover:from-fuchsia-400 hover:to-purple-500";
  };

  const verdict = result
    ? result.alreadyAnswered
      ? { tone: "info", title: "Ya habías respondido", text: "Solo cuenta tu primera respuesta." }
      : result.timeUp
        ? { tone: "bad", title: "Se acabó el tiempo", text: "Esta respuesta llegó tarde y vale 0 puntos." }
        : result.correct
          ? { tone: "good", title: "¡Correcto!", text: `Llevas ${result.score} puntos.` }
          : { tone: "bad", title: "Esta vez no", text: `Llevas ${result.score} puntos. ¡La siguiente es tuya!` }
    : timeIsUp
      ? { tone: "bad", title: "Tiempo agotado", text: "Espera la siguiente pregunta." }
      : null;

  const celebrate = Boolean(result?.correct && !result.alreadyAnswered);

  return (
    <Screen center>
      {celebrate && (
        <Confetti
          recycle={false}
          numberOfPieces={160}
          gravity={0.25}
          colors={["#D946EF", "#F0ABFC", "#FACC15", "#FCD34D", "#22C55E"]}
          className="pointer-events-none !fixed inset-0"
        />
      )}

      <motion.main key={question.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="grid w-full max-w-4xl gap-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Owl className="size-9" blink={false} />
            <span className="font-display text-lg font-semibold text-slate-200">{nickname ?? "Pregunta"}</span>
          </div>
          <span className="rounded-full border border-yellow-400/40 bg-yellow-400/10 px-4 py-1.5 text-sm font-extrabold text-yellow-300 tabular-nums">
            {result ? `${result.score} pts` : timeIsUp ? "0 pts" : `vale ${timeLeft * 100} pts`}
          </span>
        </div>

        <Card className="grid justify-items-center gap-5 p-5 sm:p-8">
          <TimerRing seconds={timeLeft} total={question.durationSeconds} />
          <h1 className="m-0 text-balance text-center font-display text-2xl font-semibold leading-tight break-words sm:text-4xl">
            {question.text}
          </h1>
        </Card>

        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
          {question.options.map((option, index) => (
            <motion.button
              key={index}
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={result && index === chosen && !result.correct ? { opacity: 1, y: 0, x: [0, -6, 6, -4, 0] } : { opacity: 1, y: 0 }}
              transition={{ delay: result ? 0 : 0.05 * index }}
              whileTap={locked ? undefined : { scale: 0.97 }}
              disabled={locked}
              onClick={() => void submitAnswer(index)}
              className={`flex min-h-20 items-center gap-4 rounded-2xl bg-gradient-to-r p-4 text-left text-lg font-bold break-words transition disabled:cursor-default sm:p-5 sm:text-xl ${optionClass(index)}`}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/20 font-display text-xl">
                {result && index === result.correctAnswer ? "✓" : LETTERS[index] ?? index + 1}
              </span>
              <span className="min-w-0">{option}</span>
            </motion.button>
          ))}
        </div>

        {notice && <p className="m-0 text-center font-semibold text-amber-300">{notice}</p>}

        <AnimatePresence>
          {verdict && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
            >
              <Card tone={verdict.tone === "good" ? "good" : verdict.tone === "bad" ? "bad" : "soft"} className="grid gap-3 p-5 sm:p-6">
                <div>
                  <h2 className={`m-0 font-display text-3xl font-semibold ${verdict.tone === "good" ? "text-green-300" : verdict.tone === "bad" ? "text-red-300" : ""}`}>
                    {verdict.title}
                  </h2>
                  <p className="m-0 mt-1 text-slate-200">{verdict.text}</p>
                </div>
                {result && (
                  <div className="grid gap-3 border-t border-white/10 pt-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <AnswerTag label="Respuesta correcta" text={question.options[result.correctAnswer] ?? ""} tone="good" />
                      {chosen !== null && chosen !== result.correctAnswer && !result.alreadyAnswered && (
                        <AnswerTag label="Tu respuesta" text={question.options[chosen] ?? ""} tone="bad" />
                      )}
                    </div>
                    {result.explanation && (
                      <div className="grid gap-1 rounded-xl bg-white/5 p-3.5">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-fuchsia-300">¿Por qué?</span>
                        <p className="m-0 leading-relaxed text-slate-100">{result.explanation}</p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.main>
    </Screen>
  );
}

function AnswerTag({ label, text, tone }: { label: string; text: string; tone: "good" | "bad" }) {
  return (
    <div className={`grid gap-0.5 rounded-xl border px-3.5 py-2.5 ${tone === "good" ? "border-green-300/40 bg-green-500/10" : "border-red-400/40 bg-red-500/10"}`}>
      <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">{label}</span>
      <span className={`text-lg font-bold break-words ${tone === "good" ? "text-green-300" : "text-red-300"}`}>
        {tone === "good" ? "✓ " : "✗ "}
        {text}
      </span>
    </div>
  );
}
