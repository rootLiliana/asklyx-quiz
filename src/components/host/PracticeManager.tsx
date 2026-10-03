import { useEffect, useState } from "react";
import { fieldClass, labelClass, panelClass } from "../../lib/hostStyles";
import { percentageTextClass } from "../../lib/percentage";
import { initialScheduledAt, publishModeOf, resolvePublishedAt, scheduleProblem, type PublishMode } from "../../lib/publishing";
import type { HostFetch } from "../../types/Host";
import {
  PRACTICE_TYPE_LABEL,
  type PracticeQuestionType,
  type PracticeQuiz,
  type PracticeQuizSummary,
  type PracticeStudentStat,
} from "../../types/Practice";
import { PublishPicker, StatusBadge } from "./Publishing";

const codeFieldClass = `${fieldClass} font-mono text-sm`;

interface EditableOption { key: string; id: string | null; text: string; isCorrect: boolean }
interface EditableQuestion {
  key: string;
  id: string | null;
  type: PracticeQuestionType;
  text: string;
  explanation: string;
  code: string;
  options: EditableOption[];
  acceptedAnswers: string[];
  modelSolution: string;
}

const newOption = (text = "", isCorrect = false): EditableOption => ({ key: crypto.randomUUID(), id: null, text, isCorrect });

function newQuestion(type: PracticeQuestionType = "MULTIPLE_CHOICE"): EditableQuestion {
  return {
    key: crypto.randomUUID(), id: null, type, text: "", explanation: "", code: "",
    options: [newOption("", true), newOption(), newOption()],
    acceptedAnswers: [""],
    modelSolution: "",
  };
}

function toEditable(quiz: PracticeQuiz): EditableQuestion[] {
  return quiz.questions.map((question) => ({
    key: crypto.randomUUID(),
    id: question.id,
    type: question.type,
    text: question.text,
    explanation: question.explanation ?? "",
    code: question.code ?? "",
    options: question.options.length > 0
      ? question.options.map((option) => ({ key: crypto.randomUUID(), id: option.id, text: option.text, isCorrect: option.isCorrect }))
      : [newOption("", true), newOption()],
    acceptedAnswers: question.acceptedAnswers.length > 0 ? question.acceptedAnswers : [""],
    modelSolution: question.modelSolution ?? "",
  }));
}

function validate(title: string, questions: EditableQuestion[]): string {
  if (!title.trim()) return "Escribe un título.";
  if (questions.length === 0) return "Agrega al menos una pregunta.";
  for (const [index, question] of questions.entries()) {
    const where = `Pregunta ${index + 1}`;
    if (!question.text.trim()) return `${where}: escribe la pregunta.`;
    if (question.type === "MULTIPLE_CHOICE") {
      if (question.options.some((option) => !option.text.trim())) return `${where}: completa las opciones o quita las vacías.`;
      if (question.options.filter((option) => option.isCorrect).length !== 1) return `${where}: marca la respuesta correcta.`;
    }
    if ((question.type === "SHORT_ANSWER" || question.type === "CODE_OUTPUT") && !question.acceptedAnswers.some((value) => value.trim())) {
      return `${where}: escribe al menos una respuesta aceptada.`;
    }
    if (question.type === "CODE_OUTPUT" && !question.code.trim()) return `${where}: escribe el código cuya salida deben adivinar.`;
    if (question.type === "CODE_WRITING" && !question.modelSolution.trim()) return `${where}: escribe la solución modelo.`;
  }
  return "";
}

// Lo que se envía al servidor: solo lo que usa cada tipo.
function toPayload(question: EditableQuestion) {
  return {
    id: question.id,
    type: question.type,
    text: question.text,
    explanation: question.explanation,
    code: question.code,
    options: question.type === "MULTIPLE_CHOICE" ? question.options.map(({ id, text, isCorrect }) => ({ id, text, isCorrect })) : [],
    acceptedAnswers: question.type === "SHORT_ANSWER" || question.type === "CODE_OUTPUT" ? question.acceptedAnswers.filter((value) => value.trim()) : [],
    modelSolution: question.type === "CODE_WRITING" ? question.modelSolution : null,
  };
}

function QuestionEditor({ question, index, total, onChange, onMove, onRemove }: {
  question: EditableQuestion;
  index: number;
  total: number;
  onChange: (changes: Partial<EditableQuestion>) => void;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
}) {
  const isOutput = question.type === "CODE_OUTPUT";

  return (
    <div className="rounded-2xl bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span className="font-bold">Pregunta {index + 1}</span>
        <span className="flex gap-1">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} title="Subir" className="rounded-lg px-2 py-1 hover:bg-white/10 disabled:opacity-30">↑</button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} title="Bajar" className="rounded-lg px-2 py-1 hover:bg-white/10 disabled:opacity-30">↓</button>
          <button type="button" onClick={onRemove} title="Quitar pregunta" className="rounded-lg px-2 py-1 text-red-300 hover:bg-red-500/20">✕</button>
        </span>
      </div>

      <select value={question.type} onChange={(e) => onChange({ type: e.target.value as PracticeQuestionType })} className={`${fieldClass} mb-3`}>
        {(Object.keys(PRACTICE_TYPE_LABEL) as PracticeQuestionType[]).map((type) => (
          <option key={type} value={type} className="text-black">{PRACTICE_TYPE_LABEL[type]}</option>
        ))}
      </select>

      <textarea value={question.text} onChange={(e) => onChange({ text: e.target.value })} placeholder="Escribe la pregunta o instrucción" className={`${fieldClass} min-h-20 mb-3`} />

      <label className={labelClass}>{isOutput ? "Código (obligatorio)" : "Código para mostrar (opcional)"}</label>
      <textarea
        value={question.code}
        onChange={(e) => onChange({ code: e.target.value })}
        placeholder={isOutput ? "Pega aquí el código cuya salida deben adivinar" : "(Opcional) Pega aquí código para mostrarlo con la pregunta"}
        spellCheck={false}
        className={`${codeFieldClass} min-h-24 mb-3`}
      />

      {question.type === "MULTIPLE_CHOICE" && (
        <div className="mb-3">
          <p className="text-xs text-slate-400 mb-2">Marca la respuesta correcta.</p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {question.options.map((option, optionIndex) => (
              <label key={option.key} className="flex items-center gap-2 rounded-xl bg-white/5 p-2">
                <input
                  type="radio"
                  name={`correct-${question.key}`}
                  checked={option.isCorrect}
                  onChange={() => onChange({ options: question.options.map((item) => ({ ...item, isCorrect: item.key === option.key })) })}
                />
                <input
                  value={option.text}
                  onChange={(e) => onChange({ options: question.options.map((item) => (item.key === option.key ? { ...item, text: e.target.value } : item)) })}
                  placeholder={`Opción ${optionIndex + 1}`}
                  className="w-full min-w-0 rounded-lg bg-transparent border border-white/20 p-2 text-white placeholder:text-slate-400"
                />
                <button
                  type="button"
                  disabled={question.options.length <= 2}
                  onClick={() => onChange({ options: question.options.filter((item) => item.key !== option.key) })}
                  className="px-1 text-slate-400 hover:text-red-300 disabled:opacity-30"
                >
                  ✕
                </button>
              </label>
            ))}
          </div>
          {question.options.length < 6 && (
            <button type="button" onClick={() => onChange({ options: [...question.options, newOption()] })} className="mt-2 text-sm text-fuchsia-300 hover:text-fuchsia-200">
              + Agregar opción
            </button>
          )}
        </div>
      )}

      {(question.type === "SHORT_ANSWER" || isOutput) && (
        <div className="mb-3">
          <p className="text-xs text-slate-400 mb-2">
            {isOutput
              ? "Salida exacta que imprime el código. Se ignoran espacios al final de cada línea."
              : "Respuestas que cuentan como correctas. No importan mayúsculas, acentos ni espacios; 42 y 42.0 cuentan igual."}
          </p>
          <div className="grid grid-cols-1 gap-2">
            {question.acceptedAnswers.map((accepted, answerIndex) => (
              <div key={answerIndex} className="flex items-start gap-2">
                {isOutput ? (
                  <textarea
                    value={accepted}
                    onChange={(e) => onChange({ acceptedAnswers: question.acceptedAnswers.map((value, i) => (i === answerIndex ? e.target.value : value)) })}
                    placeholder="3"
                    spellCheck={false}
                    className={`${codeFieldClass} min-h-16`}
                  />
                ) : (
                  <input
                    value={accepted}
                    onChange={(e) => onChange({ acceptedAnswers: question.acceptedAnswers.map((value, i) => (i === answerIndex ? e.target.value : value)) })}
                    placeholder={answerIndex === 0 ? "Respuesta correcta" : "Otra forma válida"}
                    className={fieldClass}
                  />
                )}
                <button
                  type="button"
                  disabled={question.acceptedAnswers.length <= 1}
                  onClick={() => onChange({ acceptedAnswers: question.acceptedAnswers.filter((_, i) => i !== answerIndex) })}
                  className="px-2 py-3 text-slate-400 hover:text-red-300 disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {question.acceptedAnswers.length < 10 && (
            <button type="button" onClick={() => onChange({ acceptedAnswers: [...question.acceptedAnswers, ""] })} className="mt-2 text-sm text-fuchsia-300 hover:text-fuchsia-200">
              + Otra respuesta válida
            </button>
          )}
        </div>
      )}

      {question.type === "CODE_WRITING" && (
        <div className="mb-3">
          <label className={labelClass}>Solución modelo</label>
          <p className="text-xs text-slate-400 mb-2">El alumno la ve después de escribir su código y él mismo marca si le salió.</p>
          <textarea
            value={question.modelSolution}
            onChange={(e) => onChange({ modelSolution: e.target.value })}
            placeholder="df.groupby('ciudad')['ventas'].mean()"
            spellCheck={false}
            className={`${codeFieldClass} min-h-24`}
          />
        </div>
      )}

      <textarea
        value={question.explanation}
        onChange={(e) => onChange({ explanation: e.target.value })}
        placeholder="Explicación que verán al contestar (opcional, pero ayuda mucho)"
        className={`${fieldClass} min-h-16`}
      />
    </div>
  );
}

function PracticeEditor({ api, classId, quizId, onSaved, onCancel }: {
  api: HostFetch;
  classId: string;
  quizId: string | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [loaded, setLoaded] = useState(quizId === null);
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<EditableQuestion[]>(() => [newQuestion()]);
  const [previousPublishedAt, setPreviousPublishedAt] = useState<string | null>(null);
  const [mode, setMode] = useState<PublishMode>("draft");
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!quizId) return;
    let cancelled = false;

    api(`/practice/${quizId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`status ${response.status}`);
        const quiz: PracticeQuiz = await response.json();
        if (cancelled) return;
        setTitle(quiz.title);
        setQuestions(toEditable(quiz));
        setPreviousPublishedAt(quiz.publishedAt);
        setMode(publishModeOf(quiz.publishedAt));
        setScheduledAt(initialScheduledAt(quiz.publishedAt));
        setLoaded(true);
      })
      .catch((err: unknown) => {
        console.error("Error abriendo práctica", err);
        if (!cancelled) { setError("No pudimos abrir este quiz de práctica."); setLoaded(true); }
      });

    return () => { cancelled = true; };
  }, [api, quizId]);

  const updateQuestion = (key: string, changes: Partial<EditableQuestion>) => {
    setQuestions((current) => current.map((question) => (question.key === key ? { ...question, ...changes } : question)));
  };

  const moveQuestion = (index: number, offset: -1 | 1) => {
    setQuestions((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };

  const save = async () => {
    const problem = validate(title, questions) || scheduleProblem(mode, scheduledAt);
    if (problem) { setError(problem); return; }

    setSaving(true);
    setError("");
    try {
      const response = await api(quizId ? `/practice/${quizId}` : `/classes/${classId}/practice`, {
        method: quizId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          publishedAt: resolvePublishedAt(mode, scheduledAt, previousPublishedAt),
          questions: questions.map(toPayload),
        }),
      });
      if (response.status === 409) {
        setError("No se puede quitar una pregunta u opción que los alumnos ya contestaron. Puedes corregir su texto en lugar de quitarla.");
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(`No pudimos guardar.${body?.message ? ` (${body.message})` : ""}`);
        return;
      }
      onSaved();
    } catch (err) {
      console.error("Error guardando práctica", err);
      setError("No pudimos conectarnos con el servidor.");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <section className={panelClass}><p className="text-slate-400">Cargando...</p></section>;

  return (
    <section className={panelClass}>
      <button onClick={onCancel} className="text-slate-400 hover:text-white text-sm mb-4">← Volver a la clase</button>
      <h2 className="text-2xl font-bold mb-1">{quizId ? "Editar práctica" : "Nuevo quiz de práctica"}</h2>
      <p className="text-sm text-slate-400 mb-5">Los alumnos lo resuelven solos, sin tiempo y las veces que quieran. Nunca aparece en las sesiones en vivo.</p>

      <label className={labelClass}>Título</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Ej: Practica groupby antes de clase" className={`${fieldClass} mb-5`} />

      <div className="grid grid-cols-1 gap-4">
        {questions.map((question, index) => (
          <QuestionEditor
            key={question.key}
            question={question}
            index={index}
            total={questions.length}
            onChange={(changes) => updateQuestion(question.key, changes)}
            onMove={(offset) => moveQuestion(index, offset)}
            onRemove={() => setQuestions((current) => current.filter((item) => item.key !== question.key))}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(Object.keys(PRACTICE_TYPE_LABEL) as PracticeQuestionType[]).map((type) => (
          <button key={type} type="button" onClick={() => setQuestions((current) => [...current, newQuestion(type)])} className="rounded-xl bg-white/10 hover:bg-white/20 px-3 py-2 text-sm font-semibold">
            + {PRACTICE_TYPE_LABEL[type]}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <PublishPicker mode={mode} onModeChange={setMode} scheduledAt={scheduledAt} onScheduledAtChange={setScheduledAt} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button onClick={() => void save()} disabled={saving} className="rounded-xl bg-green-600 hover:bg-green-500 px-5 py-3 font-bold disabled:opacity-50">
          {saving ? "Guardando..." : "Guardar práctica"}
        </button>
        <button onClick={onCancel} className="rounded-xl bg-white/10 hover:bg-white/20 px-4 py-3">Cancelar</button>
        {error && <p className="text-red-300 text-sm">{error}</p>}
      </div>
    </section>
  );
}

function PracticeResults({ api, quiz, onBack }: { api: HostFetch; quiz: PracticeQuizSummary; onBack: () => void }) {
  const [stats, setStats] = useState<PracticeStudentStat[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api(`/practice/${quiz.id}/results`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`status ${response.status}`);
        const data: PracticeStudentStat[] = await response.json();
        if (!cancelled) setStats(data);
      })
      .catch((err: unknown) => {
        console.error("Error cargando resultados de práctica", err);
        if (!cancelled) setError(true);
      });

    return () => { cancelled = true; };
  }, [api, quiz.id]);

  return (
    <section className={panelClass}>
      <button onClick={onBack} className="text-slate-400 hover:text-white text-sm mb-4">← Volver a la clase</button>
      <h2 className="text-2xl font-bold mb-1 break-words">✏️ {quiz.title}</h2>
      <p className="text-sm text-slate-400 mb-5">Quién practicó, cuántas veces y su mejor %.</p>

      {error && <p className="text-red-300">No pudimos cargar los resultados.</p>}
      {!stats && !error && <p className="text-slate-400">Cargando...</p>}
      {stats?.length === 0 && <p className="text-slate-400 text-center py-6">Nadie ha practicado este quiz todavía.</p>}

      {stats && stats.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2 pr-4">Alumno</th>
                <th className="py-2 pr-4 text-center">Intentos</th>
                <th className="py-2 pr-4 text-center">Mejor %</th>
                <th className="py-2">Último intento</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((stat) => (
                <tr key={stat.studentId} className="border-t border-white/10">
                  <td className="py-3 pr-4">
                    <span className="block font-semibold">{[stat.name, stat.lastNamePaternal].filter(Boolean).join(" ")}</span>
                    {stat.nickname && <span className="block text-xs text-slate-400">{stat.nickname}</span>}
                  </td>
                  <td className="py-3 pr-4 text-center">{stat.attempts}</td>
                  <td className={`py-3 pr-4 text-center font-black ${percentageTextClass(stat.bestPercentage)}`}>{stat.bestPercentage}%</td>
                  <td className="py-3 text-slate-400 whitespace-nowrap">
                    {stat.lastAttemptAt ? new Date(stat.lastAttemptAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

type View = { kind: "list" } | { kind: "edit"; quizId: string | null } | { kind: "results"; quiz: PracticeQuizSummary };

// Quizzes de práctica de una clase. Se muestra junto al material.
export default function PracticeManager({ api, classId, onViewChange }: {
  api: HostFetch;
  classId: string;
  // true mientras se edita o se ven resultados (para ocultar el resto de la página).
  onViewChange: (focused: boolean) => void;
}) {
  const [quizzes, setQuizzes] = useState<PracticeQuizSummary[] | null>(null);
  const [error, setError] = useState("");
  const [view, setViewState] = useState<View>({ kind: "list" });
  const [version, setVersion] = useState(0);

  const setView = (next: View) => {
    setViewState(next);
    onViewChange(next.kind !== "list");
  };

  useEffect(() => {
    let cancelled = false;

    api(`/classes/${classId}/practice`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`status ${response.status}`);
        const data: PracticeQuizSummary[] = await response.json();
        if (!cancelled) { setQuizzes(data); setError(""); }
      })
      .catch((err: unknown) => {
        console.error("Error cargando práctica", err);
        if (!cancelled) setError("No pudimos cargar los quizzes de práctica.");
      });

    return () => { cancelled = true; };
  }, [api, classId, version]);

  const remove = async (quiz: PracticeQuizSummary) => {
    if (!window.confirm(`¿Borrar "${quiz.title}"?`)) return;
    const response = await api(`/practice/${quiz.id}`, { method: "DELETE" });
    if (response.status === 409) {
      setError("Ese quiz ya se practicó, así que se conserva para no perder los intentos. Puedes pasarlo a borrador para ocultarlo.");
      return;
    }
    if (!response.ok) { setError("No pudimos borrar el quiz."); return; }
    setVersion((current) => current + 1);
  };

  if (view.kind === "edit") {
    return (
      <PracticeEditor
        key={view.quizId ?? "new"}
        api={api}
        classId={classId}
        quizId={view.quizId}
        onSaved={() => { setView({ kind: "list" }); setVersion((current) => current + 1); }}
        onCancel={() => setView({ kind: "list" })}
      />
    );
  }
  if (view.kind === "results") {
    return <PracticeResults api={api} quiz={view.quiz} onBack={() => setView({ kind: "list" })} />;
  }

  return (
    <section className={panelClass}>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold">✏️ Quizzes de práctica</h2>
          <p className="text-sm text-slate-400">Ejercicios para que practiquen solos antes o después de la clase.</p>
        </div>
        <button onClick={() => setView({ kind: "edit", quizId: null })} className="rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 px-4 py-3 font-bold">+ Nueva práctica</button>
      </div>

      {error && <p className="text-red-300 mb-3">{error}</p>}
      {!quizzes && !error && <p className="text-slate-400">Cargando...</p>}
      {quizzes?.length === 0 && <p className="text-slate-400 text-center py-6">Esta clase todavía no tiene quizzes de práctica.</p>}

      <div className="grid grid-cols-1 gap-2">
        {quizzes?.map((quiz) => (
          <div key={quiz.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/5 p-3">
            <div className="min-w-0">
              <p className="font-semibold break-words">{quiz.title}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <StatusBadge publishedAt={quiz.publishedAt} />
                <span>{quiz.questionCount} preguntas</span>
                <span>· {quiz.students} {quiz.students === 1 ? "alumno practicó" : "alumnos practicaron"}</span>
                {quiz.averageBestPercentage !== null && (
                  <span className={percentageTextClass(quiz.averageBestPercentage)}>· mejor % promedio {quiz.averageBestPercentage}%</span>
                )}
              </p>
            </div>
            <span className="flex flex-wrap gap-2">
              <button onClick={() => setView({ kind: "results", quiz })} className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1">📊 Resultados</button>
              <button onClick={() => setView({ kind: "edit", quizId: quiz.id })} className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1">Editar</button>
              <button onClick={() => void remove(quiz)} className="rounded-lg bg-red-600/80 hover:bg-red-500 px-3 py-1">Borrar</button>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
