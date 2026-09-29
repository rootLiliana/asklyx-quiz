import { useEffect, useState } from "react";
import { fieldClass, labelClass } from "../../lib/hostStyles";
import type { EditableQuiz, HostFetch } from "../../types/Host";
import type { Question } from "../../types/Question";

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

function emptyQuestion(): Question {
  return { id: crypto.randomUUID(), text: "", options: ["", "", "", ""], correctAnswer: 0, explanation: "" };
}

// Devuelve el primer problema del quiz, o "" si se puede guardar.
function validateQuiz(title: string, questions: Question[]): string {
  if (!title.trim()) return "Escribe un título para el quiz.";
  if (questions.length === 0) return "Agrega al menos una pregunta.";

  for (const [index, question] of questions.entries()) {
    const label = `Pregunta ${index + 1}`;
    if (!question.text.trim()) return `${label}: escribe la pregunta.`;
    if (!question.explanation.trim()) return `${label}: escribe la explicación.`;
    if (question.options.some((option) => !option.trim())) return `${label}: completa todas las opciones o quita las vacías.`;
  }

  return "";
}

interface QuizEditorProps {
  api: HostFetch;
  // null = quiz nuevo (se guarda ligado a `classId`).
  quizId: string | null;
  classId: string;
  // Texto que describe la clase del quiz, solo para mostrar.
  classLabel: string;
  onSaved: (quiz: EditableQuiz) => void;
  onDeleted?: () => void;
  onCancel?: () => void;
}

export default function QuizEditor({ api, quizId, classId, classLabel, onSaved, onDeleted, onCancel }: QuizEditorProps) {
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<Question[]>(() => [emptyQuestion()]);
  const [quizClassId, setQuizClassId] = useState(classId);
  const [loading, setLoading] = useState(quizId !== null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Quien usa el editor le pone key={quizId}, así que esto solo corre al abrir.
  useEffect(() => {
    if (!quizId) return;
    let cancelled = false;

    api(`/host/quizzes/${quizId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`status ${response.status}`);
        const quiz: EditableQuiz = await response.json();
        if (cancelled) return;
        setTitle(quiz.title);
        setQuestions(quiz.questions);
        setQuizClassId(quiz.classId);
        setLoading(false);
      })
      .catch((error: unknown) => {
        console.error("Error abriendo quiz", error);
        if (!cancelled) { setMessage("No pudimos abrir este quiz."); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [api, quizId]);

  const updateQuestion = (index: number, changes: Partial<Question>) => {
    setQuestions((current) => current.map((question, i) => (i === index ? { ...question, ...changes } : question)));
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const question = questions[questionIndex];
    if (!question) return;
    updateQuestion(questionIndex, { options: question.options.map((option, i) => (i === optionIndex ? value : option)) });
  };

  const addOption = (questionIndex: number) => {
    const question = questions[questionIndex];
    if (!question || question.options.length >= MAX_OPTIONS) return;
    updateQuestion(questionIndex, { options: [...question.options, ""] });
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const question = questions[questionIndex];
    if (!question || question.options.length <= MIN_OPTIONS) return;

    // Mantiene marcada la misma respuesta correcta aunque cambien los índices.
    const correctAnswer =
      optionIndex === question.correctAnswer ? 0
        : optionIndex < question.correctAnswer ? question.correctAnswer - 1
          : question.correctAnswer;

    updateQuestion(questionIndex, { options: question.options.filter((_, i) => i !== optionIndex), correctAnswer });
  };

  const save = async () => {
    const problem = validateQuiz(title, questions);
    if (problem) { setMessage(problem); return; }

    setSaving(true);
    setMessage("");
    try {
      const response = await api(`/host/quizzes${quizId ? `/${quizId}` : ""}`, {
        method: quizId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: quizClassId, title, questions }),
      });

      if (!response.ok) {
        setMessage("No pudimos guardar el quiz. Intenta nuevamente.");
        return;
      }

      const saved: EditableQuiz = await response.json();
      setQuestions(saved.questions);
      setMessage("✓ Quiz guardado.");
      onSaved(saved);
    } catch (error) {
      console.error("Error guardando quiz", error);
      setMessage("No pudimos conectarnos con el servidor.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!quizId || !window.confirm("¿Borrar este quiz? Esta acción no se puede deshacer.")) return;

    const response = await api(`/host/quizzes/${quizId}`, { method: "DELETE" });
    if (response.status === 409) {
      setMessage("Este quiz ya se usó en una sesión, así que se conserva para no perder el historial de asistencia.");
      return;
    }
    if (!response.ok) {
      setMessage("No pudimos borrar el quiz.");
      return;
    }
    onDeleted?.();
  };

  if (loading) {
    return <p className="text-slate-400">Cargando quiz...</p>;
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-6">
        <div>
          <label className={labelClass}>Título del quiz</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Pandas - Módulo 1" className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>{quizId ? "Creado para la clase" : "Se guardará en la clase"}</label>
          <p className="rounded-xl bg-black/20 border border-white/10 p-3 text-slate-200">{classLabel}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5">
        {questions.map((question, questionIndex) => (
          <div key={question.id || questionIndex} className="rounded-2xl bg-black/20 p-5">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h3 className="text-xl font-bold">Pregunta {questionIndex + 1}</h3>
              <button
                onClick={() => setQuestions((current) => current.filter((_, i) => i !== questionIndex))}
                disabled={questions.length === 1}
                className="rounded-xl bg-red-600 hover:bg-red-500 px-3 py-2 disabled:opacity-40"
              >
                Eliminar
              </button>
            </div>

            <textarea
              value={question.text}
              onChange={(e) => updateQuestion(questionIndex, { text: e.target.value })}
              placeholder="Escribe la pregunta"
              className={`${fieldClass} min-h-24 mb-4`}
            />
            <textarea
              value={question.explanation}
              onChange={(e) => updateQuestion(questionIndex, { explanation: e.target.value })}
              placeholder="Explicación que verán los alumnos después de responder..."
              className={`${fieldClass} min-h-24 mb-4`}
            />

            <p className="text-xs text-slate-400 mb-2">Marca la respuesta correcta.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {question.options.map((option, optionIndex) => (
                <label key={optionIndex} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                  <input
                    type="radio"
                    name={`correct-${question.id || questionIndex}`}
                    checked={question.correctAnswer === optionIndex}
                    onChange={() => updateQuestion(questionIndex, { correctAnswer: optionIndex })}
                  />
                  <input
                    value={option}
                    onChange={(e) => updateOption(questionIndex, optionIndex, e.target.value)}
                    placeholder={`Opción ${optionIndex + 1}`}
                    className="w-full min-w-0 rounded-lg bg-transparent border border-white/20 p-2 text-white placeholder:text-slate-400"
                  />
                  <button
                    onClick={(e) => { e.preventDefault(); removeOption(questionIndex, optionIndex); }}
                    disabled={question.options.length <= MIN_OPTIONS}
                    title="Quitar opción"
                    className="text-slate-400 hover:text-red-300 disabled:opacity-30 px-1"
                  >
                    ✕
                  </button>
                </label>
              ))}
            </div>
            {question.options.length < MAX_OPTIONS && (
              <button onClick={() => addOption(questionIndex)} className="mt-3 text-sm text-fuchsia-300 hover:text-fuchsia-200">
                + Agregar opción
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-6">
        <button onClick={() => setQuestions((current) => [...current, emptyQuestion()])} className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-3">
          Agregar pregunta
        </button>
        <button onClick={save} disabled={saving} className="rounded-xl bg-green-600 hover:bg-green-500 px-4 py-3 font-bold disabled:opacity-50">
          {saving ? "Guardando..." : quizId ? "Guardar cambios" : "Guardar quiz"}
        </button>
        {onCancel && (
          <button onClick={onCancel} className="rounded-xl bg-white/10 hover:bg-white/20 px-4 py-3">
            Cancelar
          </button>
        )}
        {quizId && onDeleted && (
          <button onClick={remove} className="rounded-xl bg-red-600 hover:bg-red-500 px-4 py-3 ml-auto">
            Borrar quiz
          </button>
        )}
      </div>
      {message && <p className="mt-4 text-fuchsia-200">{message}</p>}
    </div>
  );
}
