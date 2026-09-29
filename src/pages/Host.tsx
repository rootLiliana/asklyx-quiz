import { useCallback, useEffect, useMemo, useState } from "react";
import { API } from "../config/api";
import AttendancePanel from "../components/host/AttendancePanel";
import ClassesPanel from "../components/host/ClassesPanel";
import LiveGame from "../components/host/LiveGame";
import QuizLibrary from "../components/host/QuizLibrary";
import SessionWizard, { type SessionInfo } from "../components/host/SessionWizard";
import UsersPanel from "../components/host/UsersPanel";
import type { Game } from "../types/Game";
import type { HostFetch } from "../types/Host";
import type { LoginResponse, PublicUser } from "../types/User";

type Tab = "session" | "classes" | "quizzes" | "attendance" | "users";

const TAB_LABEL: Record<Tab, string> = {
  session: "🎮 Sesión",
  classes: "📅 Clases",
  quizzes: "📚 Quizzes",
  attendance: "✅ Asistencia",
  users: "👥 Usuarias",
};

function loadHostUser(): PublicUser | null {
  try {
    const raw = localStorage.getItem("hostUser");
    return raw ? (JSON.parse(raw) as PublicUser) : null;
  } catch {
    return null;
  }
}

export default function Host() {
  const [hostToken, setHostToken] = useState(() => localStorage.getItem("hostToken") ?? "");
  const [hostUser, setHostUser] = useState<PublicUser | null>(() => loadHostUser());
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState<Tab>("session");
  const [liveGame, setLiveGame] = useState<{ game: Game; info: SessionInfo } | null>(null);
  // Sube cuando cambian las clases, para que "Nueva sesión" las vuelva a cargar.
  const [classesVersion, setClassesVersion] = useState(0);

  const clearSession = useCallback(() => {
    localStorage.removeItem("hostToken");
    localStorage.removeItem("hostUser");
    setHostToken("");
    setHostUser(null);
    setLiveGame(null);
  }, []);

  const api: HostFetch = useMemo(() => async (path, init = {}) => {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${hostToken}` },
    });
    if (response.status === 401) clearSession();
    return response;
  }, [hostToken, clearSession]);

  // Valida la sesión guardada y trae el rol actual (por si cambió).
  useEffect(() => {
    if (!hostToken) return;
    let cancelled = false;

    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${hostToken}` } })
      .then(async (response) => {
        if (cancelled || response.status >= 500) return;
        const user: PublicUser | null = response.ok ? await response.json() : null;
        if (!user || (user.role !== "HOST" && user.role !== "ADMIN")) {
          clearSession();
          return;
        }
        localStorage.setItem("hostUser", JSON.stringify(user));
        setHostUser(user);
      })
      .catch((error: unknown) => console.error("Error validando la sesión", error));

    return () => { cancelled = true; };
  }, [hostToken, clearSession]);

  const loginHost = async () => {
    setLoginError("");
    if (!nickname.trim() || !password) {
      setLoginError("Escribe tu nickname y tu contraseña.");
      return;
    }

    setLoggingIn(true);
    try {
      const response = await fetch(`${API}/host/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim(), password }),
      });

      if (response.status === 403) {
        setLoginError("Esta cuenta no tiene acceso de Host. Pídele a la administradora que te lo dé.");
        return;
      }
      if (!response.ok) {
        setLoginError("Nickname o contraseña incorrectos.");
        return;
      }

      const data: LoginResponse = await response.json();
      localStorage.setItem("hostToken", data.token);
      localStorage.setItem("hostUser", JSON.stringify(data.user));
      setHostToken(data.token);
      setHostUser(data.user);
      setPassword("");
    } catch (error) {
      console.error("Error al iniciar sesión", error);
      setLoginError("No pudimos conectarnos con el servidor.");
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = async () => {
    if (liveGame && !window.confirm("Hay una sesión de juego abierta. ¿Cerrar sesión de todos modos?")) return;
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    clearSession();
  };

  if (!hostToken || !hostUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-black text-white flex items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 w-full max-w-md">
          <h1 className="text-4xl font-bold mb-2">Host Lilihoot</h1>
          <p className="text-slate-400 text-sm mb-6">Entra con tu cuenta de Lilihoot.</p>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Nickname"
            className="w-full mb-3 rounded-xl bg-white/10 border border-white/20 p-3 text-white placeholder:text-slate-400"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void loginHost(); }}
            placeholder="Contraseña"
            type="password"
            className="w-full mb-4 rounded-xl bg-white/10 border border-white/20 p-3 text-white placeholder:text-slate-400"
          />
          <button onClick={loginHost} disabled={loggingIn} className="w-full p-3 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 font-bold disabled:opacity-50">
            {loggingIn ? "Entrando..." : "Entrar"}
          </button>
          {loginError && <p className="mt-4 text-red-300">{loginError}</p>}
          <a href="/join" className="block mt-6 text-center text-sm text-slate-400 hover:text-white">
            ¿Olvidaste tu contraseña? Recupérala desde la pantalla de alumnas.
          </a>
        </div>
      </div>
    );
  }

  const isAdmin = hostUser.role === "ADMIN";
  const tabs: Tab[] = isAdmin
    ? ["session", "classes", "quizzes", "attendance", "users"]
    : ["session", "classes", "quizzes", "attendance"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-black text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="text-4xl md:text-5xl font-bold">🎮 Lilihoot Control Center</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-300">
              {hostUser.nickname}
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${isAdmin ? "bg-yellow-500/20 text-yellow-200" : "bg-fuchsia-500/20 text-fuchsia-200"}`}>
                {isAdmin ? "Admin" : "Host"}
              </span>
            </span>
            <button onClick={logout} className="rounded-xl bg-white/10 hover:bg-white/20 px-4 py-3">
              Salir
            </button>
          </div>
        </div>

        <nav className="flex flex-wrap gap-2 mb-6">
          {tabs.map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`rounded-xl px-4 py-2 font-semibold transition ${tab === item ? "bg-fuchsia-600" : "bg-white/10 hover:bg-white/20"}`}
            >
              {TAB_LABEL[item]}
              {item === "session" && liveGame && <span className="ml-2 text-xs text-emerald-300">● en vivo</span>}
            </button>
          ))}
        </nav>

        {/* LiveGame se mantiene montado al cambiar de pestaña para no perder el juego. */}
        <div className={tab === "session" ? "" : "hidden"}>
          {liveGame ? (
            <LiveGame
              key={liveGame.game.code}
              api={api}
              initialGame={liveGame.game}
              info={liveGame.info}
              onExit={() => setLiveGame(null)}
            />
          ) : (
            <SessionWizard key={classesVersion} api={api} onGameCreated={(game, info) => setLiveGame({ game, info })} />
          )}
        </div>
        {tab === "classes" && <ClassesPanel api={api} onChanged={() => setClassesVersion((current) => current + 1)} />}
        {tab === "quizzes" && <QuizLibrary api={api} />}
        {tab === "attendance" && <AttendancePanel api={api} canEdit={isAdmin} />}
        {tab === "users" && isAdmin && <UsersPanel api={api} />}
      </div>
    </div>
  );
}
