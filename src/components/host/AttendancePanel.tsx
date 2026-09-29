import { useEffect, useState } from "react";
import { useClassCatalog } from "../../hooks/useClassCatalog";
import { formatClassDate, todayIsoDay, toIsoDay } from "../../lib/classDates";
import { fieldClass, labelClass, panelClass } from "../../lib/hostStyles";
import { getTodayGroupName } from "../../lib/studentGroup";
import type { AttendanceStatus, GroupAttendanceMatrix, HostFetch } from "../../types/Host";

// Cuenta como asistencia (✓): presente o con retardo.
const ATTENDED: AttendanceStatus[] = ["PRESENT", "LATE"];

const CELL: Record<AttendanceStatus | "NONE", { symbol: string; className: string; label: string }> = {
  PRESENT: { symbol: "✓", className: "bg-green-500/20 text-green-300", label: "Asistió" },
  LATE: { symbol: "✓", className: "bg-yellow-500/20 text-yellow-200", label: "Asistió con retardo" },
  JUSTIFIED: { symbol: "J", className: "bg-blue-500/20 text-blue-200", label: "Falta justificada" },
  ABSENT: { symbol: "✗", className: "bg-red-500/15 text-red-300", label: "Faltó" },
  NONE: { symbol: "✗", className: "bg-red-500/10 text-red-300/70", label: "Sin asistencia" },
};

function shortDate(classDate: string | null): string {
  const isoDay = toIsoDay(classDate);
  if (!isoDay) return "—";
  return new Date(`${isoDay}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

interface AttendancePanelProps {
  api: HostFetch;
  // Solo la admin puede cambiar la asistencia; las hosts solo la ven.
  canEdit: boolean;
}

export default function AttendancePanel({ api, canEdit }: AttendancePanelProps) {
  const catalog = useClassCatalog();
  const [groupChoice, setGroupChoice] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<GroupAttendanceMatrix | null>(null);
  const [loadedGroupId, setLoadedGroupId] = useState("");
  const [error, setError] = useState("");
  const [savingCell, setSavingCell] = useState("");

  const todayGroupName = getTodayGroupName();
  const groupId =
    groupChoice ??
    catalog.groups.find((group) => group.name === todayGroupName)?.id ??
    catalog.groups[0]?.id ??
    "";

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;

    api(`/groups/${groupId}/attendance`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`status ${response.status}`);
        const data: GroupAttendanceMatrix = await response.json();
        if (!cancelled) { setMatrix(data); setLoadedGroupId(groupId); setError(""); }
      })
      .catch((err: unknown) => {
        console.error("Error cargando asistencia", err);
        if (!cancelled) { setMatrix(null); setLoadedGroupId(groupId); setError("No pudimos cargar la asistencia de este grupo."); }
      });

    return () => { cancelled = true; };
  }, [api, groupId]);

  const statusOf = (classId: string, studentId: string): AttendanceStatus | null =>
    matrix?.records.find((record) => record.classId === classId && record.studentId === studentId)?.status ?? null;

  // Admin: tocar una celda alterna ✓ (PRESENT) / ✗ (ABSENT). Se actualiza al
  // momento y se revierte si el servidor falla.
  const toggle = async (classId: string, studentId: string) => {
    if (!canEdit || !matrix) return;
    const current = statusOf(classId, studentId);
    const next: AttendanceStatus = current && ATTENDED.includes(current) ? "ABSENT" : "PRESENT";
    const cellKey = `${classId}:${studentId}`;
    const previous = matrix;

    setSavingCell(cellKey);
    setMatrix({
      ...matrix,
      records: [
        ...matrix.records.filter((record) => !(record.classId === classId && record.studentId === studentId)),
        { classId, studentId, status: next },
      ],
    });

    try {
      const response = await api(`/classes/${classId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, status: next }),
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
    } catch (err) {
      console.error("Error guardando asistencia", err);
      setMatrix(previous);
      setError("No pudimos guardar el cambio.");
    } finally {
      setSavingCell("");
    }
  };

  const today = todayIsoDay();
  // Las clases futuras no se muestran: todavía no pueden tener asistencia.
  const classes = (matrix?.classes ?? []).filter((classItem) => (toIsoDay(classItem.classDate) ?? "") <= today);
  const students = matrix?.students ?? [];
  const loading = Boolean(groupId) && loadedGroupId !== groupId;

  const attendedCount = (studentId: string) =>
    classes.filter((classItem) => ATTENDED.includes(statusOf(classItem.id, studentId) as AttendanceStatus)).length;
  const classCount = (classId: string) =>
    students.filter((student) => ATTENDED.includes(statusOf(classId, student.id) as AttendanceStatus)).length;

  return (
    <div className="grid grid-cols-1 gap-6">
      <section className={panelClass}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1 md:max-w-sm">
            <h2 className="text-2xl font-bold mb-4">Asistencia</h2>
            <label className={labelClass}>Grupo</label>
            <select value={groupId} onChange={(e) => setGroupChoice(e.target.value)} className={fieldClass}>
              {catalog.groups.map((group) => (
                <option key={group.id} value={group.id} className="text-black">{group.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {(["PRESENT", "LATE", "JUSTIFIED", "NONE"] as const).map((key) => (
              <span key={key} className={`rounded-full px-2 py-1 ${CELL[key].className}`}>
                {CELL[key].symbol} {CELL[key].label}
              </span>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          {canEdit ? "Toca una celda para cambiar entre ✓ y ✗." : "Solo lectura: la administradora es quien puede corregir la asistencia."}
        </p>
        {catalog.error && <p className="text-red-300 mt-2">{catalog.error}</p>}
      </section>

      <section className={panelClass}>
        {loading || catalog.loading ? (
          <p className="text-slate-400">Cargando...</p>
        ) : error && !matrix ? (
          <p className="text-red-300">{error}</p>
        ) : students.length === 0 ? (
          <p className="text-slate-400 text-center py-8">Este grupo todavía no tiene alumnos inscritos.</p>
        ) : classes.length === 0 ? (
          <p className="text-slate-400 text-center py-8">Este grupo todavía no ha tenido clases.</p>
        ) : (
          <>
            {error && <p className="text-red-300 mb-3 text-sm">{error}</p>}
            {classes.length > 2 && <p className="mb-2 text-xs text-slate-400 sm:hidden">Desliza la tabla para ver más clases →</p>}
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="min-w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-20 bg-slate-900 px-2 sm:px-3 py-2 text-left font-semibold text-slate-300 min-w-[7rem] sm:min-w-[9rem]">
                      Alumno
                    </th>
                    {classes.map((classItem) => (
                      <th
                        key={classItem.id}
                        title={`${formatClassDate(classItem.classDate)} — ${classItem.name}`}
                        className={`px-2 py-2 text-center font-semibold whitespace-nowrap ${toIsoDay(classItem.classDate) === today ? "bg-emerald-900/60 text-emerald-200" : "bg-slate-900/90 text-slate-300"}`}
                      >
                        {shortDate(classItem.classDate)}
                        <span className="block max-w-[6rem] truncate text-[10px] font-normal text-slate-400">{classItem.name}</span>
                      </th>
                    ))}
                    <th className="bg-slate-900/90 px-3 py-2 text-center font-semibold text-slate-300 whitespace-nowrap">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const attended = attendedCount(student.id);
                    const percentage = Math.round((attended / classes.length) * 100);
                    return (
                      <tr key={student.id} className="border-t border-white/10">
                        <td className="sticky left-0 z-10 bg-slate-900 px-2 sm:px-3 py-2 border-t border-white/10">
                          <span className="block max-w-[7rem] sm:max-w-[11rem] truncate font-semibold">
                            {[student.name, student.lastNamePaternal].filter(Boolean).join(" ")}
                          </span>
                          {student.nickname && <span className="block max-w-[7rem] sm:max-w-[11rem] truncate text-xs text-slate-400">{student.nickname}</span>}
                        </td>
                        {classes.map((classItem) => {
                          const status = statusOf(classItem.id, student.id);
                          const cell = CELL[status ?? "NONE"];
                          const cellKey = `${classItem.id}:${student.id}`;
                          return (
                            <td key={classItem.id} className="border-t border-white/10 p-1 text-center">
                              <button
                                type="button"
                                disabled={!canEdit || savingCell === cellKey}
                                onClick={() => void toggle(classItem.id, student.id)}
                                title={cell.label}
                                aria-label={`${student.name}, ${shortDate(classItem.classDate)}: ${cell.label}`}
                                className={`h-9 w-9 rounded-lg text-base font-black ${cell.className} ${canEdit ? "hover:ring-2 hover:ring-white/40 cursor-pointer" : "cursor-default"} disabled:opacity-100`}
                              >
                                {cell.symbol}
                              </button>
                            </td>
                          );
                        })}
                        <td className="border-t border-white/10 px-3 py-2 text-center whitespace-nowrap">
                          <span className="font-bold">{attended}/{classes.length}</span>
                          <span className={`block text-xs ${percentage >= 80 ? "text-green-300" : percentage >= 60 ? "text-yellow-300" : "text-red-300"}`}>
                            {percentage}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="sticky left-0 z-10 bg-slate-900 px-3 py-2 border-t border-white/20 text-xs font-semibold text-slate-300">
                      Asistieron
                    </td>
                    {classes.map((classItem) => (
                      <td key={classItem.id} className="border-t border-white/20 px-2 py-2 text-center text-xs text-slate-300">
                        {classCount(classItem.id)}/{students.length}
                      </td>
                    ))}
                    <td className="border-t border-white/20" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
