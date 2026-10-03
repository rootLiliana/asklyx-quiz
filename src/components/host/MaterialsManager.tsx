import { useEffect, useState } from "react";
import { fieldClass, labelClass, panelClass } from "../../lib/hostStyles";
import type { ClassSummary, HostFetch } from "../../types/Host";
import type { CodeLanguage, Material, MaterialBlock } from "../../types/Material";
import MaterialView from "../material/MaterialView";
import { initialScheduledAt, publishModeOf, resolvePublishedAt, scheduleProblem, type PublishMode } from "../../lib/publishing";
import PracticeManager from "./PracticeManager";
import { PublishPicker, StatusBadge } from "./Publishing";

// Bloque en edición: `key` estable para React aunque se reordenen.
type EditableBlock = MaterialBlock & { key: string };

const TEXT_HELP = "# Título · ## Subtítulo · **negritas** · *cursiva* · `código` · líneas con - o 1. para listas";

function newBlock(type: MaterialBlock["type"]): EditableBlock {
  const key = crypto.randomUUID();
  if (type === "text") return { key, type, text: "" };
  if (type === "code") return { key, type, language: "python", code: "" };
  return { key, type, url: "", label: "" };
}

// Lo que se envía al servidor: solo los campos de cada tipo, sin `key`.
function toBlock(block: EditableBlock): MaterialBlock {
  if (block.type === "text") return { type: "text", text: block.text };
  if (block.type === "code") return { type: "code", language: block.language, code: block.code };
  return { type: "link", url: block.url.trim(), label: block.label.trim() };
}

function validate(title: string, blocks: EditableBlock[], mode: PublishMode, scheduledAt: string): string {
  if (!title.trim()) return "Escribe un título.";
  if (blocks.length === 0) return "Agrega al menos un bloque.";
  for (const [index, block] of blocks.entries()) {
    const where = `Bloque ${index + 1}`;
    if (block.type === "text" && !block.text.trim()) return `${where}: escribe el texto o quita el bloque.`;
    if (block.type === "code" && !block.code.trim()) return `${where}: escribe el código o quita el bloque.`;
    if (block.type === "link" && !/^https?:\/\/\S+$/i.test(block.url.trim())) return `${where}: el enlace debe empezar con https://`;
  }
  return scheduleProblem(mode, scheduledAt);
}

function MaterialEditor({ api, classId, material, onSaved, onCancel }: {
  api: HostFetch;
  classId: string;
  material: Material | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(material?.title ?? "");
  const [blocks, setBlocks] = useState<EditableBlock[]>(() =>
    material ? material.blocks.map((block) => ({ ...block, key: crypto.randomUUID() })) : [newBlock("text")],
  );
  const [mode, setMode] = useState<PublishMode>(() => publishModeOf(material?.publishedAt ?? null));
  const [scheduledAt, setScheduledAt] = useState(() => initialScheduledAt(material?.publishedAt ?? null));
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateBlock = (key: string, changes: Partial<MaterialBlock>) => {
    setBlocks((current) => current.map((block) => (block.key === key ? { ...block, ...changes } as EditableBlock : block)));
  };

  const moveBlock = (index: number, offset: -1 | 1) => {
    setBlocks((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };

  const save = async () => {
    const problem = validate(title, blocks, mode, scheduledAt);
    if (problem) { setError(problem); return; }

    const publishedAt = resolvePublishedAt(mode, scheduledAt, material?.publishedAt ?? null);

    setSaving(true);
    setError("");
    try {
      const response = await api(material ? `/materials/${material.id}` : `/classes/${classId}/materials`, {
        method: material ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          blocks: blocks.map(toBlock),
          publishedAt,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(`No pudimos guardar el material.${body?.message ? ` (${body.message})` : ""}`);
        return;
      }
      onSaved();
    } catch (err) {
      console.error("Error guardando material", err);
      setError("No pudimos conectarnos con el servidor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={panelClass}>
      <button onClick={onCancel} className="text-slate-400 hover:text-white text-sm mb-4">← Volver al material de la clase</button>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="text-2xl font-bold">{material ? "Editar material" : "Nuevo material"}</h2>
        <div className="flex rounded-xl bg-black/30 p-1">
          {[false, true].map((isPreview) => (
            <button
              key={String(isPreview)}
              onClick={() => setPreview(isPreview)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${preview === isPreview ? "bg-fuchsia-600" : "hover:bg-white/10"}`}
            >
              {isPreview ? "👀 Vista previa" : "✏️ Editar"}
            </button>
          ))}
        </div>
      </div>

      {preview ? (
        <div className="rounded-2xl bg-black/20 p-4 sm:p-6">
          <h3 className="text-2xl font-bold mb-5 break-words">{title || "Sin título"}</h3>
          <MaterialView blocks={blocks} />
        </div>
      ) : (
        <>
          <label className={labelClass}>Título</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Ej: Lectura previa — groupby" className={`${fieldClass} mb-5`} />

          <div className="grid grid-cols-1 gap-4">
            {blocks.map((block, index) => (
              <div key={block.key} className="rounded-2xl bg-black/20 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-sm font-semibold text-slate-300">
                    {block.type === "text" ? "📝 Texto" : block.type === "code" ? "💻 Código" : "🔗 Enlace"}
                  </span>
                  <span className="flex gap-1">
                    <button onClick={() => moveBlock(index, -1)} disabled={index === 0} title="Subir" className="rounded-lg px-2 py-1 hover:bg-white/10 disabled:opacity-30">↑</button>
                    <button onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1} title="Bajar" className="rounded-lg px-2 py-1 hover:bg-white/10 disabled:opacity-30">↓</button>
                    <button onClick={() => setBlocks((current) => current.filter((item) => item.key !== block.key))} title="Quitar bloque" className="rounded-lg px-2 py-1 text-red-300 hover:bg-red-500/20">✕</button>
                  </span>
                </div>

                {block.type === "text" && (
                  <>
                    <textarea
                      value={block.text}
                      onChange={(e) => updateBlock(block.key, { text: e.target.value })}
                      placeholder="Escribe la lectura, instrucciones o explicación..."
                      className={`${fieldClass} min-h-40`}
                    />
                    <p className="mt-1 text-xs text-slate-500">{TEXT_HELP}</p>
                  </>
                )}

                {block.type === "code" && (
                  <>
                    <select
                      value={block.language}
                      onChange={(e) => updateBlock(block.key, { language: e.target.value as CodeLanguage })}
                      className={`${fieldClass} mb-2 sm:max-w-xs`}
                    >
                      <option value="python" className="text-black">Python</option>
                      <option value="sql" className="text-black">SQL</option>
                      <option value="bash" className="text-black">Terminal</option>
                      <option value="text" className="text-black">Texto</option>
                    </select>
                    <textarea
                      value={block.code}
                      onChange={(e) => updateBlock(block.key, { code: e.target.value })}
                      placeholder={"import pandas as pd\ndf = pd.read_csv('ventas.csv')"}
                      spellCheck={false}
                      className={`${fieldClass} min-h-40 font-mono text-sm`}
                    />
                  </>
                )}

                {block.type === "link" && (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <input
                      value={block.url}
                      onChange={(e) => updateBlock(block.key, { url: e.target.value })}
                      placeholder="https://colab.research.google.com/..."
                      inputMode="url"
                      autoCapitalize="none"
                      className={fieldClass}
                    />
                    <input
                      value={block.label}
                      onChange={(e) => updateBlock(block.key, { label: e.target.value })}
                      placeholder="Texto del enlace (opcional)"
                      className={fieldClass}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(["text", "code", "link"] as const).map((type) => (
              <button key={type} onClick={() => setBlocks((current) => [...current, newBlock(type)])} className="rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2 text-sm font-semibold">
                + {type === "text" ? "Texto" : type === "code" ? "Código" : "Enlace"}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="mt-6">
        <PublishPicker mode={mode} onModeChange={setMode} scheduledAt={scheduledAt} onScheduledAtChange={setScheduledAt} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button onClick={() => void save()} disabled={saving} className="rounded-xl bg-green-600 hover:bg-green-500 px-5 py-3 font-bold disabled:opacity-50">
          {saving ? "Guardando..." : "Guardar material"}
        </button>
        <button onClick={onCancel} className="rounded-xl bg-white/10 hover:bg-white/20 px-4 py-3">Cancelar</button>
        {error && <p className="text-red-300 text-sm">{error}</p>}
      </div>
    </section>
  );
}

// Material de una clase: lista + editor.
export default function MaterialsManager({ api, classItem, sharedWith, onBack }: {
  api: HostFetch;
  classItem: ClassSummary;
  // Grupos (y fechas) que tienen esta sesión, p. ej. "CDD1 (lun 5 oct) y CDD2 (mar 6 oct)".
  sharedWith: string;
  onBack: () => void;
}) {
  const [materials, setMaterials] = useState<Material[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Material | "new" | null>(null);
  const [version, setVersion] = useState(0);
  // Editando o viendo resultados de una práctica: se oculta el material.
  const [practiceFocused, setPracticeFocused] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api(`/classes/${classItem.id}/materials`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`status ${response.status}`);
        const data: Material[] = await response.json();
        if (!cancelled) { setMaterials(data); setError(""); }
      })
      .catch((err: unknown) => {
        console.error("Error cargando material", err);
        if (!cancelled) setError("No pudimos cargar el material de esta sesión.");
      });

    return () => { cancelled = true; };
  }, [api, classItem.id, version]);

  const remove = async (material: Material) => {
    if (!window.confirm(`¿Borrar "${material.title}"? Esta acción no se puede deshacer.`)) return;
    const response = await api(`/materials/${material.id}`, { method: "DELETE" });
    if (!response.ok) { setError("No pudimos borrar el material."); return; }
    setVersion((current) => current + 1);
  };

  if (editing) {
    return (
      <MaterialEditor
        key={editing === "new" ? "new" : editing.id}
        api={api}
        classId={classItem.id}
        material={editing === "new" ? null : editing}
        onSaved={() => { setEditing(null); setVersion((current) => current + 1); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  // PracticeManager siempre en la misma posición: así conserva su estado
  // (lista / editor / resultados) cuando se oculta el material.
  return (
    <div className="grid grid-cols-1 gap-6">
    {!practiceFocused && <section className={panelClass}>
      <button onClick={onBack} className="text-slate-400 hover:text-white text-sm mb-4">← Volver a clases</button>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold">📚 Material de la sesión</h2>
          <p className="text-sm text-slate-400 break-words">{classItem.name}</p>
          <p className="text-xs text-slate-500 break-words">Lo ven: {sharedWith}</p>
        </div>
        <button onClick={() => setEditing("new")} className="rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 px-4 py-3 font-bold">+ Nuevo material</button>
      </div>

      {error && <p className="text-red-300 mb-3">{error}</p>}
      {!materials && !error && <p className="text-slate-400">Cargando...</p>}
      {materials?.length === 0 && (
        <p className="text-slate-400 text-center py-8">Esta sesión todavía no tiene material. Agrega una lectura, código o enlaces para que los alumnos se preparen.</p>
      )}

      <div className="grid grid-cols-1 gap-2">
        {materials?.map((material) => (
          <div key={material.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/5 p-3">
            <div className="min-w-0">
              <p className="font-semibold break-words">{material.title}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <StatusBadge publishedAt={material.publishedAt} />
                <span>{material.blocks.length} {material.blocks.length === 1 ? "bloque" : "bloques"}</span>
              </p>
            </div>
            <span className="flex gap-2">
              <button onClick={() => setEditing(material)} className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1">Editar</button>
              <button onClick={() => void remove(material)} className="rounded-lg bg-red-600/80 hover:bg-red-500 px-3 py-1">Borrar</button>
            </span>
          </div>
        ))}
      </div>
    </section>}
    <PracticeManager api={api} classId={classItem.id} onViewChange={setPracticeFocused} />
    </div>
  );
}
