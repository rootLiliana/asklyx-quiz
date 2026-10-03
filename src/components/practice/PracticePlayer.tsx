import { useState } from "react";
import { motion } from "framer-motion";
import { percentageTextClass } from "../../lib/percentage";
import {
  PRACTICE_TYPE_LABEL,
  type AnswerFeedback,
  type PracticeEngine,
  type PracticeSummary,
  type PublicPracticeQuestion,
  type PublicPracticeQuiz,
} from "../../types/Practice";
import CodeBlock from "../material/CodeBlock";

const textAreaClass = "w-full rounded-xl bg-white p-4 text-black focus:outline-none focus:ring-4 focus:ring-fuchsia-400";
const primaryButton = "w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 px-5 py-4 text-lg font-bold text-white hover:from-fuchsia-400 hover:to-purple-500 disabled:opacity-50";

type Phase = "intro" | "playing" | "done";

// Respuesta en curso para la pregunta actual.
interface Draft {
  optionId: string | null;
  text: string;
  // CODE_WRITING: solución modelo revelada para autoevaluarse.
  revealed: { modelSolution: string; explanation: string | null } | null;
}

const emptyDraft: Draft = { optionId: null, text: "", revealed: null };

// Lo que ve la alumna al practicar. Lo usan la página de práctica (califica
// el servidor) y la vista previa del Host (califica el navegador).
export default function PracticePlayer({ quiz: initialQuiz, engine, onExit, exitLabel }: {
  quiz: PublicPracticeQuiz;
  engine: PracticeEngine;
  onExit: () => void;
  exitLabel: string;
}) {
  const [quiz, setQuiz] = useState(initialQuiz);
  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [summary, setSummary] = useState<PracticeSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async <T,>(work: () => Promise<T>): Promise<T | null> => {
    setBusy(true);
    setError("");
    try {
      return await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Intenta otra vez.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    const started = await run(() => engine.start());
    if (!started) return;
    setQuiz(started);
    setIndex(0);
    setDraft(emptyDraft);
    setFeedback(null);
    setCorrectCount(0);
    setSummary(null);
    setPhase("playing");
  };

  const question: PublicPracticeQuestion | undefined = quiz.questions[index];

  const submit = async (selfAssessment?: boolean) => {
    if (!question) return;
    const result = await run(() => engine.answer({ questionId: question.id, optionId: draft.optionId, answerText: draft.text, selfAssessment }));
    if (!result) return;
    setFeedback(result);
    if (result.correct) setCorrectCount((current) => current + 1);
  };

  const reveal = async () => {
    if (!question) return;
    const result = await run(() => engine.reveal(question.id, draft.text));
    if (result) setDraft((current) => ({ ...current, revealed: result }));
  };

  const next = async () => {
    if (index + 1 < quiz.questions.length) {
      setIndex(index + 1);
      setDraft(emptyDraft);
      setFeedback(null);
      return;
    }
    const result = await run(() => engine.finish());
    if (!result) return;
    setSummary(result);
    setPhase("done");
  };

  if (phase === "intro") {
    return (
      <>
        <p className="text-sm uppercase tracking-wide text-white/60">✏️ Práctica</p>
        <h1 className="text-2xl sm:text-3xl font-bold mb-3 break-words">{quiz.title}</h1>
        <p className="text-white/80 mb-6">
          {quiz.questions.length} preguntas · sin tiempo · puedes repetirla las veces que quieras. Al contestar cada una verás si acertaste y por qué.
        </p>
        {error && <p className="text-amber-300 mb-3">{error}</p>}
        <button onClick={() => void start()} disabled={busy} className={primaryButton}>{busy ? "Preparando..." : "Empezar"}</button>
      </>
    );
  }

  if (phase === "done" && summary) {
    return (
      <div className="text-center">
        <p className="text-5xl mb-3">{summary.percentage >= 80 ? "🎉" : summary.percentage >= 60 ? "💪" : "📚"}</p>
        <p className="text-white/70">Tu resultado</p>
        <p className={`text-6xl font-black ${percentageTextClass(summary.percentage)}`}>{summary.percentage}%</p>
        <p className="text-white/70 mt-1 mb-8">{summary.correctAnswers} de {summary.totalQuestions} correctas</p>
        {error && <p className="text-amber-300 mb-3">{error}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button onClick={() => void start()} disabled={busy} className={primaryButton}>🔁 Intentar otra vez</button>
          <button onClick={onExit} className="w-full rounded-xl bg-white/15 px-5 py-4 text-lg font-bold hover:bg-white/25">{exitLabel}</button>
        </div>
      </div>
    );
  }

  if (!question) return null;

  const isText = question.type === "SHORT_ANSWER" || question.type === "CODE_OUTPUT";
  const isWriting = question.type === "CODE_WRITING";
  const answered = feedback !== null;

  return (
    <>
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
            {isWriting && !feedback.correct && (
              <p className="text-sm text-white/70 mt-1">Compara tu código con la solución de arriba y vuelve a intentarlo después.</p>
            )}
            {feedback.explanation && <p className="mt-3 whitespace-pre-wrap break-words">💡 {feedback.explanation}</p>}
          </div>
          <button onClick={() => void next()} disabled={busy} className={primaryButton}>
            {index + 1 < quiz.questions.length ? "Siguiente" : "Ver mi resultado"}
          </button>
        </motion.div>
      )}
    </>
  );
}
