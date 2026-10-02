import { useState } from "react";
import { useClassCatalog } from "../../hooks/useClassCatalog";
import { useClassSelection } from "../../hooks/useClassSelection";
import { useSavedQuizzes } from "../../hooks/useSavedQuizzes";
import { formatClassDate } from "../../lib/classDates";
import { fieldClass, panelClass } from "../../lib/hostStyles";
import type { Game } from "../../types/Game";
import type { HostFetch } from "../../types/Host";
import ClassPicker from "./ClassPicker";
import QuizEditor from "./QuizEditor";

export interface SessionInfo {
  quizTitle: string;
  className: string;
  classDate: string | null;
  groupName: string;
  durationSeconds: number;
}

const DURATION_PRESETS = [15, 22, 30, 45, 60, 90];
const MIN_SECONDS = 5;
const MAX_SECONDS = 300;
const DURATION_STORAGE_KEY = "hostQuestionSeconds";

// Los últimos segundos elegidos, para no tener que ponerlos cada sesión.
function loadSavedDuration(): string {
  try {
    return localStorage.getItem(DURATION_STORAGE_KEY) ?? "22";
  } catch {
    return "22";
  }
}

interface SessionWizardProps {
  api: HostFetch;
  onGameCreated: (game: Game, info: SessionInfo) => void;
}

type QuizMode = "existing" | "new";

// Nueva sesión: 1) grupo y clase, 2) quiz existente o nuevo, 3) segundos por
// pregunta -> juego.
export default function SessionWizard({ api, onGameCreated }: SessionWizardProps) {
  const catalog = useClassCatalog();
  const selection = useClassSelection(catalog.groups, catalog.classes);
  const savedQuizzes = useSavedQuizzes(api);

  const [quizMode, setQuizMode] = useState<QuizMode>("existing");
  const [quizId, setQuizId] = useState("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [durationInput, setDurationInput] = useState(loadSavedDuration);

  const durationSeconds = Number(durationInput);
  const durationValid = Number.isInteger(durationSeconds) && durationSeconds >= MIN_SECONDS && durationSeconds <= MAX_SECONDS;

  const groupName = catalog.groups.find((group) => group.id === selection.groupId)?.name ?? "";
  const selectedClass = selection.selectedClass;
  const classLabel = selectedClass ? `${groupName} · ${formatClassDate(selectedClass.classDate)} — ${selectedClass.name}` : "Elige una clase";
  const selectedQuiz = savedQuizzes.quizzes.find((quiz) => quiz.id === quizId) ?? null;

  const normalizedSearch = search.trim().toLowerCase();
  const visibleQuizzes = savedQuizzes.quizzes.filter((quiz) =>
    !normalizedSearch ||
    quiz.title.toLowerCase().includes(normalizedSearch) ||
    quiz.className.toLowerCase().includes(normalizedSearch),
  );

  const createGame = async () => {
    if (!selectedClass || !selectedQuiz || !durationValid) return;
    try {
      localStorage.setItem(DURATION_STORAGE_KEY, String(durationSeconds));
    } catch {
      // Sin almacenamiento (modo privado): solo no se recuerda para la próxima.
    }

    setCreating(true);
    setError("");
    try {
      const response = await api("/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: selectedQuiz.id, classId: selectedClass.id, durationSeconds }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.message ?? "No pudimos crear el juego. Intenta nuevamente.");
        return;
      }

      const game: Game = await response.json();
      onGameCreated(game, {
        quizTitle: selectedQuiz.title,
        className: selectedClass.name,
        classDate: selectedClass.classDate,
        groupName,
        durationSeconds,
      });
    } catch (err) {
      console.error("Error creando juego", err);
      setError("No pudimos conectarnos con el servidor.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <section className={panelClass}>
        <h2 className="text-2xl font-bold mb-1">1 · Grupo y clase</h2>
        <p className="text-sm text-slate-400 mb-4">La asistencia de esta sesión se registrará en esta clase.</p>
        {catalog.loading ? (
          <p className="text-slate-400">Cargando grupos y clases...</p>
        ) : catalog.error ? (
          <p className="text-red-300">{catalog.error}</p>
        ) : (
          <ClassPicker groups={catalog.groups} selection={selection} />
        )}
      </section>

      <section className={panelClass}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-2xl font-bold">2 · Quiz</h2>
          <div className="flex rounded-xl bg-black/30 p-1">
            {(["existing", "new"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setQuizMode(mode)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${quizMode === mode ? "bg-fuchsia-600" : "hover:bg-white/10"}`}
              >
                {mode === "existing" ? "Usar uno existente" : "➕ Crear nuevo"}
              </button>
            ))}
          </div>
        </div>

        {quizMode === "existing" ? (
          <>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título o clase..." className={`${fieldClass} mb-4`} />
            {savedQuizzes.error && <p className="text-red-300 mb-3">{savedQuizzes.error}</p>}
            <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto pr-1">
              {visibleQuizzes.map((quiz) => (
                <label
                  key={quiz.id}
                  className={`flex items-center gap-3 rounded-xl p-3 cursor-pointer border transition ${
                    quiz.id === quizId ? "bg-fuchsia-600/30 border-fuchsia-400" : "bg-white/5 border-white/10 hover:bg-white/10"
                  }`}
                >
                  <input type="radio" name="session-quiz" checked={quiz.id === quizId} onChange={() => setQuizId(quiz.id)} />
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{quiz.title}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {quiz.questionCount} preguntas · creado para {quiz.className} ({formatClassDate(quiz.classDate)}{quiz.groupName ? ` · ${quiz.groupName}` : ""})
                    </p>
                  </div>
                </label>
              ))}
              {visibleQuizzes.length === 0 && (
                <p className="text-slate-400 text-sm text-center py-6">
                  {savedQuizzes.quizzes.length === 0 ? "Todavía no hay quizzes guardados. Crea el primero." : "Ningún quiz coincide con la búsqueda."}
                </p>
              )}
            </div>
          </>
        ) : selectedClass ? (
          <QuizEditor
            key={selectedClass.id}
            api={api}
            quizId={null}
            classId={selectedClass.id}
            classLabel={classLabel}
            onSaved={(quiz) => {
              savedQuizzes.reload();
              setQuizId(quiz.id);
              setSearch("");
              setQuizMode("existing");
            }}
            onCancel={() => setQuizMode("existing")}
          />
        ) : (
          <p className="text-amber-300">Primero elige la clase.</p>
        )}
      </section>

      <section className={panelClass}>
        <h2 className="text-2xl font-bold mb-1">3 · Tiempo por pregunta</h2>
        <p className="text-sm text-slate-400 mb-4">Más tiempo también permite más puntos.</p>
        <div className="flex flex-wrap items-center gap-2">
          {DURATION_PRESETS.map((seconds) => (
            <button
              key={seconds}
              onClick={() => setDurationInput(String(seconds))}
              className={`rounded-xl px-4 py-2 font-semibold transition ${durationSeconds === seconds ? "bg-fuchsia-600" : "bg-white/10 hover:bg-white/20"}`}
            >
              {seconds} s
            </button>
          ))}
          <label className="flex items-center gap-2 rounded-xl bg-black/20 px-3 py-1">
            <span className="text-sm text-slate-300">Otro:</span>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_SECONDS}
              max={MAX_SECONDS}
              value={durationInput}
              onChange={(e) => setDurationInput(e.target.value)}
              className="w-20 rounded-lg bg-white/10 border border-white/20 p-2 text-white"
            />
            <span className="text-sm text-slate-300">s</span>
          </label>
        </div>
        {!durationValid && (
          <p className="mt-2 text-sm text-amber-300">Pon entre {MIN_SECONDS} y {MAX_SECONDS} segundos.</p>
        )}
      </section>

      <section className={`${panelClass} flex flex-wrap items-center justify-between gap-4`}>
        <div className="text-sm min-w-0">
          <p className="text-slate-400">Resumen</p>
          <p>
            <span className="font-semibold">{selectedQuiz?.title ?? "Sin quiz"}</span>
            <span className="text-slate-400"> · {classLabel}</span>
            {durationValid && <span className="text-slate-400"> · ⏱️ {durationSeconds} s por pregunta</span>}
          </p>
          {error && <p className="text-red-300 mt-1">{error}</p>}
        </div>
        <button
          onClick={createGame}
          disabled={!selectedClass || !selectedQuiz || !durationValid || creating}
          className="rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 px-6 py-4 font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {creating ? "Creando..." : "🎮 Crear juego"}
        </button>
      </section>
    </div>
  );
}
