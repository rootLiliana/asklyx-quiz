import { useEffect, useState } from "react";
import { useClassCatalog } from "../../hooks/useClassCatalog";
import { formatClassDate } from "../../lib/classDates";
import { fieldClass, labelClass, panelClass } from "../../lib/hostStyles";
import { percentageBarClass, percentageTextClass } from "../../lib/percentage";
import { getTodayGroupName } from "../../lib/studentGroup";
import type { HostFetch } from "../../types/Host";
import type { SessionResultDetail, SessionResultSummary, StudentHistory } from "../../types/Results";

function formatPlayedAt(playedAt: string | null): string {
  if (!playedAt) return "—";
  return new Date(playedAt).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
}

function PercentBadge({ value }: { value: number }) {
  return <span className={`font-black ${percentageTextClass(value)}`}>{value}%</span>;
}

// Carga un recurso al montar o cuando cambia `path` (null = no cargar).
function useHostResource<T>(api: HostFetch, path: string | null) {
  const [state, setState] = useState<{ path: string | null; data: T | null; error: boolean }>({ path: null, data: null, error: false });

  useEffect(() => {
    if (!path) return;
    let cancelled = false;

    api(path)
      .then(async (response) => {
        if (!response.ok) throw new Error(`status ${response.status}`);
        const data: T = await response.json();
        if (!cancelled) setState({ path, data, error: false });
      })
      .catch((err: unknown) => {
        console.error(`Error cargando ${path}`, err);
        if (!cancelled) setState({ path, data: null, error: true });
      });

    return () => { cancelled = true; };
  }, [api, path]);

  return { data: state.path === path ? state.data : null, error: state.path === path && state.error, loading: Boolean(path) && state.path !== path };
}

function StudentHistoryView({ api, studentId, name, onBack }: { api: HostFetch; studentId: string; name: string; onBack: () => void }) {
  const { data, error, loading } = useHostResource<StudentHistory>(api, `/host/results/students/${studentId}`);

  return (
    <section className={panelClass}>
      <button onClick={onBack} className="text-slate-400 hover:text-white text-sm mb-4">← Volver a la sesión</button>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <h2 className="text-2xl font-bold min-w-0 break-words">{name}</h2>
        {data?.averagePercentage !== null && data?.averagePercentage !== undefined && (
          <p className="text-right">
            <span className="block text-xs text-slate-400">Promedio general</span>
            <span className="text-3xl"><PercentBadge value={data.averagePercentage} /></span>
          </p>
        )}
      </div>
      {loading && <p className="text-slate-400">Cargando...</p>}
      {error && <p className="text-red-300">No pudimos cargar su historial.</p>}
      <div className="grid grid-cols-1 gap-2">
        {data?.entries.map((entry) => (
          <div key={entry.sessionId} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3">
            <div className="min-w-0">
              <p className="font-semibold truncate">{entry.quizTitle}</p>
              <p className="text-xs text-slate-400 truncate">{formatPlayedAt(entry.playedAt)} · {entry.className}</p>
            </div>
            <p className="shrink-0 text-right">
              <PercentBadge value={entry.percentage} />
              <span className="block text-xs text-slate-400">{entry.correctAnswers}/{entry.totalQuestions}</span>
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SessionDetailView({ api, sessionId, onBack, onOpenStudent }: {
  api: HostFetch;
  sessionId: string;
  onBack: () => void;
  onOpenStudent: (studentId: string, name: string) => void;
}) {
  const { data, error, loading } = useHostResource<SessionResultDetail>(api, `/host/results/sessions/${sessionId}`);

  if (loading || !data) {
    return (
      <section className={panelClass}>
        <button onClick={onBack} className="text-slate-400 hover:text-white text-sm mb-4">← Volver</button>
        <p className={error ? "text-red-300" : "text-slate-400"}>{error ? "No pudimos cargar esta sesión." : "Cargando..."}</p>
      </section>
    );
  }

  const { session, students, questions } = data;

  return (
    <div className="grid grid-cols-1 gap-6">
      <section className={panelClass}>
        <button onClick={onBack} className="text-slate-400 hover:text-white text-sm mb-4">← Volver a resultados</button>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold break-words">{session.quizTitle}</h2>
            <p className="text-sm text-slate-400">
              {formatPlayedAt(session.playedAt)} · {session.groupName ?? "—"} · {session.className}
            </p>
          </div>
          <p className="text-right">
            <span className="block text-xs text-slate-400">Promedio de la sesión</span>
            <span className="text-3xl"><PercentBadge value={session.averagePercentage} /></span>
          </p>
        </div>
      </section>

      <section className={panelClass}>
        <h3 className="text-xl font-bold mb-1">❗ Preguntas más falladas</h3>
        <p className="text-xs text-slate-400 mb-4">% de quienes la contestaron bien. Las primeras son buenas candidatas para repasar.</p>
        <div className="grid grid-cols-1 gap-3">
          {questions.map((question) => (
            <div key={question.questionId} className="rounded-xl bg-black/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold break-words min-w-0">
                  {question.text ?? <span className="italic text-slate-400">(pregunta editada o borrada después de la sesión)</span>}
                </p>
                <span className="shrink-0 text-sm"><PercentBadge value={question.percentage} /></span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full rounded-full ${percentageBarClass(question.percentage)}`} style={{ width: `${question.percentage}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-400">{question.correct} de {question.answered} acertaron</p>
            </div>
          ))}
        </div>
      </section>

      <section className={panelClass}>
        <h3 className="text-xl font-bold mb-4">👥 Alumnos ({students.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2 pr-4">Alumno</th>
                <th className="py-2 pr-4 text-center">Aciertos</th>
                <th className="py-2 pr-4 text-center">%</th>
                <th className="py-2 text-right">Puntos</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const fullName = [student.name, student.lastNamePaternal].filter(Boolean).join(" ");
                return (
                  <tr key={student.studentId} className="border-t border-white/10">
                    <td className="py-3 pr-4">
                      <button onClick={() => onOpenStudent(student.studentId, fullName)} className="text-left hover:underline">
                        <span className="block font-semibold">{fullName}</span>
                        {student.nickname && <span className="block text-xs text-slate-400">{student.nickname}</span>}
                      </button>
                    </td>
                    <td className="py-3 pr-4 text-center whitespace-nowrap">{student.correctAnswers}/{student.totalQuestions}</td>
                    <td className="py-3 pr-4 text-center"><PercentBadge value={student.percentage} /></td>
                    <td className="py-3 text-right font-mono text-slate-300">{student.score.toLocaleString("es-MX")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

type View =
  | { kind: "list" }
  | { kind: "session"; sessionId: string }
  | { kind: "student"; sessionId: string; studentId: string; name: string };

// Resultados de los juegos en vivo: promedio = % de aciertos.
export default function ResultsPanel({ api }: { api: HostFetch }) {
  const catalog = useClassCatalog();
  const [groupChoice, setGroupChoice] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: "list" });

  const todayGroupName = getTodayGroupName();
  // "" = todos los grupos.
  const groupId = groupChoice ?? catalog.groups.find((group) => group.name === todayGroupName)?.id ?? "";
  const sessionsPath = catalog.loading ? null : `/host/results/sessions${groupId ? `?groupId=${groupId}` : ""}`;
  const { data: sessions, error, loading } = useHostResource<SessionResultSummary[]>(api, sessionsPath);

  if (view.kind === "session") {
    return (
      <SessionDetailView
        api={api}
        sessionId={view.sessionId}
        onBack={() => setView({ kind: "list" })}
        onOpenStudent={(studentId, name) => setView({ kind: "student", sessionId: view.sessionId, studentId, name })}
      />
    );
  }
  if (view.kind === "student") {
    return (
      <StudentHistoryView
        api={api}
        studentId={view.studentId}
        name={view.name}
        onBack={() => setView({ kind: "session", sessionId: view.sessionId })}
      />
    );
  }

  // Promedio por quiz: cada alumno pesa igual en todas las sesiones de ese quiz.
  const byQuiz = new Map<string, { title: string; sessions: number; students: number; weighted: number }>();
  for (const session of sessions ?? []) {
    const current = byQuiz.get(session.quizId) ?? { title: session.quizTitle, sessions: 0, students: 0, weighted: 0 };
    current.sessions += 1;
    current.students += session.students;
    current.weighted += session.averagePercentage * session.students;
    byQuiz.set(session.quizId, current);
  }
  const quizSummaries = [...byQuiz.entries()]
    .map(([quizId, item]) => ({ quizId, ...item, average: item.students > 0 ? Math.round(item.weighted / item.students) : 0 }))
    .sort((a, b) => a.average - b.average);

  return (
    <div className="grid grid-cols-1 gap-6">
      <section className={panelClass}>
        <h2 className="text-2xl font-bold mb-1">📊 Resultados</h2>
        <p className="text-sm text-slate-400 mb-4">El promedio es el % de aciertos. Los puntos solo cuentan para el podio.</p>
        <div className="md:max-w-sm">
          <label className={labelClass}>Grupo</label>
          <select value={groupId} onChange={(e) => setGroupChoice(e.target.value)} className={fieldClass}>
            <option value="" className="text-black">Todos los grupos</option>
            {catalog.groups.map((group) => (
              <option key={group.id} value={group.id} className="text-black">{group.name}</option>
            ))}
          </select>
        </div>
      </section>

      {(loading || catalog.loading) && <section className={panelClass}><p className="text-slate-400">Cargando...</p></section>}
      {error && <section className={panelClass}><p className="text-red-300">No pudimos cargar los resultados.</p></section>}

      {sessions && sessions.length === 0 && (
        <section className={panelClass}>
          <p className="text-slate-400 text-center py-6">Todavía no hay resultados. Aparecen al terminar un quiz en vivo.</p>
        </section>
      )}

      {sessions && sessions.length > 0 && (
        <>
          <section className={panelClass}>
            <h3 className="text-xl font-bold mb-4">Promedio por quiz</h3>
            <div className="grid grid-cols-1 gap-2">
              {quizSummaries.map((quiz) => (
                <div key={quiz.quizId} className="rounded-xl bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold truncate min-w-0">{quiz.title}</p>
                    <PercentBadge value={quiz.average} />
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div className={`h-full rounded-full ${percentageBarClass(quiz.average)}`} style={{ width: `${quiz.average}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {quiz.sessions} {quiz.sessions === 1 ? "sesión" : "sesiones"} · {quiz.students} {quiz.students === 1 ? "alumno" : "alumnos"}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className={panelClass}>
            <h3 className="text-xl font-bold mb-4">Sesiones</h3>
            <div className="grid grid-cols-1 gap-2">
              {sessions.map((session) => (
                <button
                  key={session.sessionId}
                  onClick={() => setView({ kind: "session", sessionId: session.sessionId })}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3 text-left hover:bg-white/10"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold truncate">{session.quizTitle}</span>
                    <span className="block text-xs text-slate-400 truncate">
                      {formatPlayedAt(session.playedAt)} · {session.groupName ?? "—"} · {formatClassDate(session.classDate)} — {session.className}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <PercentBadge value={session.averagePercentage} />
                    <span className="block text-xs text-slate-400">{session.students} alumnos</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
