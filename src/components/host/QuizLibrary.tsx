import { useState } from "react";
import { useSavedQuizzes } from "../../hooks/useSavedQuizzes";
import { formatClassDate } from "../../lib/classDates";
import { fieldClass, panelClass } from "../../lib/hostStyles";
import type { HostFetch } from "../../types/Host";
import QuizEditor from "./QuizEditor";

// Todos los quizzes guardados; cualquier host puede abrirlos y editarlos.
// Los quizzes nuevos se crean desde "Nueva sesión", donde ya se eligió clase.
export default function QuizLibrary({ api }: { api: HostFetch }) {
  const { quizzes, error, reload } = useSavedQuizzes(api);
  const [search, setSearch] = useState("");
  const [openQuizId, setOpenQuizId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const openQuiz = quizzes.find((quiz) => quiz.id === openQuizId) ?? null;
  const normalizedSearch = search.trim().toLowerCase();
  const visibleQuizzes = quizzes.filter((quiz) =>
    !normalizedSearch ||
    quiz.title.toLowerCase().includes(normalizedSearch) ||
    quiz.className.toLowerCase().includes(normalizedSearch),
  );

  // Recién creada (copia): todavía no aparece en la lista recargada.
  if (openQuizId && !openQuiz && !error) {
    return <section className={panelClass}><p className="text-slate-400">Abriendo...</p></section>;
  }

  if (openQuiz) {
    return (
      <section className={panelClass}>
        <button onClick={() => setOpenQuizId(null)} className="text-slate-400 hover:text-white text-sm mb-4">
          ← Volver a la lista
        </button>
        <h2 className="text-2xl font-bold mb-6">Editar quiz</h2>
        {notice && <p className="mb-4 rounded-xl bg-green-500/15 p-3 text-sm text-green-200">{notice}</p>}
        <QuizEditor
          key={openQuiz.id}
          api={api}
          quizId={openQuiz.id}
          classId={openQuiz.classId}
          classLabel={`${openQuiz.groupName ?? ""} · ${formatClassDate(openQuiz.classDate)} — ${openQuiz.className}`}
          // Si se guardó como copia, abre la copia recién creada y lo avisa.
          onSaved={(saved) => {
            reload();
            if (saved.id !== openQuiz.id) {
              setNotice(`✓ Se creó «${saved.title}». El quiz original y sus resultados no cambiaron.`);
              setOpenQuizId(saved.id);
            }
          }}
          onDeleted={() => { setOpenQuizId(null); reload(); }}
          onCancel={() => setOpenQuizId(null)}
        />
      </section>
    );
  }

  return (
    <section className={panelClass}>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-bold">Quizzes guardados</h2>
          <p className="text-sm text-slate-400">Para crear uno nuevo, usa “Nueva sesión” → “Crear nuevo”.</p>
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className={`${fieldClass} md:max-w-xs`} />
      </div>

      {error && <p className="text-red-300 mb-3">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="py-2 pr-4">Título</th>
              <th className="py-2 pr-4">Creado para</th>
              <th className="py-2 pr-4">Preguntas</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visibleQuizzes.map((quiz) => (
              <tr key={quiz.id} className="border-t border-white/10">
                <td className="py-3 pr-4 font-semibold">
                  {quiz.title}
                  {quiz.hasResults && (
                    <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-normal text-amber-200" title="Ya se jugó: al editarlo se guarda una copia">
                      📊 con resultados
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4 text-slate-300">
                  {quiz.className}
                  <span className="text-slate-500"> · {formatClassDate(quiz.classDate)}{quiz.groupName ? ` · ${quiz.groupName}` : ""}</span>
                </td>
                <td className="py-3 pr-4">{quiz.questionCount}</td>
                <td className="py-3 text-right">
                  <button onClick={() => { setNotice(""); setOpenQuizId(quiz.id); }} className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1">
                    Abrir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleQuizzes.length === 0 && (
          <p className="text-slate-400 text-center py-8">
            {quizzes.length === 0 ? "Todavía no hay quizzes guardados." : "Ningún quiz coincide con la búsqueda."}
          </p>
        )}
      </div>
    </section>
  );
}
