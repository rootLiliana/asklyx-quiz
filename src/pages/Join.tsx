import { useState, type ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { API } from "../config/api";
import type { Game } from "../types/Game";
import type { LoginResponse, LoginUserInput, PublicUser, RegisterUserInput } from "../types/User";
import { getTodayGroupName } from "../lib/studentGroup";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "../lib/authStyles";

type Step = "landing" | "login" | "forgot" | "register" | "code";

interface StudentSession {
  token: string;
  user: PublicUser;
}

const CONNECTION_ERROR = "No pudimos conectarnos con el servidor. Intenta nuevamente.";

function loadStudentSession(): StudentSession | null {
  const token = localStorage.getItem("studentToken");
  const rawUser = localStorage.getItem("studentUser");

  if (!token || !rawUser) {
    return null;
  }

  try {
    return { token, user: JSON.parse(rawUser) as PublicUser };
  } catch {
    return null;
  }
}

function clearStudentSession() {
  ["studentToken", "studentUser", "studentUserId", "studentNickname"].forEach((key) => localStorage.removeItem(key));
}

function persistStudentSession(session: StudentSession) {
  localStorage.setItem("studentToken", session.token);
  localStorage.setItem("studentUser", JSON.stringify(session.user));
  localStorage.setItem("studentUserId", session.user.id);
  localStorage.setItem("studentNickname", session.user.nickname ?? "");
}

export default function Join() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [codeFromUrl] = useState(() => searchParams.get("code"));

  const [studentSession, setStudentSession] = useState<StudentSession | null>(() => loadStudentSession());
  const [step, setStep] = useState<Step>(() => (loadStudentSession() ? "code" : "landing"));

  const [loginForm, setLoginForm] = useState({ nickname: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [loginNotice, setLoginNotice] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [forgotForm, setForgotForm] = useState({ email: "", nickname: "", password: "", confirmPassword: "" });
  const [forgotError, setForgotError] = useState("");
  const [sendingForgot, setSendingForgot] = useState(false);

  const [registerForm, setRegisterForm] = useState({
    name: "",
    lastNamePaternal: "",
    lastNameMaternal: "",
    email: "",
    nickname: "",
    password: "",
    confirmPassword: "",
  });
  const [registerError, setRegisterError] = useState("");
  const [registering, setRegistering] = useState(false);

  const [code, setCode] = useState(() => codeFromUrl ?? "");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);

  const updateLoginField = (field: keyof typeof loginForm) => (event: ChangeEvent<HTMLInputElement>) => {
    setLoginForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const updateRegisterField = (field: keyof typeof registerForm) => (event: ChangeEvent<HTMLInputElement>) => {
    setRegisterForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleLogin = async () => {
    setLoginError("");
    setLoginNotice("");

    const nickname = loginForm.nickname.trim();
    const password = loginForm.password;

    if (!nickname || !password) {
      setLoginError("Escribe tu nickname y tu contraseña.");
      return;
    }

    setLoggingIn(true);
    try {
      const response = await fetch(`${API}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, password } satisfies LoginUserInput),
      });

      if (!response.ok) {
        setLoginError(mapLoginError(response.status));
        return;
      }

      const data: LoginResponse = await response.json();
      const session: StudentSession = { token: data.token, user: data.user };
      persistStudentSession(session);
      setStudentSession(session);
      setLoginForm({ nickname: "", password: "" });
      setStep("code");
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      setLoginError(CONNECTION_ERROR);
    } finally {
      setLoggingIn(false);
    }
  };

  // Recuperación sin correo: si el correo y el nickname son de la misma
  // alumna, se guarda la contraseña nueva directamente.
  const handleForgotPassword = async () => {
    setForgotError("");
    const email = forgotForm.email.trim();
    const nickname = forgotForm.nickname.trim();
    const { password, confirmPassword } = forgotForm;

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setForgotError("Escribe el correo con el que te registraste.");
      return;
    }
    if (!nickname) {
      setForgotError("Escribe tu nickname.");
      return;
    }
    if (password.length < 8) {
      setForgotError("La contraseña nueva debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setForgotError("Las contraseñas no coinciden.");
      return;
    }

    setSendingForgot(true);
    try {
      const response = await fetch(`${API}/users/password/reset-direct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, nickname, password }),
      });

      if (response.status === 429) {
        setForgotError("Demasiados intentos. Espera 15 minutos o pídele ayuda a tu profe.");
        return;
      }
      if (response.status === 400) {
        const body = await response.json().catch(() => null);
        setForgotError(body?.code === "IDENTITY_MISMATCH"
          ? "El correo y el nickname no coinciden con ninguna cuenta. Revísalos."
          : "Revisa tus datos e intenta de nuevo.");
        return;
      }
      if (!response.ok) {
        setForgotError("No pudimos cambiar tu contraseña. Intenta nuevamente.");
        return;
      }

      setForgotForm({ email: "", nickname: "", password: "", confirmPassword: "" });
      setLoginForm({ nickname, password: "" });
      setLoginError("");
      setLoginNotice("✅ Tu contraseña se cambió. Ya puedes entrar con la nueva.");
      setStep("login");
    } catch (error) {
      console.error("Error al restablecer contraseña:", error);
      setForgotError(CONNECTION_ERROR);
    } finally {
      setSendingForgot(false);
    }
  };

  const updateForgotField = (field: keyof typeof forgotForm) => (event: ChangeEvent<HTMLInputElement>) => {
    setForgotForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleRegister = async () => {
    setRegisterError("");

    const name = registerForm.name.trim();
    const lastNamePaternal = registerForm.lastNamePaternal.trim();
    const lastNameMaternal = registerForm.lastNameMaternal.trim();
    const email = registerForm.email.trim();
    const nickname = registerForm.nickname.trim();
    const { password, confirmPassword } = registerForm;

    if (!name || !lastNamePaternal || !email || !nickname || !password || !confirmPassword) {
      setRegisterError("Completa tu nombre, apellido paterno, correo, nickname y contraseña.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setRegisterError("Escribe un correo válido.");
      return;
    }

    if (password.length < 8) {
      setRegisterError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setRegisterError("Las contraseñas no coinciden.");
      return;
    }

    setRegistering(true);
    try {
      const registerResponse = await fetch(`${API}/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          lastNamePaternal,
          lastNameMaternal: lastNameMaternal || undefined,
          email,
          nickname,
          password,
        } satisfies RegisterUserInput),
      });

      if (!registerResponse.ok) {
        setRegisterError(mapRegisterError(registerResponse.status));
        return;
      }

      // El registro no entrega sesión: iniciamos sesión de inmediato con las
      // mismas credenciales, sin volver a pedirlas ni repetir el registro.
      const loginResponse = await fetch(`${API}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, password } satisfies LoginUserInput),
      });

      if (!loginResponse.ok) {
        setRegisterError("Tu cuenta se creó, pero no pudimos iniciar sesión automáticamente. Intenta iniciar sesión.");
        setLoginForm({ nickname, password: "" });
        setStep("login");
        return;
      }

      const data: LoginResponse = await loginResponse.json();
      const session: StudentSession = { token: data.token, user: data.user };
      persistStudentSession(session);
      setStudentSession(session);
      setRegisterForm({
        name: "",
        lastNamePaternal: "",
        lastNameMaternal: "",
        email: "",
        nickname: "",
        password: "",
        confirmPassword: "",
      });
      setStep("code");
    } catch (error) {
      console.error("Error al registrar alumna:", error);
      setRegisterError(CONNECTION_ERROR);
    } finally {
      setRegistering(false);
    }
  };

  const handleJoin = async () => {
    if (!studentSession) return;

    setJoinError("");
    const trimmedCode = code.trim();

    if (!trimmedCode) {
      setJoinError("Ingresa el código de tu clase.");
      return;
    }

    setJoining(true);
    try {
      // El servidor toma el nickname de la sesión, no de lo que mandemos.
      const response = await fetch(`${API}/games/${trimmedCode}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${studentSession.token}` },
      });

      if (response.status === 401 || response.status === 403) {
        clearStudentSession();
        setStudentSession(null);
        setLoginError("Tu sesión expiró. Inicia sesión de nuevo.");
        setStep("login");
        return;
      }

      if (!response.ok) {
        setJoinError(mapJoinError(response.status));
        return;
      }

      const game: Game = await response.json();
      const player = game.players.find(
        (p) => p.name.trim().toLowerCase() === (studentSession.user.nickname ?? "").toLowerCase(),
      );

      if (!player) {
        setJoinError("No pudimos registrarte en el juego. Intenta nuevamente.");
        return;
      }

      localStorage.setItem("playerId", player.id);
      localStorage.setItem("playerName", player.name);
      localStorage.setItem("gameCode", game.code);

      navigate("/icebreaker");
    } catch (error) {
      console.error("Error al unirse:", error);
      setJoinError(CONNECTION_ERROR);
    } finally {
      setJoining(false);
    }
  };

  const todayGroupName = getTodayGroupName();
  const groupMessage = todayGroupName
    ? `Hoy corresponde a ${todayGroupName}.`
    : "No hay un grupo configurado para las clases de hoy.";

  return (
    <div
      className="
        min-h-screen
        bg-gradient-to-br
        from-purple-900
        via-indigo-900
        to-black
        flex
        items-center
        justify-center
        relative
        overflow-hidden
      "
    >
      {/* Anillo 1 */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
        className="
          absolute
          w-[700px]
          h-[700px]
          border
          border-fuchsia-300/20
          rounded-[38%]
        "
      />

      {/* Anillo 2 */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
        className="
          absolute
          w-[650px]
          h-[650px]
          border
          border-purple-300/20
          rounded-[45%]
        "
      />

      {/* Anillo 3 */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
        className="
          absolute
          w-[600px]
          h-[600px]
          border
          border-pink-300/20
          rounded-[50%]
        "
      />

      {/* Luz superior */}
      <div
        className="
          absolute
          top-20
          left-20
          w-48
          h-48
          bg-fuchsia-500/30
          rounded-full
          blur-3xl
        "
      />

      {/* Luz inferior */}
      <div
        className="
          absolute
          bottom-20
          right-20
          w-48
          h-48
          bg-purple-500/30
          rounded-full
          blur-3xl
        "
      />

      {/* Tarjeta */}
      <motion.div
        initial={{ opacity: 0, y: 80 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="
          z-10
          bg-white/10
          backdrop-blur-md
          p-10
          rounded-3xl
          shadow-2xl
          w-full
          max-w-md
        "
      >
        <h1
          className="
            text-5xl
            font-bold
            text-center
            mb-10
            bg-gradient-to-r
            from-fuchsia-300
            to-purple-100
            bg-clip-text
            text-transparent
          "
        >
          🎮 Lilihoot
        </h1>

        <AnimatePresence mode="wait">
          {step === "landing" && (
            <motion.div
              key="landing"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <p className="text-white/80 text-center mb-8 text-lg">¿Ya tienes una cuenta?</p>

              <div className="flex flex-col gap-4">
                <button
                  onClick={() => {
                    setLoginError("");
                    setStep("login");
                  }}
                  className={primaryButtonClass}
                >
                  Sí, ya tengo cuenta
                </button>

                <button
                  onClick={() => {
                    setRegisterError("");
                    setStep("register");
                  }}
                  className={secondaryButtonClass}
                >
                  Soy nueva, quiero registrarme
                </button>
              </div>
            </motion.div>
          )}

          {step === "login" && (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <button
                onClick={() => setStep("landing")}
                className="text-white/60 text-sm mb-4 hover:text-white transition"
              >
                ← Volver
              </button>

              <p className="text-white/70 text-sm mb-1">Nickname</p>
              <input
                className={inputClass}
                placeholder="Tu nickname"
                value={loginForm.nickname}
                onChange={updateLoginField("nickname")}
              />

              <p className="text-white/70 text-sm mb-1">Contraseña</p>
              <input
                className={inputClass}
                placeholder="Tu contraseña"
                type="password"
                value={loginForm.password}
                onChange={updateLoginField("password")}
              />

              {loginNotice && <p className="text-green-300 text-center mb-4">{loginNotice}</p>}
              {loginError && <p className="text-red-300 text-center mb-4">{loginError}</p>}

              <button onClick={handleLogin} disabled={loggingIn} className={primaryButtonClass}>
                {loggingIn ? "Entrando..." : "Entrar"}
              </button>

              <button
                onClick={() => {
                  setForgotError("");
                  setLoginNotice("");
                  setForgotForm((current) => ({ ...current, nickname: current.nickname || loginForm.nickname.trim() }));
                  setStep("forgot");
                }}
                className="w-full text-white/70 text-sm mt-4 hover:text-white underline transition"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </motion.div>
          )}

          {step === "forgot" && (
            <motion.div
              key="forgot"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <button
                onClick={() => setStep("login")}
                className="text-white/60 text-sm mb-4 hover:text-white transition"
              >
                ← Volver
              </button>

              <p className="text-white/80 mb-4">
                Escribe el correo y el nickname con los que te registraste, y elige una contraseña nueva.
              </p>
              <input
                className={inputClass}
                placeholder="Correo electrónico"
                type="email"
                value={forgotForm.email}
                onChange={updateForgotField("email")}
              />
              <input
                className={inputClass}
                placeholder="Tu nickname"
                value={forgotForm.nickname}
                onChange={updateForgotField("nickname")}
              />
              <input
                className={inputClass}
                placeholder="Contraseña nueva"
                type="password"
                value={forgotForm.password}
                onChange={updateForgotField("password")}
              />
              <input
                className={inputClass}
                placeholder="Confirmar contraseña nueva"
                type="password"
                value={forgotForm.confirmPassword}
                onChange={updateForgotField("confirmPassword")}
              />

              {forgotError && <p className="text-red-300 text-center mb-4">{forgotError}</p>}

              <button onClick={handleForgotPassword} disabled={sendingForgot} className={primaryButtonClass}>
                {sendingForgot ? "Guardando..." : "Cambiar contraseña"}
              </button>
            </motion.div>
          )}

          {step === "register" && (
            <motion.div
              key="register"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <button
                onClick={() => setStep("landing")}
                className="text-white/60 text-sm mb-4 hover:text-white transition"
              >
                ← Volver
              </button>

              <input
                className={inputClass}
                placeholder="Nombre(s)"
                value={registerForm.name}
                onChange={updateRegisterField("name")}
              />

              <input
                className={inputClass}
                placeholder="Apellido paterno"
                value={registerForm.lastNamePaternal}
                onChange={updateRegisterField("lastNamePaternal")}
              />

              <input
                className={inputClass}
                placeholder="Apellido materno (opcional)"
                value={registerForm.lastNameMaternal}
                onChange={updateRegisterField("lastNameMaternal")}
              />

              <input
                className={inputClass}
                placeholder="Correo electrónico"
                type="email"
                value={registerForm.email}
                onChange={updateRegisterField("email")}
              />

              <input
                className={inputClass}
                placeholder="Elige un nickname"
                value={registerForm.nickname}
                onChange={updateRegisterField("nickname")}
              />

              <input
                className={inputClass}
                placeholder="Contraseña"
                type="password"
                value={registerForm.password}
                onChange={updateRegisterField("password")}
              />

              <input
                className={inputClass}
                placeholder="Confirmar contraseña"
                type="password"
                value={registerForm.confirmPassword}
                onChange={updateRegisterField("confirmPassword")}
              />

              {registerError && (
                <p className="text-red-300 text-center mb-4">{registerError}</p>
              )}

              <button onClick={handleRegister} disabled={registering} className={primaryButtonClass}>
                {registering ? "Creando cuenta..." : "Crear cuenta"}
              </button>
            </motion.div>
          )}

          {step === "code" && studentSession && (
            <motion.div
              key="code"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <p className="text-white text-2xl font-bold text-center mb-2">
                ¡Hola, {studentSession.user.nickname}! 👋
              </p>
              <p className="text-white/70 text-center mb-6">{groupMessage}</p>

              <p className="text-white/70 text-sm mb-4 text-center">
                Entrando como: <span className="font-semibold text-white">{studentSession.user.nickname}</span>
              </p>

              <p className="text-white/80 mb-2">Ingresa el código de tu clase</p>
              <input
                className={inputClass}
                placeholder="Código del juego"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={!!codeFromUrl}
              />

              {joinError && <p className="text-red-300 text-center mb-4">{joinError}</p>}

              <button onClick={handleJoin} disabled={joining} className={primaryButtonClass}>
                {joining ? "Entrando..." : "Entrar al juego"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function mapLoginError(status: number): string {
  if (status === 403) {
    return "Esta cuenta es de Host: entra desde el panel de Host (/host).";
  }
  if (status === 401) {
    return "Nickname o contraseña incorrectos.";
  }
  if (status === 400) {
    return "Escribe tu nickname y tu contraseña.";
  }
  return "No pudimos iniciar sesión. Intenta nuevamente.";
}

function mapRegisterError(status: number): string {
  if (status === 409) {
    return "Este correo o nickname ya está registrado. Intenta con otro.";
  }
  if (status === 400) {
    return "Revisa que tus datos y tu contraseña sean válidos.";
  }
  return "No pudimos completar el registro. Intenta nuevamente.";
}

function mapJoinError(status: number): string {
  if (status === 404) {
    return "No encontramos ese juego. Revisa el código.";
  }
  return "No pudimos unirte al juego. Intenta nuevamente.";
}
