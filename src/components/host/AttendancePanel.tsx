import { useEffect, useState } from "react";
import { useClassCatalog } from "../../hooks/useClassCatalog";
import { useClassSelection } from "../../hooks/useClassSelection";
import { panelClass } from "../../lib/hostStyles";
import type { AttendanceEntry, AttendanceStatus, HostFetch } from "../../types/Host";
import ClassPicker from "./ClassPicker";

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "Presente",
  LATE: "Retardo",
  JUSTIFIED: "Justificada",
  ABSENT: "Falta",
};

const STATUS_STYLE: Record<AttendanceStatus, string> = {
  PRESENT: "bg-green-500/20 text-green-300",
  LATE: "bg-yellow-500/20 text-yellow-300",
  JUSTIFIED: "bg-blue-500/20 text-blue-300",
  ABSENT: "bg-red-500/20 text-red-300",
};

const STATUSES = Object.keys(STATUS_LABEL) as AttendanceStatus[];

interface AttendancePanelProps {
  api: HostFetch;
  // Solo la admin puede cambiar la asistencia; las hosts solo la ven.
  canEdit: boolean;
}

export default function AttendancePanel({ api, canEdit }: AttendancePanelProps) {
  const catalog = useClassCatalog();
  const selection = useClassSelection(catalog.groups, catalog.classes);
  const classId = selection.classId;

  const [roster, setRoster] = useState<AttendanceEntry[]>([]);
  const [loadedClassId, setLoadedClassId] = useState("");
  const [error, setError] = useState("");
  const [savingStudentId, setSavingStudentId] = useState("");

  useEffect(() => {
    if (!classId) return;
    let cancelled = false;

    api(`/classes/${classId}/attendance`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`status ${response.status}`);
        const data: AttendanceEntry[] = await response.json();
        if (!cancelled) { setRoster(data); setLoadedClassId(classId); setError(""); }
      })
      .catch((err: unknown) => {
        console.error("Error cargando asistencia", err);
        if (!cancelled) { setRoster([]); setLoadedClassId(classId); setError("No pudimos cargar la asistencia de esta clase."); }
      });

    return () => { cancelled = true; };
  }, [api, classId]);

  const updateStatus = async (studentId: string, status: AttendanceStatus) => {
    setSavingStudentId(studentId);
    try {
      const response = await api(`/classes/${classId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, status }),
      });
      if (!response.ok) {
        setError("No pudimos guardar el cambio.");
        return;
      }
      setRoster((current) => current.map((entry) => (entry.studentId === studentId ? { ...entry, status } : entry)));
    } finally {
      setSavingStudentId("");
    }
  };

  const loading = Boolean(classId) && loadedClassId !== classId;
  const presentCount = roster.filter((entry) => entry.status === "PRESENT" || entry.status === "LATE").length;

  return (
    <div className="grid gap-6">
      <section className={panelClass}>
        <h2 className="text-2xl font-bold mb-4">Asistencia</h2>
        {catalog.error ? <p className="text-red-300">{catalog.error}</p> : <ClassPicker groups={catalog.groups} selection={selection} />}
        {!canEdit && <p className="text-xs text-slate-400 mt-3">Solo lectura: la administradora es quien puede corregir la asistencia.</p>}
      </section>

      <section className={panelClass}>
        {!classId ? (
          <p className="text-slate-400">Elige una clase.</p>
        ) : loading ? (
          <p className="text-slate-400">Cargando...</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <p className="text-lg">
                <span className="font-bold text-green-300">{presentCount}</span>
                <span className="text-slate-400"> de {roster.length} alumnas asistieron</span>
              </p>
              {error && <p className="text-red-300 text-sm">{error}</p>}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-400">
                  <tr>
                    <th className="py-2 pr-4">Alumna</th>
                    <th className="py-2 pr-4">Nickname</th>
                    <th className="py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((entry) => (
                    <tr key={entry.studentId} className="border-t border-white/10">
                      <td className="py-3 pr-4">{entry.name}</td>
                      <td className="py-3 pr-4 text-slate-400">{entry.nickname}</td>
                      <td className="py-3">
                        {canEdit ? (
                          <select
                            value={entry.status ?? ""}
                            disabled={savingStudentId === entry.studentId}
                            onChange={(e) => void updateStatus(entry.studentId, e.target.value as AttendanceStatus)}
                            className="rounded-lg bg-white/10 border border-white/20 p-2 text-white"
                          >
                            {!entry.status && <option value="" className="text-black">Sin registro</option>}
                            {STATUSES.map((status) => (
                              <option key={status} value={status} className="text-black">{STATUS_LABEL[status]}</option>
                            ))}
                          </select>
                        ) : entry.status ? (
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[entry.status]}`}>
                            {STATUS_LABEL[entry.status]}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">Sin registro</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {roster.length === 0 && !error && (
                <p className="text-slate-400 text-center py-8">Este grupo todavía no tiene alumnas inscritas.</p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
