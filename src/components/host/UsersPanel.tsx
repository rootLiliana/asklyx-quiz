import { useEffect, useState } from "react";
import { fieldClass, panelClass } from "../../lib/hostStyles";
import { API } from "../../config/api";
import type { GroupSummary, HostFetch } from "../../types/Host";
import type { PublicUser, UserRole } from "../../types/User";

const ROLE_LABEL: Record<UserRole, string> = { STUDENT: "Alumno", HOST: "Host", ADMIN: "Admin" };
const ROLE_STYLE: Record<UserRole, string> = {
  STUDENT: "bg-white/10 text-slate-200",
  HOST: "bg-fuchsia-500/20 text-fuchsia-200",
  ADMIN: "bg-yellow-500/20 text-yellow-200",
};

// Hosts: ven la lista y restablecen contraseñas de alumnos. Admin
// (canEdit): además da o quita el rol HOST y restablece contraseñas de hosts.
// El rol ADMIN no se cambia ni se restablece desde la app.
export default function UsersPanel({ api, canEdit }: { api: HostFetch; canEdit: boolean }) {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [savingUserId, setSavingUserId] = useState("");
  const [resetResult, setResetResult] = useState<{ user: PublicUser; temporaryPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  // userId -> ids de sus grupos (normalmente uno).
  const [groupsByUser, setGroupsByUser] = useState<Record<string, string[]>>({});
  // "" = todos, "none" = alumnos sin grupo, o un id de grupo.
  const [groupFilter, setGroupFilter] = useState("");

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetch(`${API}/groups`), api("/groups/members")])
      .then(async ([groupsResponse, membersResponse]) => {
        if (!groupsResponse.ok || !membersResponse.ok) throw new Error("groups request failed");
        const groupList: GroupSummary[] = await groupsResponse.json();
        const memberships: { userId: string; groupId: string }[] = await membersResponse.json();
        if (cancelled) return;
        setGroups(groupList);
        setGroupsByUser(memberships.reduce<Record<string, string[]>>((map, { userId, groupId }) => {
          (map[userId] ??= []).push(groupId);
          return map;
        }, {}));
      })
      .catch((err: unknown) => {
        console.error("Error cargando grupos", err);
        if (!cancelled) setError("No pudimos cargar los grupos.");
      });

    return () => { cancelled = true; };
  }, [api]);

  useEffect(() => {
    let cancelled = false;

    api("/users")
      .then(async (response) => {
        if (!response.ok) throw new Error(`status ${response.status}`);
        const data: PublicUser[] = await response.json();
        if (!cancelled) { setUsers(data); setLoaded(true); }
      })
      .catch((err: unknown) => {
        console.error("Error cargando usuarias", err);
        if (!cancelled) { setError("No pudimos cargar las usuarias."); setLoaded(true); }
      });

    return () => { cancelled = true; };
  }, [api]);

  const changeRole = async (user: PublicUser, role: "STUDENT" | "HOST") => {
    const who = user.nickname ?? user.name;
    const action = role === "HOST" ? `¿Dar acceso de Host a ${who}? Ya no podrá jugar como alumno.` : `¿Quitar el acceso de Host a ${who}?`;
    if (!window.confirm(action)) return;

    setSavingUserId(user.id);
    setError("");
    try {
      const response = await api(`/users/${user.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) {
        setError("No pudimos cambiar el rol.");
        return;
      }
      const updated: PublicUser = await response.json();
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } finally {
      setSavingUserId("");
    }
  };

  // Genera una contraseña temporal; al entrar con ella, la app le pide elegir una nueva.
  const resetPassword = async (user: PublicUser) => {
    const who = user.nickname ?? user.name;
    if (!window.confirm(`¿Restablecer la contraseña de ${who}? Su contraseña actual dejará de funcionar.`)) return;

    setSavingUserId(user.id);
    setError("");
    setCopied(false);
    try {
      const response = await api(`/users/${user.id}/password-reset`, { method: "POST" });
      if (!response.ok) {
        setError("No pudimos restablecer la contraseña.");
        return;
      }
      const { temporaryPassword }: { temporaryPassword: string } = await response.json();
      setResetResult({ user, temporaryPassword });
      setUsers((current) => current.map((item) => (item.id === user.id ? { ...item, mustChangePassword: true } : item)));
    } finally {
      setSavingUserId("");
    }
  };

  const resetMessage = resetResult
    ? `Hola ${resetResult.user.name}, restablecí tu contraseña de Lilihoot. ` +
      `Entra con tu correo (${resetResult.user.email ?? "—"})` +
      (resetResult.user.nickname ? ` o tu nickname (${resetResult.user.nickname})` : "") +
      ` y esta contraseña temporal: ${resetResult.temporaryPassword} — al entrar te pedirá elegir una nueva. ` +
      "Ojo: la contraseña distingue mayúsculas, minúsculas y signos."
    : "";

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(resetMessage);
      setCopied(true);
    } catch {
      setError("No se pudo copiar automáticamente: selecciona el texto y cópialo.");
    }
  };

  // Solo admin: deja al alumno en ese grupo (o sin grupo con "").
  const setStudentGroup = async (user: PublicUser, groupId: string) => {
    setSavingUserId(user.id);
    setError("");
    try {
      const response = await api(`/groups/members/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: groupId || null }),
      });
      if (!response.ok) {
        setError("No pudimos cambiar el grupo.");
        return;
      }
      setGroupsByUser((current) => ({ ...current, [user.id]: groupId ? [groupId] : [] }));
    } finally {
      setSavingUserId("");
    }
  };

  const groupName = (id: string) => groups.find((group) => group.id === id)?.name ?? `Grupo ${id}`;
  const studentsWithoutGroup = users.filter((user) => user.role === "STUDENT" && !(groupsByUser[user.id]?.length)).length;

  const normalizedSearch = search.trim().toLowerCase();
  const visibleUsers = users
    .filter((user) =>
      !normalizedSearch ||
      [user.name, user.lastNamePaternal, user.nickname, user.email].some((value) => (value ?? "").toLowerCase().includes(normalizedSearch)),
    )
    .filter((user) => {
      if (!groupFilter) return true;
      const userGroups = groupsByUser[user.id] ?? [];
      return groupFilter === "none" ? user.role === "STUDENT" && userGroups.length === 0 : userGroups.includes(groupFilter);
    })
    // Admin y hosts primero.
    .sort((a, b) => Number(a.role === "STUDENT") - Number(b.role === "STUDENT"));

  return (
    <section className={panelClass}>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-bold">Usuarias</h2>
          <p className="text-sm text-slate-400">
            {canEdit
              ? "Para agregar una Host: que se registre como alumno y aquí le das acceso."
              : "Puedes restablecer contraseñas de alumnos. Dar o quitar acceso de Host es solo de la administradora."}
          </p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 md:w-auto">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, nickname o correo..." className={fieldClass} />
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className={fieldClass}>
            <option value="" className="text-black">Todos los grupos</option>
            <option value="none" className="text-black">⚠️ Alumnos sin grupo ({studentsWithoutGroup})</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id} className="text-black">{group.name}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-red-300 mb-3">{error}</p>}
      {!loaded && <p className="text-slate-400">Cargando...</p>}

      {resetResult && (
        <div className="mb-5 rounded-2xl border border-yellow-300/40 bg-yellow-500/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold">🔑 Contraseña temporal de {resetResult.user.nickname ?? resetResult.user.name}</p>
              <p className="mt-1 font-mono text-2xl font-black tracking-wider text-yellow-200 select-all">{resetResult.temporaryPassword}</p>
            </div>
            <button onClick={() => setResetResult(null)} className="text-sm text-slate-400 hover:text-white">Cerrar ✕</button>
          </div>
          <p className="mt-3 rounded-xl bg-black/30 p-3 text-sm text-slate-200 select-all break-words">{resetMessage}</p>
          <button onClick={() => void copyMessage()} className="mt-3 rounded-xl bg-yellow-400 px-4 py-2 font-bold text-purple-950 hover:bg-yellow-300">
            {copied ? "✅ Mensaje copiado" : "📋 Copiar mensaje"}
          </button>
          <p className="mt-2 text-xs text-slate-400">La contraseña solo se muestra ahora. Si la pierdes, restablécela otra vez.</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="py-2 pr-4">Nombre</th>
              <th className="py-2 pr-4">Grupo</th>
              <th className="py-2 pr-4">Nickname</th>
              <th className="py-2 pr-4">Correo</th>
              <th className="py-2 pr-4">Rol</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map((user) => (
              <tr key={user.id} className="border-t border-white/10">
                <td className="py-3 pr-4">{[user.name, user.lastNamePaternal, user.lastNameMaternal].filter(Boolean).join(" ")}</td>
                <td className="py-3 pr-4 whitespace-nowrap">
                  {user.role !== "STUDENT" ? (
                    <span className="text-slate-500">—</span>
                  ) : canEdit ? (
                    <select
                      value={groupsByUser[user.id]?.[0] ?? ""}
                      disabled={savingUserId === user.id}
                      onChange={(e) => void setStudentGroup(user, e.target.value)}
                      className={`rounded-lg border p-2 text-white ${groupsByUser[user.id]?.length ? "border-white/20 bg-white/10" : "border-amber-400/60 bg-amber-500/10"}`}
                    >
                      <option value="" className="text-black">Sin grupo</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.id} className="text-black">{group.name}</option>
                      ))}
                    </select>
                  ) : groupsByUser[user.id]?.length ? (
                    <span className="text-slate-300">{groupsByUser[user.id]!.map(groupName).join(", ")}</span>
                  ) : (
                    <span className="text-amber-300">Sin grupo</span>
                  )}
                  {canEdit && (groupsByUser[user.id]?.length ?? 0) > 1 && (
                    <span className="ml-2 text-xs text-amber-300" title={groupsByUser[user.id]!.map(groupName).join(", ")}>
                      +{groupsByUser[user.id]!.length - 1}
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4 text-slate-300">{user.nickname ?? "—"}</td>
                <td className="py-3 pr-4 text-slate-400">{user.email ?? "—"}</td>
                <td className="py-3 pr-4">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ROLE_STYLE[user.role]}`}>{ROLE_LABEL[user.role]}</span>
                  {user.mustChangePassword && (
                    <span className="ml-2 rounded-full bg-yellow-500/20 px-2 py-1 text-xs text-yellow-200" title="Todavía no elige su contraseña nueva">
                      🔑 temporal
                    </span>
                  )}
                </td>
                <td className="py-3 text-right whitespace-nowrap">
                  {(canEdit ? user.role !== "ADMIN" : user.role === "STUDENT") && (
                    <button onClick={() => void resetPassword(user)} disabled={savingUserId === user.id} className="mr-2 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1 disabled:opacity-50" title="Restablecer contraseña">
                      🔑 Restablecer
                    </button>
                  )}
                  {canEdit && user.role === "STUDENT" && (
                    <button onClick={() => void changeRole(user, "HOST")} disabled={savingUserId === user.id} className="rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 px-3 py-1 disabled:opacity-50">
                      Hacer Host
                    </button>
                  )}
                  {canEdit && user.role === "HOST" && (
                    <button onClick={() => void changeRole(user, "STUDENT")} disabled={savingUserId === user.id} className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1 disabled:opacity-50">
                      Quitar Host
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
