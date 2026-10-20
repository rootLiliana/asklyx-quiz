import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import QRCode from "react-qr-code";
import { formatClassDate } from "../../lib/classDates";
import { Button, Card, Owl, PercentBar, TimerRing } from "../ui";
import type { Game } from "../../types/Game";
import type { HostFetch } from "../../types/Host";
import type { IceBreaker } from "../../types/IceBreaker";
import type { SessionInfo } from "./SessionWizard";

interface QuestionStat {
  text: string;
  percentage: number;
}

// Respaldo: el juego siempre trae sus segundos por pregunta (los elige la host).
const QUESTION_DURATION_SECONDS = 22;
const LETTERS = ["A", "B", "C", "D", "E", "F"];

// Qué se ve en la pantalla grande durante una pregunta.
type Stage = "question" | "reveal" | "ranking";

interface LiveGameProps {
  api: HostFetch;
  initialGame: Game;
  info: SessionInfo;
  onExit: () => void;
}

export default function LiveGame({ api, initialGame, info, onExit }: LiveGameProps) {
  const [game, setGame] = useState<Game>(initialGame);
  const [timeLeft, setTimeLeft] = useState(initialGame.questionDurationSeconds ?? QUESTION_DURATION_SECONDS);
  const [stage, setStage] = useState<Stage>("question");
  const [showIceBreaker, setShowIceBreaker] = useState(false);
  const [iceBreakerQuestion, setIceBreakerQuestion] = useState("");
  const [showQrModal, setShowQrModal] = useState(false);
  const [iceBreakerData, setIceBreakerData] = useState<IceBreaker | null>(null);
  const [stats, setStats] = useState<QuestionStat[]>([]);
  const [advancing, setAdvancing] = useState(false);

  const currentQuestionIndex = useRef<number>(initialGame.currentQuestion);
  // Puntajes al empezar la pregunta: para mostrar cuánto ganó cada quien en el ranking.
  const [scoresAtStart, setScoresAtStart] = useState<Map<string, number>>(() => new Map(initialGame.players.map((p) => [p.id, p.score])));

  const gameCode = game.code;
  const joinUrl = `${window.location.origin}/join?code=${gameCode}`;
  const duration = game.questionDurationSeconds ?? QUESTION_DURATION_SECONDS;

  const applyGameUpdate = useCallback((updatedGame: Game) => {
    if (currentQuestionIndex.current !== updatedGame.currentQuestion) {
      currentQuestionIndex.current = updatedGame.currentQuestion;
      setScoresAtStart(new Map(updatedGame.players.map((p) => [p.id, p.score])));
      setTimeLeft(updatedGame.questionDurationSeconds ?? QUESTION_DURATION_SECONDS);
      setStage("question");
    }
    setGame(updatedGame);
  }, []);

  const startGame = async () => {
    const response = await api(`/games/${gameCode}/start`, { method: "POST" });
    if (response.ok) applyGameUpdate(await response.json());
  };

  const nextQuestion = async () => {
    setAdvancing(true);
    try {
      const response = await api(`/games/${gameCode}/next`, { method: "POST" });
      if (response.ok) applyGameUpdate(await response.json());
    } finally {
      setAdvancing(false);
    }
  };

  const startIcebreakerHost = async () => {
    if (!iceBreakerQuestion) return;
    const response = await api(`/games/${gameCode}/icebreaker`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: iceBreakerQuestion }),
    });
    if (response.ok) setIceBreakerData(await response.json());
  };

  const closeIcebreakerHost = async () => {
    const response = await api(`/games/${gameCode}/icebreaker/close`, { method: "PUT" });
    if (response.ok) {
      const data: { icebreaker: IceBreaker } = await response.json();
      setIceBreakerData(data.icebreaker);
    }
    setShowIceBreaker(false);
  };

  // Juego y estadísticas en tiempo real.
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [gameResponse, statsResponse] = await Promise.all([
          api(`/games/${gameCode}`),
          api(`/games/${gameCode}/stats`),
        ]);
        if (gameResponse.ok) applyGameUpdate(await gameResponse.json());
        if (statsResponse.ok) setStats(await statsResponse.json());
      } catch (err) {
        console.error("Error actualizando el juego", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [api, gameCode, applyGameUpdate]);

  // Respuestas del rompehielos.
  useEffect(() => {
    if (!showIceBreaker) return;

    const interval = setInterval(async () => {
      try {
        const response = await api(`/games/${gameCode}/icebreaker`);
        if (response.ok) setIceBreakerData(await response.json());
      } catch (err) {
        console.error("Error cargando respuestas de icebreaker", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [api, gameCode, showIceBreaker]);

  const currentQuestionNumber = game.currentQuestion;
  const questionCount = game.questions.length;
  const currentQuestion = game.questions[game.currentQuestion];
  const finished = game.currentQuestion >= questionCount;
  const started = game.currentQuestion >= 0;
  const isLast = game.currentQuestion === questionCount - 1;

  // Al llegar el cronómetro a 0 la respuesta se revela sola.
  const view: Stage = stage === "question" && timeLeft <= 0 ? "reveal" : stage;

  useEffect(() => {
    if (currentQuestionNumber < 0 || currentQuestionNumber >= questionCount || timeLeft <= 0 || view !== "question") return;
    const timer = setTimeout(() => setTimeLeft((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearTimeout(timer);
  }, [currentQuestionNumber, questionCount, timeLeft, view]);

  const answeredCount = currentQuestion
    ? game.players.filter((p) => p.answeredQuestions?.includes(currentQuestion.id)).length
    : 0;
  const everyoneAnswered = game.players.length > 0 && answeredCount >= game.players.length;

  const ranking = useMemo(
    () =>
      [...game.players]
        .sort((a, b) => b.score - a.score)
        .map((p) => ({ ...p, gained: p.score - (scoresAtStart.get(p.id) ?? 0) })),
    [game.players, scoresAtStart],
  );

  const exit = () => {
    if (started && !finished && !window.confirm("El quiz no ha terminado. Si sales, la asistencia de esta sesión no se registrará. ¿Salir de todos modos?")) {
      return;
    }
    onExit();
  };

  const copy = (text: string) => navigator.clipboard?.writeText(text).catch(() => undefined);

  return (
    <div className="grid gap-5">
      {/* Barra de la sesión */}
      <Card tone="soft" className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="m-0 truncate font-display text-lg font-semibold">{info.quizTitle}</p>
          <p className="m-0 truncate text-sm text-slate-400">
            {info.groupName} · {formatClassDate(info.classDate)} — {info.className} · {info.durationSeconds} s por pregunta
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowQrModal(true)}
            className="rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/15 px-3 py-1.5 font-display text-lg font-semibold tracking-widest text-fuchsia-200 hover:bg-fuchsia-500/25"
            title="Mostrar código y QR"
          >
            {gameCode}
          </button>
          <Button variant="secondary" size="sm" onClick={exit}>
            {finished ? "Nueva sesión" : "Terminar sesión"}
          </Button>
        </div>
      </Card>

      <AnimatePresence mode="wait">
        {!started && (
          <Lobby
            key="lobby"
            joinUrl={joinUrl}
            gameCode={gameCode}
            players={game.players.length}
            questionCount={questionCount}
            onStart={() => void startGame()}
            onIcebreaker={() => { setShowIceBreaker(true); setIceBreakerData(null); }}
            onEnlargeQr={() => setShowQrModal(true)}
            onCopy={copy}
          />
        )}

        {started && !finished && currentQuestion && (
          <motion.section key={`q-${game.currentQuestion}`} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="grid gap-5">
            <Card className="grid gap-5 p-5 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-slate-200">
                  Pregunta {game.currentQuestion + 1} de {questionCount}
                </span>
                <AnsweredMeter answered={answeredCount} total={game.players.length} />
              </div>

              <div className="grid items-center gap-5 sm:grid-cols-[auto_1fr]">
                <div className="justify-self-center">
                  {view === "question" ? (
                    <TimerRing seconds={timeLeft} total={duration} size={112} />
                  ) : (
                    <div className="grid size-28 place-items-center rounded-full border-4 border-green-300/60 bg-green-500/15 text-center font-display text-sm font-semibold text-green-200">
                      {timeLeft > 0 ? <>Todas<br />contestaron</> : <>Tiempo<br />cerrado</>}
                    </div>
                  )}
                </div>
                <h2 className="m-0 text-balance text-center font-display text-3xl font-semibold leading-tight break-words sm:text-left sm:text-4xl">
                  {currentQuestion.text}
                </h2>
              </div>

              {view === "ranking" ? (
                <RankingBoard ranking={ranking} />
              ) : (
                <OptionsBoard question={currentQuestion} revealed={view === "reveal"} />
              )}

              {view === "reveal" && currentQuestion.explanation && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="grid gap-1 rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/10 p-5">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-fuchsia-300">¿Por qué?</span>
                  <p className="m-0 text-lg leading-relaxed text-slate-100 sm:text-xl">{currentQuestion.explanation}</p>
                </motion.div>
              )}
            </Card>

            {/* Controles de la host */}
            <div className="flex flex-wrap items-center justify-end gap-2">
              {view === "question" && (
                <>
                  {/* Revelar antes de tiempo dejaría ver la respuesta a quien aún puede contestar. */}
                  <span className={`mr-auto text-sm font-semibold ${everyoneAnswered ? "text-green-300" : "text-slate-400"}`}>
                    {everyoneAnswered ? "¡Ya respondieron todas!" : "La respuesta se revela al acabar el tiempo o cuando todas contesten."}
                  </span>
                  <Button variant="gold" size="lg" onClick={() => setStage("reveal")} disabled={!everyoneAnswered}>
                    Revelar respuesta
                  </Button>
                </>
              )}
              {view === "reveal" && (
                <>
                  <Button variant="secondary" size="lg" onClick={() => setStage("ranking")}>
                    Ver ranking
                  </Button>
                  <Button size="lg" onClick={() => void nextQuestion()} loading={advancing}>
                    {isLast ? "Terminar quiz" : "Siguiente pregunta"}
                  </Button>
                </>
              )}
              {view === "ranking" && (
                <>
                  <Button variant="secondary" size="lg" onClick={() => setStage("reveal")}>
                    Volver a la respuesta
                  </Button>
                  <Button size="lg" onClick={() => void nextQuestion()} loading={advancing}>
                    {isLast ? "Terminar quiz" : "Siguiente pregunta"}
                  </Button>
                </>
              )}
            </div>
          </motion.section>
        )}

        {finished && (
          <motion.section key="finished" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="grid gap-5">
            <Card className="flex flex-col items-center gap-5 border-yellow-300/40 bg-gradient-to-r from-amber-500/20 via-fuchsia-600/20 to-purple-700/20 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
              <div className="flex items-center gap-4">
                <Owl className="size-16 shrink-0" />
                <div>
                  <h2 className="m-0 font-display text-3xl font-semibold">¡Quiz terminado!</h2>
                  <p className="m-0 text-slate-200">La asistencia ya se registró. Muestra a las campeonas en pantalla grande.</p>
                </div>
              </div>
              <Button variant="gold" size="lg" onClick={() => window.open(`/podium?code=${encodeURIComponent(gameCode)}`, "_blank", "noopener")}>
                Ver podio
              </Button>
            </Card>
            <div className="grid gap-5 lg:grid-cols-2">
              <Card className="p-5 sm:p-6">
                <h3 className="m-0 mb-4 text-xl">Ranking final</h3>
                <RankingBoard ranking={ranking} limit={10} showGained={false} />
              </Card>
              <SessionStats stats={stats} />
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {started && !finished && <SessionStats stats={stats} collapsible />}

      {/* Rompehielos */}
      <AnimatePresence>
        {showIceBreaker && (
          <Modal onClose={() => setShowIceBreaker(false)} title="Chismesito time" wide>
            {!iceBreakerData?.active ? (
              <div className="grid gap-4">
                <p className="m-0 text-slate-300">Escribe una pregunta abierta para lanzar a las alumnas mientras esperan.</p>
                <textarea
                  value={iceBreakerQuestion}
                  onChange={(e) => setIceBreakerQuestion(e.target.value)}
                  placeholder="Ej: ¿Cómo pides tú el elote?"
                  className="min-h-28 w-full rounded-xl border border-white/15 bg-white/[0.07] p-3.5 text-lg text-white placeholder:text-slate-500 focus:border-fuchsia-400 focus:outline-none focus:ring-4 focus:ring-fuchsia-500/25"
                />
                <Button size="lg" block onClick={() => void startIcebreakerHost()} disabled={!iceBreakerQuestion}>
                  Lanzar pregunta
                </Button>
              </div>
            ) : (
              <div className="grid gap-5">
                <div className="rounded-2xl border border-fuchsia-500/30 bg-black/30 p-4">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-fuchsia-300">Pregunta</span>
                  <p className="m-0 mt-1 font-display text-2xl font-semibold">{iceBreakerData.question}</p>
                </div>
                <div>
                  <p className="m-0 mb-3 font-semibold text-slate-300">Respuestas ({iceBreakerData.answers.length})</p>
                  <div className="grid max-h-72 gap-3 overflow-y-auto pr-1 md:grid-cols-2">
                    <AnimatePresence>
                      {iceBreakerData.answers.map((ans) => (
                        <motion.div key={ans.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="m-0 mb-2 text-lg text-white">“{ans.text}”</p>
                          <span className="text-xs font-bold text-fuchsia-300">{ans.playerName}</span>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {iceBreakerData.answers.length === 0 && (
                      <p className="col-span-full m-0 py-4 text-center text-slate-500">Esperando respuestas…</p>
                    )}
                  </div>
                </div>
                <Button variant="danger" size="lg" block onClick={() => void closeIcebreakerHost()}>
                  Cerrar el rompehielos
                </Button>
              </div>
            )}
          </Modal>
        )}
      </AnimatePresence>

      {/* QR grande */}
      <AnimatePresence>
        {showQrModal && (
          <Modal onClose={() => setShowQrModal(false)} title="Únete a Lilihoot">
            <div className="grid justify-items-center gap-5 text-center">
              <div className="rounded-3xl bg-white p-5">
                <QRCode value={joinUrl} size={260} />
              </div>
              <p className="m-0 font-display text-5xl font-semibold tracking-widest text-fuchsia-200">{gameCode}</p>
              <p className="m-0 text-sm text-slate-400">Escanea con la cámara del celular o entra a la página y escribe el código.</p>
              <div className="grid w-full gap-2 sm:grid-cols-2">
                <CopyButton text={gameCode} label="Copiar código" onCopy={copy} />
                <CopyButton text={joinUrl} label="Copiar enlace" onCopy={copy} />
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- piezas de la vista en vivo ---------- */

function Lobby({ joinUrl, gameCode, players, questionCount, onStart, onIcebreaker, onEnlargeQr, onCopy }: {
  joinUrl: string;
  gameCode: string;
  players: number;
  questionCount: number;
  onStart: () => void;
  onIcebreaker: () => void;
  onEnlargeQr: () => void;
  onCopy: (text: string) => void;
}) {
  const reduce = useReducedMotion();
  const owls = Math.min(players, 40);

  return (
    <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <Card className="grid justify-items-center gap-4 p-6 text-center">
        <p className="m-0 text-sm font-bold uppercase tracking-wider text-slate-400">Entra con el código</p>
        <p className="m-0 font-display text-5xl font-semibold tracking-widest text-fuchsia-200">{gameCode}</p>
        <button type="button" onClick={onEnlargeQr} className="cursor-zoom-in rounded-3xl bg-white p-4 transition hover:scale-[1.03]" title="Ampliar QR">
          <QRCode value={joinUrl} size={180} />
        </button>
        <div className="grid w-full grid-cols-2 gap-2">
          <CopyButton text={gameCode} label="Código" onCopy={onCopy} />
          <CopyButton text={joinUrl} label="Enlace" onCopy={onCopy} />
        </div>
      </Card>

      <Card className="grid content-between gap-6 p-6">
        <div className="grid justify-items-center gap-2 text-center">
          <motion.p
            key={players}
            initial={reduce ? false : { scale: 1.5, color: "#F0ABFC" }}
            animate={{ scale: 1, color: "#FFFFFF" }}
            transition={{ type: "spring", stiffness: 260, damping: 14 }}
            className="m-0 font-display text-8xl font-semibold tabular-nums"
          >
            {players}
          </motion.p>
          <p className="m-0 text-lg text-slate-300">
            {players === 0 ? "Esperando a que entren…" : players === 1 ? "alumna conectada" : "alumnas conectadas"}
          </p>
          <div className="mt-2 flex max-w-xl flex-wrap justify-center gap-1.5" aria-hidden="true">
            <AnimatePresence>
              {Array.from({ length: owls }, (_, i) => (
                <motion.span key={i} initial={{ scale: 0, y: 10 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
                  <Owl className="size-8" blink={false} />
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
          <p className="m-0 text-sm text-slate-400">{questionCount} {questionCount === 1 ? "pregunta" : "preguntas"} listas.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onIcebreaker}>Rompehielos</Button>
            <Button size="lg" onClick={onStart}>
              Iniciar juego
            </Button>
          </div>
        </div>
      </Card>
    </motion.section>
  );
}

function AnsweredMeter({ answered, total }: { answered: number; total: number }) {
  const pct = total > 0 ? (answered / total) * 100 : 0;
  return (
    <div className="flex min-w-48 items-center gap-3" aria-live="polite">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-purple-500" animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
      </div>
      <span className="text-sm font-bold tabular-nums text-slate-200">
        {answered} de {total} respondieron
      </span>
    </div>
  );
}

// Opciones de la pregunta. Al revelar, cada una muestra cuántas la eligieron,
// la correcta se pinta de verde y se señala el error más común.
function OptionsBoard({ question, revealed }: { question: Game["questions"][number]; revealed: boolean }) {
  const counts = question.options.map((_, i) => question.answers?.[i] ?? 0);
  const total = counts.reduce((a, b) => a + b, 0);
  const wrong = counts.map((c, i) => ({ c, i })).filter(({ i }) => i !== question.correctAnswer).sort((a, b) => b.c - a.c)[0];
  const commonMistake = revealed && wrong && wrong.c > 0 ? wrong.i : -1;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {question.options.map((option, index) => {
        const correct = index === question.correctAnswer;
        const count = counts[index] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const tone = !revealed
          ? "from-fuchsia-500 to-purple-600"
          : correct
            ? "from-green-500 to-emerald-600 ring-4 ring-green-300"
            : "from-white/10 to-white/5";

        return (
          <motion.div
            key={index}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: revealed && !correct ? 0.85 : 1, y: 0, scale: revealed && correct ? 1.02 : 1 }}
            transition={{ delay: revealed ? 0 : 0.05 * index }}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-r p-4 sm:p-5 ${tone}`}
          >
            {revealed && (
              <motion.div
                aria-hidden="true"
                className={`absolute inset-y-0 left-0 ${correct ? "bg-white/15" : "bg-fuchsia-500/25"}`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.9, ease: "easeOut", delay: 0.1 }}
              />
            )}
            <div className="relative flex items-center gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/20 font-display text-xl font-semibold">
                {revealed && correct ? "✓" : LETTERS[index] ?? index + 1}
              </span>
              <span className="min-w-0 flex-1 text-lg font-bold break-words sm:text-xl">{option}</span>
              {revealed && (
                <span className="shrink-0 text-right">
                  <span className="block font-display text-2xl font-semibold tabular-nums">{count}</span>
                  <span className="block text-xs font-bold text-white/70">{pct}%</span>
                </span>
              )}
            </div>
            {index === commonMistake && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 }}
                className="relative mt-3 inline-block rounded-full bg-red-500/25 px-3 py-1 text-xs font-extrabold text-red-200"
              >
                Error más común: vale la pena aclararlo
              </motion.span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

type RankedPlayer = Game["players"][number] & { gained: number };

function RankingBoard({ ranking, limit = 5, showGained = true }: { ranking: RankedPlayer[]; limit?: number; showGained?: boolean }) {
  const top = ranking.slice(0, limit);
  const max = Math.max(1, ...top.map((p) => p.score));
  const medal = ["bg-gradient-to-r from-yellow-300 to-amber-400 text-purple-950", "bg-slate-200 text-purple-950", "bg-amber-700 text-white"];

  if (top.length === 0) return <p className="m-0 text-slate-400">El ranking aparecerá cuando contesten.</p>;

  return (
    <ol className="m-0 grid list-none gap-2.5 p-0">
      {top.map((player, i) => (
        <motion.li
          key={player.id}
          layout
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 26, delay: 0.06 * i }}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3"
        >
          <motion.div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-fuchsia-500/30 to-purple-600/20"
            initial={{ width: 0 }}
            animate={{ width: `${(player.score / max) * 100}%` }}
            transition={{ duration: 0.8, delay: 0.1 + 0.06 * i }}
          />
          <div className="relative flex items-center gap-3">
            <span className={`grid size-9 shrink-0 place-items-center rounded-full font-display font-semibold ${medal[i] ?? "bg-white/10 text-white"}`}>{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-lg font-bold">{player.name}</span>
            {showGained && player.gained > 0 && (
              <span className="shrink-0 rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-extrabold text-green-300">+{player.gained}</span>
            )}
            <span className="shrink-0 font-display text-xl font-semibold tabular-nums text-yellow-300">{player.score.toLocaleString("es-MX")}</span>
          </div>
        </motion.li>
      ))}
    </ol>
  );
}

function SessionStats({ stats, collapsible = false }: { stats: QuestionStat[]; collapsible?: boolean }) {
  const body = (
    <div className="grid gap-3">
      {stats.map((stat, i) => (
        <div key={i} className="grid gap-1.5">
          <p className="m-0 truncate text-sm font-semibold">{i + 1}. {stat.text}</p>
          <PercentBar value={stat.percentage} />
        </div>
      ))}
      {stats.length === 0 && <p className="m-0 py-2 text-sm text-slate-400">Las estadísticas aparecen cuando llegan respuestas.</p>}
    </div>
  );

  if (collapsible) {
    return (
      <details className="group rounded-2xl border border-white/10 bg-white/5 p-4">
        <summary className="cursor-pointer list-none font-display text-lg font-semibold marker:hidden">
          Estadísticas de la sesión <span className="text-sm font-normal text-slate-400 group-open:hidden">· mostrar</span>
        </summary>
        <div className="mt-4">{body}</div>
      </details>
    );
  }
  return (
    <Card className="p-5 sm:p-6">
      <h3 className="m-0 mb-4 text-xl">Aciertos por pregunta</h3>
      {body}
    </Card>
  );
}

function CopyButton({ text, label, onCopy }: { text: string; label: string; onCopy: (text: string) => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        onCopy(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "¡Copiado!" : label}
    </Button>
  );
}

function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <motion.div
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-3xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl sm:p-8 ${wide ? "max-w-3xl" : "max-w-md"}`}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="m-0 font-display text-2xl font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20">
            ✕
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}
