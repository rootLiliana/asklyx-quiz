import { useEffect, useState } from "react";
import { useClassCatalog } from "../../hooks/useClassCatalog";
import { formatClassDate, nextDateOnWeekdays, todayIsoDay, toIsoDay } from "../../lib/classDates";
import { fieldClass, labelClass, panelClass } from "../../lib/hostStyles";
import { getWeekdaysForGroup } from "../../lib/studentGroup";
import type { ClassSummary, GroupSummary, HostFetch, ModuleSummary } from "../../types/Host";

// "18:00:00" -> "18:00" (lo que usa <input type="time">)
function toTimeInput(value: string | null): string {
  return value ? value.slice(0, 5) : "";
}

function formatTimeRange(classItem: ClassSummary): string {
  const start = toTimeInput(classItem.startTime);
  const end = toTimeInput(classItem.endTime);
  if (!start && !end) return "—";
  return end ? `${start} – ${end}` : start;
}

async function readError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null);
  return typeof body?.message === "string" ? `${fallback} (${body.message})` : fallback;
}

interface CommonFields {
  moduleId: string;
  name: string;
  description: string;
  startTime: string;
  endTime: string;
}

function CommonFieldsForm({ value, onChange, modules }: {
  value: CommonFields;
  onChange: (value: CommonFields) => void;
  modules: ModuleSummary[];
}) {
  const set = (changes: Partial<CommonFields>) => onChange({ ...value, ...changes });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <label className={labelClass}>Módulo</label>
        <select value={value.moduleId} onChange={(e) => set({ moduleId: e.target.value })} className={fieldClass}>
          {modules.length === 0 && <option value="" className="text-black">No hay módulos</option>}
          {modules.map((module) => (
            <option key={module.id} value={module.id} className="text-black">{module.orderNumber}. {module.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Nombre de la clase</label>
        <input value={value.name} onChange={(e) => set({ name: e.target.value })} maxLength={200} placeholder="Ej: Pandas: limpieza de datos" className={fieldClass} />
      </div>
      <div className="md:col-span-2">
        <label className={labelClass}>Descripción (opcional)</label>
        <textarea value={value.description} onChange={(e) => set({ description: e.target.value })} className={`${fieldClass} min-h-20`} />
      </div>
      <div>
        <label className={labelClass}>Hora de inicio (opcional)</label>
        <input type="time" value={value.startTime} onChange={(e) => set({ startTime: e.target.value })} className={fieldClass} />
      </div>
      <div>
        <label className={labelClass}>Hora de fin (opcional)</label>
        <input type="time" value={value.endTime} onChange={(e) => set({ endTime: e.target.value })} className={fieldClass} />
      </div>
    </div>
  );
}

function validateCommon(fields: CommonFields): string {
  if (!fields.moduleId) return "Elige el módulo.";
  if (!fields.name.trim()) return "Escribe el nombre de la clase.";
  if (fields.startTime && fields.endTime && fields.endTime <= fields.startTime) return "La hora de fin debe ser después de la de inicio.";
  return "";
}

interface GroupDate {
  enabled: boolean;
  classDate: string;
}

// Mismo tema para uno o varios grupos: una clase por grupo, cada una en la
// próxima fecha que le toca a ese grupo según sus días.
function NewClassForm({ api, groups, modules, onCreated }: {
  api: HostFetch;
  groups: GroupSummary[];
  modules: ModuleSummary[];
  onCreated: (count: number) => void;
}) {
  const [fields, setFields] = useState<CommonFields>(() => ({
    moduleId: modules[0]?.id ?? "",
    name: "",
    description: "",
    startTime: "",
    endTime: "",
  }));
  const [groupDates, setGroupDates] = useState<Record<string, GroupDate>>(() =>
    Object.fromEntries(groups.map((group) => [
      group.id,
      { enabled: getWeekdaysForGroup(group.name).length > 0, classDate: nextDateOnWeekdays(getWeekdaysForGroup(group.name)) },
    ])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setGroupDate = (groupId: string, changes: Partial<GroupDate>) => {
    setGroupDates((current) => ({
      ...current,
      [groupId]: { ...(current[groupId] ?? { enabled: false, classDate: todayIsoDay() }), ...changes },
    }));
  };

  const sessions = groups
    .filter((group) => groupDates[group.id]?.enabled)
    .map((group) => ({ groupId: group.id, classDate: groupDates[group.id]?.classDate ?? "" }));

  const create = async () => {
    const problem = validateCommon(fields) || (sessions.length === 0 ? "Marca al menos un grupo." : "") ||
      (sessions.some((session) => !session.classDate) ? "Pon la fecha de cada grupo marcado." : "");
    if (problem) { setError(problem); return; }

    setSaving(true);
    setError("");
    try {
      const response = await api("/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, sessions }),
      });
      if (!response.ok) {
        setError(await readError(response, "No pudimos crear la clase."));
        return;
      }
      setFields((current) => ({ ...current, name: "", description: "" }));
      onCreated(sessions.length);
    } catch (err) {
      console.error("Error creando clase", err);
      setError("No pudimos conectarnos con el servidor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={panelClass}>
      <h2 className="text-2xl font-bold mb-1">Nueva clase</h2>
      <p className="text-sm text-slate-400 mb-4">Si el tema es el mismo para varios grupos, márcalos: se crea una clase para cada uno en su fecha.</p>

      <CommonFieldsForm value={fields} onChange={setFields} modules={modules} />

      <p className={`${labelClass} mt-5`}>Grupos y fechas</p>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {groups.map((group) => {
          const groupDate = groupDates[group.id];
          return (
            <div key={group.id} className={`flex flex-wrap items-center gap-3 rounded-xl p-3 border ${groupDate?.enabled ? "bg-fuchsia-600/20 border-fuchsia-400/60" : "bg-white/5 border-white/10"}`}>
              <label className="flex items-center gap-2 flex-1 min-w-40 cursor-pointer">
                <input type="checkbox" checked={groupDate?.enabled ?? false} onChange={(e) => setGroupDate(group.id, { enabled: e.target.checked })} />
                <span className="font-semibold">{group.name}</span>
              </label>
              <input
                type="date"
                value={groupDate?.classDate ?? ""}
                disabled={!groupDate?.enabled}
                onChange={(e) => setGroupDate(group.id, { classDate: e.target.value })}
                className="rounded-lg bg-white/10 border border-white/20 p-2 text-white disabled:opacity-40"
              />
              {groupDate?.enabled && groupDate.classDate && (
                <span className="text-xs text-slate-300 w-full">{formatClassDate(groupDate.classDate)}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4 mt-5">
        <button onClick={create} disabled={saving} className="rounded-xl bg-green-600 hover:bg-green-500 px-5 py-3 font-bold disabled:opacity-50">
          {saving ? "Creando..." : sessions.length > 1 ? `Crear ${sessions.length} clases` : "Crear clase"}
        </button>
        {error && <p className="text-red-300 text-sm">{error}</p>}
      </div>
    </section>
  );
}

function EditClassForm({ api, classItem, groups, modules, onSaved, onCancel }: {
  api: HostFetch;
  classItem: ClassSummary;
  groups: GroupSummary[];
  modules: ModuleSummary[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState<CommonFields>({
    moduleId: classItem.moduleId,
    name: classItem.name,
    description: classItem.description ?? "",
    startTime: toTimeInput(classItem.startTime),
    endTime: toTimeInput(classItem.endTime),
  });
  const [groupId, setGroupId] = useState(classItem.groupId);
  const [classDate, setClassDate] = useState(toIsoDay(classItem.classDate) ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    const problem = validateCommon(fields) || (!classDate ? "Pon la fecha." : "");
    if (problem) { setError(problem); return; }

    setSaving(true);
    setError("");
    try {
      const response = await api(`/classes/${classItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, groupId, classDate }),
      });
      if (!response.ok) {
        setError(await readError(response, "No pudimos guardar los cambios."));
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl bg-black/30 border border-fuchsia-400/40 p-5 my-2">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
        <div>
          <label className={labelClass}>Grupo</label>
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={fieldClass}>
            {groups.map((group) => (
              <option key={group.id} value={group.id} className="text-black">{group.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Fecha</label>
          <input type="date" value={classDate} onChange={(e) => setClassDate(e.target.value)} className={fieldClass} />
        </div>
      </div>
      <CommonFieldsForm value={fields} onChange={setFields} modules={modules} />
      <div className="flex flex-wrap items-center gap-3 mt-4">
        <button onClick={save} disabled={saving} className="rounded-xl bg-green-600 hover:bg-green-500 px-4 py-2 font-bold disabled:opacity-50">
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
        <button onClick={onCancel} className="rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2">Cancelar</button>
        {error && <p className="text-red-300 text-sm">{error}</p>}
      </div>
    </div>
  );
}

interface ClassesPanelProps {
  api: HostFetch;
  // Avisa que cambiaron las clases (para refrescar otros selectores).
  onChanged: () => void;
}

export default function ClassesPanel({ api, onChanged }: ClassesPanelProps) {
  const catalog = useClassCatalog();
  const [modules, setModules] = useState<ModuleSummary[] | null>(null);
  const [modulesError, setModulesError] = useState("");
  const [filterGroupId, setFilterGroupId] = useState("");
  const [showPast, setShowPast] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    api("/modules")
      .then(async (response) => {
        if (!response.ok) throw new Error(`status ${response.status}`);
        const data: ModuleSummary[] = await response.json();
        if (!cancelled) setModules(data);
      })
      .catch((err: unknown) => {
        console.error("Error cargando módulos", err);
        if (!cancelled) { setModules([]); setModulesError("No pudimos cargar los módulos."); }
      });

    return () => { cancelled = true; };
  }, [api]);

  const refresh = (text: string) => {
    setMessage(text);
    setEditingId(null);
    catalog.reload();
    onChanged();
  };

  const remove = async (classItem: ClassSummary) => {
    if (!window.confirm(`¿Borrar la clase "${classItem.name}" del ${formatClassDate(classItem.classDate)}?`)) return;

    const response = await api(`/classes/${classItem.id}`, { method: "DELETE" });
    if (response.status === 409) {
      setMessage("No se puede borrar: esta clase ya tiene quizzes, sesiones de juego o asistencia. Puedes editarla en su lugar.");
      return;
    }
    if (!response.ok) {
      setMessage("No pudimos borrar la clase.");
      return;
    }
    refresh("Clase borrada.");
  };

  const today = todayIsoDay();
  const groupName = (id: string) => catalog.groups.find((group) => group.id === id)?.name ?? `Grupo ${id}`;
  const moduleName = (id: string) => modules?.find((module) => module.id === id)?.name ?? `Módulo ${id}`;

  const visibleClasses = catalog.classes
    .filter((classItem) => !filterGroupId || classItem.groupId === filterGroupId)
    .filter((classItem) => {
      const day = toIsoDay(classItem.classDate) ?? "";
      return showPast ? day < today : day >= today;
    })
    .sort((a, b) => {
      const order = (toIsoDay(a.classDate) ?? "").localeCompare(toIsoDay(b.classDate) ?? "");
      return showPast ? -order : order;
    });

  if (catalog.loading || modules === null) {
    return <section className={panelClass}><p className="text-slate-400">Cargando...</p></section>;
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      {catalog.error || modulesError ? (
        <section className={panelClass}><p className="text-red-300">{catalog.error || modulesError}</p></section>
      ) : (
        <NewClassForm
          api={api}
          groups={catalog.groups}
          modules={modules}
          onCreated={(count) => refresh(count > 1 ? `✓ Se crearon ${count} clases.` : "✓ Clase creada.")}
        />
      )}

      <section className={panelClass}>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
          <div className="flex rounded-xl bg-black/30 p-1">
            {[false, true].map((past) => (
              <button
                key={String(past)}
                onClick={() => setShowPast(past)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${showPast === past ? "bg-fuchsia-600" : "hover:bg-white/10"}`}
              >
                {past ? "Pasadas" : "Próximas"}
              </button>
            ))}
          </div>
          <select value={filterGroupId} onChange={(e) => setFilterGroupId(e.target.value)} className={`${fieldClass} md:max-w-xs`}>
            <option value="" className="text-black">Todos los grupos</option>
            {catalog.groups.map((group) => (
              <option key={group.id} value={group.id} className="text-black">{group.name}</option>
            ))}
          </select>
        </div>

        {message && <p className="text-fuchsia-200 mb-4">{message}</p>}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2 pr-4">Fecha</th>
                <th className="py-2 pr-4">Grupo</th>
                <th className="py-2 pr-4">Clase</th>
                <th className="py-2 pr-4">Módulo</th>
                <th className="py-2 pr-4">Horario</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleClasses.map((classItem) => (
                editingId === classItem.id ? (
                  <tr key={classItem.id}>
                    <td colSpan={6}>
                      <EditClassForm
                        api={api}
                        classItem={classItem}
                        groups={catalog.groups}
                        modules={modules}
                        onSaved={() => refresh("✓ Cambios guardados.")}
                        onCancel={() => setEditingId(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={classItem.id} className="border-t border-white/10">
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {formatClassDate(classItem.classDate)}
                      {toIsoDay(classItem.classDate) === today && <span className="ml-2 rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5 text-xs">hoy</span>}
                    </td>
                    <td className="py-3 pr-4 text-slate-300">{groupName(classItem.groupId)}</td>
                    <td className="py-3 pr-4 font-semibold">{classItem.name}</td>
                    <td className="py-3 pr-4 text-slate-300">{moduleName(classItem.moduleId)}</td>
                    <td className="py-3 pr-4 text-slate-300 whitespace-nowrap">{formatTimeRange(classItem)}</td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <button onClick={() => { setMessage(""); setEditingId(classItem.id); }} className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1 mr-2">
                        Editar
                      </button>
                      <button onClick={() => void remove(classItem)} className="rounded-lg bg-red-600/80 hover:bg-red-500 px-3 py-1">
                        Borrar
                      </button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
          {visibleClasses.length === 0 && (
            <p className="text-slate-400 text-center py-8">{showPast ? "No hay clases pasadas." : "No hay clases próximas. Crea una arriba."}</p>
          )}
        </div>
      </section>
    </div>
  );
}
