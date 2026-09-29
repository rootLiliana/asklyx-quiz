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
}

interface SessionWizardProps {
  api: HostFetch;
  onGameCreated: (game: Game, info: SessionInfo) => void;
}

type QuizMode = "existing" | "new";

// Nueva sesión: 1) grupo, 2) clase, 3) quiz existente o nuevo -> juego.
export default function SessionWizard({ api, onGameCreated }: SessionWizardProps) {
  const catalog = useClassCatalog();
  const selection = useClassSelection(catalog.groups, catalog.classes);
  const savedQuizzes = useSavedQuizzes(api);

  const [quizMode, setQuizMode] = useState<QuizMode>("existing");
  const [quizId, setQuizId] = useState("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

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
    if (!selectedClass || !selectedQuiz) return;

    setCreating(true);
    setError("");
    try {
      const response = await api("/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: selectedQuiz.id, classId: selectedClass.id }),
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

      <section className={`${panelClass} flex flex-wrap items-center justify-between gap-4`}>
        <div className="text-sm">
          <p className="text-slate-400">Resumen</p>
          <p>
            <span className="font-semibold">{selectedQuiz?.title ?? "Sin quiz"}</span>
            <span className="text-slate-400"> · {classLabel}</span>
          </p>
          {error && <p className="text-red-300 mt-1">{error}</p>}
        </div>
        <button
          onClick={createGame}
          disabled={!selectedClass || !selectedQuiz || creating}
          className="rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 px-6 py-4 font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {creating ? "Creando..." : "🎮 Crear juego"}
        </button>
      </section>
    </div>
  );
}
