import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { API } from "../config/api";
import { inputClass, primaryButtonClass } from "../lib/authStyles";

// Destino del enlace que llega por correo: /reset-password?token=...
export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setError("");

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API}/users/password/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (response.status === 410) {
        setError("Este enlace ya se usó o expiró. Solicita uno nuevo desde “¿Olvidaste tu contraseña?”.");
        return;
      }

      if (!response.ok) {
        setError("No pudimos cambiar tu contraseña. Intenta nuevamente.");
        return;
      }

      // Las sesiones anteriores se cerraron en el servidor: limpiamos las locales.
      ["studentToken", "studentUser", "studentUserId", "studentNickname", "hostToken", "hostUser"].forEach((key) => localStorage.removeItem(key));
      setDone(true);
    } catch (err) {
      console.error("Error al restablecer contraseña:", err);
      setError("No pudimos conectarnos con el servidor. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-black flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 80 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="bg-white/10 backdrop-blur-md p-10 rounded-3xl shadow-2xl w-full max-w-md"
      >
        <h1 className="text-4xl font-bold text-center mb-8 bg-gradient-to-r from-fuchsia-300 to-purple-100 bg-clip-text text-transparent">
          🔑 Nueva contraseña
        </h1>

        {!token ? (
          <p className="text-red-300 text-center">
            Este enlace no es válido. Solicita uno nuevo desde “¿Olvidaste tu contraseña?”.
          </p>
        ) : done ? (
          <>
            <p className="text-white text-center text-lg mb-6">✅ Tu contraseña se actualizó. Ya puedes iniciar sesión.</p>
            <button onClick={() => navigate("/join")} className={primaryButtonClass}>
              Ir a iniciar sesión
            </button>
          </>
        ) : (
          <>
            <input
              className={inputClass}
              placeholder="Nueva contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Confirmar contraseña"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            {error && <p className="text-red-300 text-center mb-4">{error}</p>}

            <button onClick={handleSubmit} disabled={saving} className={primaryButtonClass}>
              {saving ? "Guardando..." : "Guardar contraseña"}
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
