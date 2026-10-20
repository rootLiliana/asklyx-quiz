import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button, Card, Owl, Screen, Wordmark, inputBaseClass } from "../components/ui";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  // Atajo: con el código en mano se va directo a /join, que pide la sesión si hace falta.
  const joinWithCode = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = code.trim().toUpperCase();
    navigate(trimmed ? `/join?code=${encodeURIComponent(trimmed)}` : "/join");
  };

  return (
    <Screen center>
      <motion.main variants={container} initial="hidden" animate="show" className="grid w-full max-w-3xl gap-6">
        <motion.header variants={item} className="grid justify-items-center gap-3 text-center">
          <Owl className="size-24 animate-float drop-shadow-[0_12px_24px_rgb(217_70_239/0.45)]" />
          <h1 className="m-0">
            <Wordmark className="text-6xl sm:text-7xl" />
          </h1>
          <p className="m-0 max-w-md text-lg text-slate-200">Quizzes en vivo para clases, talleres y eventos.</p>
        </motion.header>

        <motion.div variants={item}>
          <Card className="p-5 sm:p-6">
            <form onSubmit={joinWithCode} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="home-code" className="mb-1.5 block text-sm font-semibold text-slate-300">
                  ¿Ya tienes el código del juego?
                </label>
                <input
                  id="home-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="ANA-1234"
                  autoComplete="off"
                  autoCapitalize="characters"
                  className={`${inputBaseClass} font-display text-2xl tracking-widest uppercase`}
                />
              </div>
              <Button type="submit" size="lg" className="sm:w-44">
                Entrar al juego
              </Button>
            </form>
          </Card>
        </motion.div>

        <motion.div variants={item} className="grid gap-4 sm:grid-cols-2">
          <RoleCard
            title="Soy alumna"
            text="Únete a un juego, revisa tus resultados y el material de tu grupo."
            actions={[
              { label: "Unirme", onClick: () => navigate("/join"), variant: "secondary" },
              { label: "Mis resultados", onClick: () => navigate("/mis-resultados"), variant: "ghost" },
              { label: "Mi grupo", onClick: () => navigate("/mi-grupo"), variant: "ghost" },
            ]}
          />
          <RoleCard
            title="Soy profe"
            text="Crea quizzes, lanza juegos en vivo y consulta asistencia y resultados."
            actions={[{ label: "Ir al panel", onClick: () => navigate("/host"), variant: "gold" }]}
          />
        </motion.div>

        <motion.p variants={item} className="m-0 text-center text-sm text-slate-400">
          Hecho para Tecnolochicas PRO
        </motion.p>
      </motion.main>
    </Screen>
  );
}

interface RoleAction {
  label: string;
  onClick: () => void;
  variant: "secondary" | "ghost" | "gold";
}

function RoleCard({ title, text, actions }: { title: string; text: string; actions: RoleAction[] }) {
  const [main, ...rest] = actions;
  return (
    <Card className="grid content-between gap-4 p-5" whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
      <div>
        <h2 className="m-0 font-display text-2xl font-semibold">{title}</h2>
        <p className="m-0 mt-1 text-slate-300">{text}</p>
      </div>
      <div className="grid gap-2">
        {main && (
          <Button variant={main.variant} block onClick={main.onClick}>
            {main.label}
          </Button>
        )}
        {rest.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {rest.map((a) => (
              <Button key={a.label} variant={a.variant} size="sm" onClick={a.onClick}>
                {a.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
