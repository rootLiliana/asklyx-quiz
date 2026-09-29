import { useEffect, useState } from "react";
import { fieldClass, panelClass } from "../../lib/hostStyles";
import type { HostFetch } from "../../types/Host";
import type { PublicUser, UserRole } from "../../types/User";

const ROLE_LABEL: Record<UserRole, string> = { STUDENT: "Alumno", HOST: "Host", ADMIN: "Admin" };
const ROLE_STYLE: Record<UserRole, string> = {
  STUDENT: "bg-white/10 text-slate-200",
  HOST: "bg-fuchsia-500/20 text-fuchsia-200",
  ADMIN: "bg-yellow-500/20 text-yellow-200",
};

// Solo admin. Una host se registra como cualquier alumna y aquí se le da el
// rol HOST. El rol ADMIN no se cambia desde la app.
export default function UsersPanel({ api }: { api: HostFetch }) {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [savingUserId, setSavingUserId] = useState("");

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

  const normalizedSearch = search.trim().toLowerCase();
  const visibleUsers = users
    .filter((user) =>
      !normalizedSearch ||
      [user.name, user.lastNamePaternal, user.nickname, user.email].some((value) => (value ?? "").toLowerCase().includes(normalizedSearch)),
    )
    // Admin y hosts primero.
    .sort((a, b) => Number(a.role === "STUDENT") - Number(b.role === "STUDENT"));

  return (
    <section className={panelClass}>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-bold">Usuarias</h2>
          <p className="text-sm text-slate-400">Para agregar una Host: que se registre como alumno y aquí le das acceso.</p>
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, nickname o correo..." className={`${fieldClass} md:max-w-sm`} />
      </div>

      {error && <p className="text-red-300 mb-3">{error}</p>}
      {!loaded && <p className="text-slate-400">Cargando...</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="py-2 pr-4">Nombre</th>
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
                <td className="py-3 pr-4 text-slate-300">{user.nickname ?? "—"}</td>
                <td className="py-3 pr-4 text-slate-400">{user.email ?? "—"}</td>
                <td className="py-3 pr-4">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ROLE_STYLE[user.role]}`}>{ROLE_LABEL[user.role]}</span>
                </td>
                <td className="py-3 text-right whitespace-nowrap">
                  {user.role === "STUDENT" && (
                    <button onClick={() => void changeRole(user, "HOST")} disabled={savingUserId === user.id} className="rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 px-3 py-1 disabled:opacity-50">
                      Hacer Host
                    </button>
                  )}
                  {user.role === "HOST" && (
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
