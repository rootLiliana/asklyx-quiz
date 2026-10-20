import { useCallback, useEffect, useMemo, useState } from "react";
import { API } from "../config/api";
import AttendancePanel from "../components/host/AttendancePanel";
import ClassesPanel from "../components/host/ClassesPanel";
import ResultsPanel from "../components/host/ResultsPanel";
import LiveGame from "../components/host/LiveGame";
import QuizLibrary from "../components/host/QuizLibrary";
import SessionWizard, { type SessionInfo } from "../components/host/SessionWizard";
import UsersPanel from "../components/host/UsersPanel";
import type { Game } from "../types/Game";
import type { HostFetch } from "../types/Host";
import type { LoginResponse, PublicUser } from "../types/User";
import { changePassword, PASSWORD_HINT } from "../lib/changePassword";
import { Button, Card, Field, Icon, Owl, Screen, Wordmark, type IconName } from "../components/ui";

type Tab = "session" | "classes" | "quizzes" | "attendance" | "results" | "users";

const TAB_META: Record<Tab, { label: string; title: string; description: string; icon: IconName }> = {
  session: { label: "Sesión", title: "Sesión en vivo", description: "Elige la clase y el quiz, y lanza el juego.", icon: "play" },
  classes: { label: "Clases", title: "Clases", description: "Calendario de sesiones de cada grupo, con su material y su práctica.", icon: "calendar" },
  quizzes: { label: "Quizzes", title: "Quizzes", description: "Tus quizzes guardados. Ábrelos para editarlos o duplicarlos.", icon: "book" },
  attendance: { label: "Asistencia", title: "Asistencia", description: "Quién vino a cada clase del grupo.", icon: "check" },
  results: { label: "Resultados", title: "Resultados", description: "Cómo les fue en cada quiz en vivo.", icon: "chart" },
  users: { label: "Usuarias", title: "Usuarias", description: "Cuentas, grupos y restablecimiento de contraseñas.", icon: "users" },
};

// Apartados del menú: lo que pasa en vivo, lo que se prepara y lo que se revisa después.
const SECTIONS: { label: string; tabs: Tab[] }[] = [
  { label: "En vivo", tabs: ["session"] },
  { label: "Contenido", tabs: ["classes", "quizzes"] },
  { label: "Seguimiento", tabs: ["attendance", "results"] },
  { label: "Comunidad", tabs: ["users"] },
];

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

  // Contraseña temporal: hay que elegir una nueva antes de usar el panel.
  const [changeForm, setChangeForm] = useState({ current: "", next: "", confirm: "" });
  const [knowsCurrent, setKnowsCurrent] = useState(false);
  const [changeError, setChangeError] = useState("");
  const [changing, setChanging] = useState(false);

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
        setLoginError("Nickname/correo o contraseña incorrectos. Recuerda que la contraseña distingue mayúsculas.");
        return;
      }

      const data: LoginResponse = await response.json();
      localStorage.setItem("hostToken", data.token);
      localStorage.setItem("hostUser", JSON.stringify(data.user));
      setHostToken(data.token);
      setHostUser(data.user);
      // Si es temporal ya la conocemos: no se la volvemos a pedir.
      if (data.user.mustChangePassword) {
        setChangeForm({ current: password, next: "", confirm: "" });
        setKnowsCurrent(true);
      }
      setPassword("");
    } catch (error) {
      console.error("Error al iniciar sesión", error);
      setLoginError("No pudimos conectarnos con el servidor.");
    } finally {
      setLoggingIn(false);
    }
  };

  const saveNewPassword = async () => {
    if (!hostUser) return;
    setChanging(true);
    setChangeError("");
    const error = await changePassword(hostToken, changeForm.current, changeForm.next, changeForm.confirm);
    setChanging(false);

    if (error) {
      setChangeError(error);
      return;
    }

    const updated = { ...hostUser, mustChangePassword: false };
    localStorage.setItem("hostUser", JSON.stringify(updated));
    setHostUser(updated);
    setChangeForm({ current: "", next: "", confirm: "" });
  };

  const logout = async () => {
    if (liveGame && !window.confirm("Hay una sesión de juego abierta. ¿Cerrar sesión de todos modos?")) return;
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    clearSession();
  };

  if (!hostToken || !hostUser) {
    return (
      <Screen center>
        <Card initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid w-full max-w-md gap-5 p-7 sm:p-8">
          <div className="grid justify-items-center gap-2 text-center">
            <Owl className="size-16" />
            <h1 className="m-0 text-3xl">
              <Wordmark className="text-4xl" /> <span className="text-slate-300">Control Center</span>
            </h1>
            <p className="m-0 text-sm text-slate-400">Entra con tu cuenta de host o administradora.</p>
          </div>
          <form
            className="grid gap-4"
            onSubmit={(e) => { e.preventDefault(); void loginHost(); }}
          >
            <Field label="Nickname o correo" value={nickname} onChange={(e) => setNickname(e.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="username" />
            <Field label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" hint={PASSWORD_HINT} error={loginError || undefined} />
            <Button type="submit" size="lg" block loading={loggingIn}>
              {loggingIn ? "Entrando…" : "Entrar"}
            </Button>
          </form>
          <p className="m-0 text-center text-sm text-slate-400">
            ¿Olvidaste tu contraseña? Pídele a la administradora que te ayude a restablecerla.
          </p>
        </Card>
      </Screen>
    );
  }

  if (hostUser.mustChangePassword) {
    return (
      <Screen center>
        <Card initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid w-full max-w-md gap-5 p-7 sm:p-8">
          <div>
            <h1 className="m-0 text-3xl">Elige tu nueva contraseña</h1>
            <p className="m-0 mt-1 text-sm text-slate-300">
              Entraste con una contraseña temporal. Antes de usar el panel, crea una que sí recuerdes.
            </p>
          </div>
          <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void saveNewPassword(); }}>
            {!knowsCurrent && (
              <Field
                label="Contraseña temporal"
                type="password"
                value={changeForm.current}
                onChange={(e) => setChangeForm((current) => ({ ...current, current: e.target.value }))}
                autoComplete="current-password"
              />
            )}
            <Field
              label="Contraseña nueva"
              type="password"
              value={changeForm.next}
              onChange={(e) => setChangeForm((current) => ({ ...current, next: e.target.value }))}
              autoComplete="new-password"
            />
            <Field
              label="Confirmar contraseña nueva"
              type="password"
              value={changeForm.confirm}
              onChange={(e) => setChangeForm((current) => ({ ...current, confirm: e.target.value }))}
              autoComplete="new-password"
              hint={PASSWORD_HINT}
              error={changeError || undefined}
            />
            <Button type="submit" size="lg" block loading={changing}>
              {changing ? "Guardando…" : "Guardar y continuar"}
            </Button>
          </form>
          <Button variant="ghost" size="sm" onClick={logout}>Salir</Button>
        </Card>
      </Screen>
    );
  }

  const isAdmin = hostUser.role === "ADMIN";
  const meta = TAB_META[tab];
  const section = SECTIONS.find((item) => item.tabs.includes(tab));
  const roleChip = (
    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${isAdmin ? "bg-yellow-400/20 text-yellow-200" : "bg-fuchsia-500/25 text-fuchsia-200"}`}>
      {isAdmin ? "Admin" : "Host"}
    </span>
  );

  const tabButton = (item: Tab, compact: boolean) => {
    const active = tab === item;
    return (
      <button
        key={item}
        type="button"
        onClick={() => setTab(item)}
        aria-current={active ? "page" : undefined}
        className={`flex shrink-0 items-center gap-2.5 rounded-xl font-semibold transition ${compact ? "px-3.5 py-2 text-sm" : "w-full px-3 py-2.5 text-left"} ${
          active ? "bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white shadow-glow" : "text-slate-300 hover:bg-white/10 hover:text-white"
        }`}
      >
        <Icon name={TAB_META[item].icon} className="size-5 shrink-0" />
        <span>{TAB_META[item].label}</span>
        {item === "session" && liveGame && (
          <span className="ml-auto flex items-center gap-1 text-xs font-bold text-emerald-300">
            <span className="size-2 animate-pulse rounded-full bg-emerald-400" /> en vivo
          </span>
        )}
      </button>
    );
  };

  return (
    <Screen>
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
        {/* Menú lateral (computadora) */}
        <aside className="hidden self-start lg:sticky lg:top-6 lg:block">
          <Card className="grid gap-6 p-4">
            <div className="flex items-center gap-2.5 px-1">
              <Owl className="size-11" />
              <div className="leading-tight">
                <Wordmark className="text-2xl" />
                <p className="m-0 text-xs font-bold uppercase tracking-wider text-slate-400">Control Center</p>
              </div>
            </div>
            <nav className="grid gap-4" aria-label="Secciones del panel">
              {SECTIONS.map((group) => (
                <div key={group.label} className="grid gap-1">
                  <p className="m-0 px-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">{group.label}</p>
                  {group.tabs.map((item) => tabButton(item, false))}
                </div>
              ))}
            </nav>
            <div className="grid gap-2 border-t border-white/10 pt-4">
              <p className="m-0 flex items-center gap-2 px-1 text-sm text-slate-300">
                <span className="truncate">{hostUser.nickname}</span> {roleChip}
              </p>
              <Button variant="ghost" size="sm" onClick={logout} className="justify-start">
                <Icon name="logout" className="size-4" /> Salir
              </Button>
            </div>
          </Card>
        </aside>

        {/* Encabezado y menú en una fila (celular y tablet) */}
        <div className="grid gap-3 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Owl className="size-9" />
              <Wordmark className="text-2xl" />
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <span className="hidden truncate sm:inline">{hostUser.nickname}</span> {roleChip}
              <Button variant="ghost" size="sm" onClick={logout} aria-label="Salir">
                <Icon name="logout" className="size-4" />
              </Button>
            </div>
          </div>
          <nav className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1" aria-label="Secciones del panel">
            {SECTIONS.flatMap((group) => group.tabs).map((item) => tabButton(item, true))}
          </nav>
        </div>

        <main className="grid min-w-0 content-start gap-5">
          <header key={tab} className="grid gap-1">
            <p className="m-0 text-xs font-extrabold uppercase tracking-wider text-fuchsia-300">{section?.label}</p>
            <h1 className="m-0 text-3xl sm:text-4xl">{meta.title}</h1>
            <p className="m-0 text-slate-400">{meta.description}</p>
          </header>

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
          {tab === "results" && <ResultsPanel api={api} />}
          {tab === "users" && <UsersPanel api={api} canEdit={isAdmin} />}
        </main>
      </div>
    </Screen>
  );
}
