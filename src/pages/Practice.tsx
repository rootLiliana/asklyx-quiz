import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import CodeBlock from "../components/material/CodeBlock";
import { percentageTextClass } from "../lib/percentage";
import { studentFetch } from "../lib/studentSession";
import { PRACTICE_TYPE_LABEL, type AnswerFeedback, type PublicPracticeQuestion, type PublicPracticeQuiz } from "../types/Practice";

const textAreaClass = "w-full rounded-xl bg-white p-4 text-black focus:outline-none focus:ring-4 focus:ring-fuchsia-400";
const primaryButton = "w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 px-5 py-4 text-lg font-bold text-white hover:from-fuchsia-400 hover:to-purple-500 disabled:opacity-50";

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

type Phase = "intro" | "playing" | "done";

// Respuesta en curso para la pregunta actual.
interface Draft {
  optionId: string | null;
  text: string;
  // CODE_WRITING: solución modelo revelada para autoevaluarse.
  revealed: { modelSolution: string; explanation: string | null } | null;
}

const emptyDraft: Draft = { optionId: null, text: "", revealed: null };

export default function Practice() {
  const { quizId = "" } = useParams();
  const navigate = useNavigate();
  const goBack = () => navigate("/mi-grupo");

  const [quiz, setQuiz] = useState<PublicPracticeQuiz | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");
  const [attemptId, setAttemptId] = useState("");
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [summary, setSummary] = useState<{ correctAnswers: number; totalQuestions: number; percentage: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  // Envuelve cada llamada: maneja sesión vencida y errores de red.
  const call = async <T,>(path: string, body: unknown): Promise<T | null> => {
    setBusy(true);
    setError("");
    try {
      const response = await studentFetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (response.status === 401 || response.status === 403) { navigate("/join"); return null; }
      if (!response.ok) {
        setError(response.status === 400 ? "Revisa tu respuesta e intenta de nuevo." : "No pudimos guardar. Intenta otra vez.");
        return null;
      }
      return await response.json() as T;
    } catch (err) {
      console.error("Error en práctica:", err);
      setError("Sin conexión. Revisa tu internet e intenta otra vez.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    const result = await call<{ attemptId: string; quiz: PublicPracticeQuiz }>(`/me/practice/${encodeURIComponent(quizId)}/attempts`, {});
    if (!result) return;
    setQuiz(result.quiz);
    setAttemptId(result.attemptId);
    setIndex(0);
    setDraft(emptyDraft);
    setFeedback(null);
    setCorrectCount(0);
    setSummary(null);
    setPhase("playing");
  };

  const question: PublicPracticeQuestion | undefined = quiz?.questions[index];

  const submit = async (selfAssessment?: boolean) => {
    if (!question) return;
    const result = await call<AnswerFeedback>(`/me/practice-attempts/${attemptId}/answers`, {
      questionId: question.id,
      optionId: draft.optionId,
      answerText: draft.text,
      selfAssessment,
    });
    if (!result) return;
    setFeedback(result);
    if (result.correct) setCorrectCount((current) => current + 1);
  };

  const reveal = async () => {
    if (!question) return;
    const result = await call<{ modelSolution: string; explanation: string | null }>(`/me/practice-attempts/${attemptId}/reveal`, {
      questionId: question.id,
      answerText: draft.text,
    });
    if (result) setDraft((current) => ({ ...current, revealed: result }));
  };

  const next = async () => {
    if (!quiz) return;
    if (index + 1 < quiz.questions.length) {
      setIndex(index + 1);
      setDraft(emptyDraft);
      setFeedback(null);
      return;
    }
    const result = await call<{ correctAnswers: number; totalQuestions: number; percentage: number }>(`/me/practice-attempts/${attemptId}/finish`, {});
    if (!result) return;
    setSummary(result);
    setPhase("done");
  };

  if (loadError) {
    return <Shell onBack={goBack}><p className="text-red-300">Esta práctica no está disponible.</p></Shell>;
  }
  if (!quiz) {
    return <Shell onBack={goBack}><p className="text-white/70">Cargando...</p></Shell>;
  }

  if (phase === "intro") {
    return (
      <Shell onBack={goBack}>
        <p className="text-sm uppercase tracking-wide text-white/60">✏️ Práctica</p>
        <h1 className="text-2xl sm:text-3xl font-bold mb-3 break-words">{quiz.title}</h1>
        <p className="text-white/80 mb-6">
          {quiz.questions.length} preguntas · sin tiempo · puedes repetirla las veces que quieras. Al contestar cada una verás si acertaste y por qué.
        </p>
        {error && <p className="text-amber-300 mb-3">{error}</p>}
        <button onClick={() => void start()} disabled={busy} className={primaryButton}>{busy ? "Preparando..." : "Empezar"}</button>
      </Shell>
    );
  }

  if (phase === "done" && summary) {
    return (
      <Shell onBack={goBack}>
        <div className="text-center">
          <p className="text-5xl mb-3">{summary.percentage >= 80 ? "🎉" : summary.percentage >= 60 ? "💪" : "📚"}</p>
          <p className="text-white/70">Tu resultado</p>
          <p className={`text-6xl font-black ${percentageTextClass(summary.percentage)}`}>{summary.percentage}%</p>
          <p className="text-white/70 mt-1 mb-8">{summary.correctAnswers} de {summary.totalQuestions} correctas</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button onClick={() => void start()} disabled={busy} className={primaryButton}>🔁 Intentar otra vez</button>
            <button onClick={goBack} className="w-full rounded-xl bg-white/15 px-5 py-4 text-lg font-bold hover:bg-white/25">Volver a Mi grupo</button>
          </div>
        </div>
      </Shell>
    );
  }

  if (!question) return null;

  const isText = question.type === "SHORT_ANSWER" || question.type === "CODE_OUTPUT";
  const isWriting = question.type === "CODE_WRITING";
  const answered = feedback !== null;

  return (
    <Shell onBack={goBack}>
      <div className="flex items-center justify-between gap-3 mb-2 text-sm text-white/70">
        <span>Pregunta {index + 1} de {quiz.questions.length}</span>
        <span>✅ {correctCount}</span>
      </div>
      <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-black/30">
        <div className="h-full rounded-full bg-fuchsia-500 transition-all" style={{ width: `${(index / quiz.questions.length) * 100}%` }} />
      </div>

      <p className="text-xs uppercase tracking-wide text-white/50 mb-1">{PRACTICE_TYPE_LABEL[question.type]}</p>
      <h1 className="text-xl sm:text-2xl font-bold mb-4 whitespace-pre-wrap break-words">{question.text}</h1>
      {question.code && <div className="mb-5"><CodeBlock code={question.code} language="python" /></div>}

      {question.type === "MULTIPLE_CHOICE" && (
        <div className="grid grid-cols-1 gap-3 mb-5">
          {question.options.map((option) => {
            const chosen = draft.optionId === option.id;
            const isCorrect = answered && feedback.correctOptionId === option.id;
            const isWrongChoice = answered && chosen && !feedback.correct;
            return (
              <button
                key={option.id}
                disabled={answered || busy}
                onClick={() => setDraft({ ...draft, optionId: option.id })}
                className={`rounded-2xl p-4 text-left font-semibold break-words transition ${
                  isCorrect ? "bg-green-600 ring-4 ring-green-300"
                    : isWrongChoice ? "bg-red-600"
                      : chosen ? "bg-fuchsia-600 ring-2 ring-white/60"
                        : "bg-white/10 hover:bg-white/20"
                }`}
              >
                {option.text}
              </button>
            );
          })}
        </div>
      )}

      {(isText || isWriting) && (
        <textarea
          value={draft.text}
          disabled={answered || draft.revealed !== null || busy}
          onChange={(e) => setDraft({ ...draft, text: e.target.value })}
          placeholder={question.type === "CODE_OUTPUT" ? "Escribe exactamente lo que imprime" : isWriting ? "Escribe tu código aquí" : "Tu respuesta"}
          spellCheck={false}
          autoCapitalize="none"
          className={`${textAreaClass} mb-5 ${question.type === "SHORT_ANSWER" ? "min-h-20" : "min-h-36 font-mono text-sm"}`}
        />
      )}

      {/* Escribe el código: ver solución -> autoevaluarse */}
      {isWriting && draft.revealed && !answered && (
        <div className="mb-5">
          <p className="font-semibold mb-2">Solución modelo</p>
          <CodeBlock code={draft.revealed.modelSolution} language="python" />
          <p className="mt-4 mb-3 text-center">¿Tu código hace lo mismo?</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => void submit(true)} disabled={busy} className="rounded-xl bg-green-600 hover:bg-green-500 p-4 font-bold">✅ Me salió</button>
            <button onClick={() => void submit(false)} disabled={busy} className="rounded-xl bg-white/15 hover:bg-white/25 p-4 font-bold">❌ Me faltó</button>
          </div>
        </div>
      )}

      {error && <p className="text-amber-300 mb-3">{error}</p>}

      {!answered && !(isWriting && draft.revealed) && (
        <button
          onClick={() => void (isWriting ? reveal() : submit())}
          disabled={busy || (question.type === "MULTIPLE_CHOICE" ? !draft.optionId : !draft.text.trim())}
          className={primaryButton}
        >
          {isWriting ? "Ver solución" : "Comprobar"}
        </button>
      )}

      {answered && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <div className={`mb-4 rounded-2xl p-4 ${feedback.correct ? "bg-green-500/15 border border-green-400/40" : "bg-red-500/15 border border-red-400/40"}`}>
            <p className="text-xl font-bold mb-1">{feedback.correct ? "✅ ¡Correcto!" : isWriting ? "📚 ¡A practicarlo!" : "❌ No exactamente"}</p>
            {!feedback.correct && feedback.expectedAnswer !== undefined && (
              <div className="mt-2">
                <p className="text-sm text-white/70 mb-1">Respuesta esperada:</p>
                <pre className="whitespace-pre-wrap break-words rounded-xl bg-black/30 p-3 font-mono text-sm">{feedback.expectedAnswer}</pre>
              </div>
            )}
            {isWriting && feedback.modelSolution && !feedback.correct && (
              <p className="text-sm text-white/70 mt-1">Compara tu código con la solución de arriba y vuelve a intentarlo después.</p>
            )}
            {feedback.explanation && <p className="mt-3 whitespace-pre-wrap break-words">💡 {feedback.explanation}</p>}
          </div>
          <button onClick={() => void next()} disabled={busy} className={primaryButton}>
            {index + 1 < quiz.questions.length ? "Siguiente" : "Ver mi resultado"}
          </button>
        </motion.div>
      )}
    </Shell>
  );
}
