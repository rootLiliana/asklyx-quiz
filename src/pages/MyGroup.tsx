import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import MaterialView from "../components/material/MaterialView";
import { formatClassDate, todayIsoDay, toIsoDay } from "../lib/classDates";
import { studentFetch } from "../lib/studentSession";
import type { Material, StudentClassMaterials } from "../types/Material";

function Shell({ children, onBack, backLabel }: { children: ReactNode; onBack: () => void; backLabel: string }) {
  return (
    <div className="min-h-dvh bg-gradient-to-br from-purple-900 via-indigo-900 to-black px-4 py-8 sm:p-8 flex justify-center">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-3xl">
        <button onClick={onBack} className="text-white/60 text-sm mb-4 hover:text-white transition">← {backLabel}</button>
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-5 sm:p-8 text-white shadow-2xl">{children}</div>
      </motion.div>
    </div>
  );
}

function formatTime(value: string | null): string {
  return value ? value.slice(0, 5) : "";
}

// Lector de un material (solo si está publicado y es de su grupo).
function MaterialReader({ materialId, onBack }: { materialId: string; onBack: () => void }) {
  const navigate = useNavigate();
  const [material, setMaterial] = useState<Material | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    studentFetch(`/me/materials/${materialId}`)
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) { navigate("/join"); return; }
        if (!response.ok) throw new Error(`status ${response.status}`);
        const data: Material = await response.json();
        if (!cancelled) setMaterial(data);
      })
      .catch((err: unknown) => {
        console.error("Error abriendo material:", err);
        if (!cancelled) setError(true);
      });

    return () => { cancelled = true; };
  }, [materialId, navigate]);

  return (
    <Shell onBack={onBack} backLabel="Volver a mis clases">
      {error && <p className="text-red-300">Este material ya no está disponible.</p>}
      {!material && !error && <p className="text-white/70">Cargando...</p>}
      {material && (
        <>
          <h1 className="text-2xl sm:text-3xl font-bold mb-6 break-words">{material.title}</h1>
          <MaterialView blocks={material.blocks} />
        </>
      )}
    </Shell>
  );
}

export default function MyGroup() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<StudentClassMaterials[] | null>(null);
  const [error, setError] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [openMaterialId, setOpenMaterialId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    studentFetch("/me/classes")
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) { navigate("/join"); return; }
        if (!response.ok) throw new Error(`status ${response.status}`);
        const data: StudentClassMaterials[] = await response.json();
        if (!cancelled) setClasses(data);
      })
      .catch((err: unknown) => {
        console.error("Error cargando mis clases:", err);
        if (!cancelled) setError(true);
      });

    return () => { cancelled = true; };
  }, [navigate]);

  if (openMaterialId) {
    return <MaterialReader materialId={openMaterialId} onBack={() => setOpenMaterialId(null)} />;
  }

  const today = todayIsoDay();
  const upcoming = (classes ?? []).filter((classItem) => (toIsoDay(classItem.classDate) ?? "") >= today);
  const past = (classes ?? []).filter((classItem) => (toIsoDay(classItem.classDate) ?? "") < today).reverse();
  const visible = showPast ? past : upcoming;
  const nextClassId = upcoming[0]?.id;
  const groupNames = [...new Set((classes ?? []).map((classItem) => classItem.groupName))];

  return (
    <Shell onBack={() => navigate("/join")} backLabel="Volver">
      <h1 className="text-3xl sm:text-4xl font-bold mb-1">📚 Mi grupo</h1>
      {groupNames.length > 0 && <p className="text-white/70 mb-6">{groupNames.join(" · ")}</p>}

      {error && <p className="text-red-300">No pudimos cargar tus clases. Intenta más tarde.</p>}
      {!classes && !error && <p className="text-white/70">Cargando...</p>}

      {classes && classes.length === 0 && (
        <div className="text-center py-8">
          <p className="text-5xl mb-3">🗂️</p>
          <p className="text-white/80">Todavía no estás inscrito en un grupo o tu grupo aún no tiene clases.</p>
          <p className="text-white/60 text-sm mt-2">Tu profe te inscribirá pronto. ¡Vuelve más tarde!</p>
        </div>
      )}

      {classes && classes.length > 0 && (
        <>
          <div className="mb-5 flex rounded-xl bg-black/30 p-1 w-fit">
            {[false, true].map((isPast) => (
              <button
                key={String(isPast)}
                onClick={() => setShowPast(isPast)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${showPast === isPast ? "bg-fuchsia-600" : "hover:bg-white/10"}`}
              >
                {isPast ? `Pasadas (${past.length})` : `Próximas (${upcoming.length})`}
              </button>
            ))}
          </div>

          {visible.length === 0 && (
            <p className="text-white/60 text-center py-6">{showPast ? "Todavía no hay clases pasadas." : "No hay clases próximas."}</p>
          )}

          <div className="grid grid-cols-1 gap-3">
            {visible.map((classItem) => {
              const isToday = toIsoDay(classItem.classDate) === today;
              const isNext = !showPast && classItem.id === nextClassId;
              return (
                <div
                  key={classItem.id}
                  className={`rounded-2xl p-4 ${isNext ? "border border-fuchsia-400/60 bg-fuchsia-500/15" : "bg-white/5"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-white/60">
                        {formatClassDate(classItem.classDate)}
                        {classItem.startTime && ` · ${formatTime(classItem.startTime)}${classItem.endTime ? `–${formatTime(classItem.endTime)}` : ""}`}
                      </p>
                      <p className="font-bold text-lg break-words">{classItem.name}</p>
                    </div>
                    {isToday ? (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-200">Hoy</span>
                    ) : isNext ? (
                      <span className="rounded-full bg-fuchsia-500/30 px-2 py-0.5 text-xs text-fuchsia-100">Próxima clase</span>
                    ) : null}
                  </div>

                  {classItem.materials.length > 0 ? (
                    <div className="mt-3 grid grid-cols-1 gap-2">
                      {classItem.materials.map((material) => (
                        <button
                          key={material.id}
                          onClick={() => setOpenMaterialId(material.id)}
                          className="flex items-center gap-3 rounded-xl bg-black/20 p-3 text-left hover:bg-black/30"
                        >
                          <span className="text-xl">📖</span>
                          <span className="font-semibold break-words">{material.title}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-white/50">Sin material todavía.</p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </Shell>
  );
}
