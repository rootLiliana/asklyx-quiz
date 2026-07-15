import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ChangeEvent,
} from "react";
import type { Game } from "../types/Game";
import type { Question } from "../types/Question";
import { API } from "../config/api";
import { motion } from "framer-motion";
import type { IceBreaker } from "../types/IceBreaker";
import QRCode from "react-qr-code";

// Interfaces añadidas para tipar las estadísticas correctamente
interface QuestionStat {
  text: string;
  percentage: number;
}

const QUESTION_DURATION_SECONDS = 15;
const EMPTY_QUESTION: Question = {
  id: "",
  text: "",
  options: ["", "", "", ""],
  correctAnswer: 0,
  explanation: "",
};

export default function Host() {
  const [game, setGame] = useState<Game | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(QUESTION_DURATION_SECONDS);
  const [hostToken, setHostToken] = useState(() => localStorage.getItem("hostToken") ?? "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  const [questionsDraft, setQuestionsDraft] = useState<Question[]>([]);
  const [configMessage, setConfigMessage] = useState("");
  const [showExplanation, setShowExplanation] = useState(false);
  const [showIceBreaker, setShowIceBreaker] = useState(false);
  const [iceBreakerQuestion, setIceBreakerQuestion] = useState("");
  const [showQrModal, setShowQrModal] = useState(false);
  const [iceBreakerData, setIceBreakerData] = useState<IceBreaker | null>(null);
  
  // Estado para las estadísticas
  const [stats, setStats] = useState<QuestionStat[]>([]);

  const currentQuestionIndex = useRef<number | null>(null);

  const joinUrl = game ? `${window.location.origin}/join?code=${game.code}` : "";
  const gameCode = game?.code ?? "";
  const authHeaders = { Authorization: `Bearer ${hostToken}` };

  const logoutHost = useCallback(() => {
    localStorage.removeItem("hostToken");
    setHostToken("");
    setGame(null);
  }, []);

  const applyGameUpdate = useCallback((updatedGame: Game) => {
    if (currentQuestionIndex.current !== updatedGame.currentQuestion) {
      currentQuestionIndex.current = updatedGame.currentQuestion;
      setTimeLeft(updatedGame.questionDurationSeconds ?? QUESTION_DURATION_SECONDS);
    }
    setGame(updatedGame);
  }, []);

  const loginHost = async () => {
    setLoginError("");
    const response = await fetch(`${API}/host/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      setLoginError("Usuario o contraseña incorrectos.");
      return;
    }

    const data: { token: string } = await response.json();
    localStorage.setItem("hostToken", data.token);
    setHostToken(data.token);
    setPassword("");
  };

  const createGame = async () => {
    const response = await fetch(`${API}/games`, { method: "POST", headers: authHeaders });
    if (response.status === 401) { logoutHost(); return; }
    const createdGame = await response.json();
    applyGameUpdate(createdGame);
  };

  const startGame = async () => {
    if (!game) return;
    const response = await fetch(`${API}/games/${game.code}/start`, { method: "POST", headers: authHeaders });
    if (response.status === 401) { logoutHost(); return; }
    const updatedGame: Game = await response.json();
    applyGameUpdate(updatedGame);
  };

  const nextQuestion = async () => {
    if (!game) return;
    const response = await fetch(`${API}/games/${game.code}/next`, { method: "POST", headers: authHeaders });
    if (response.status === 401) { logoutHost(); return; }
    const updatedGame: Game = await response.json();
    applyGameUpdate(updatedGame);
    setShowExplanation(false);
  };

  const loadQuestions = async () => {
    setConfigMessage("");
    const response = await fetch(`${API}/host/questions`, { headers: authHeaders });
    if (response.status === 401) { logoutHost(); return; }
    const data: Question[] = await response.json();
    setQuestionsDraft(data);
  };

  const openQuizConfig = async () => {
    setConfigOpen(true);
    await loadQuestions();
  };

  const saveQuestions = async () => {
    setConfigMessage("");
    const response = await fetch(`${API}/host/questions`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ questions: questionsDraft }),
    });

    if (response.status === 401) { logoutHost(); return; }
    if (!response.ok) {
      setConfigMessage("Revisa que cada pregunta tenga texto, al menos dos opciones y una respuesta correcta.");
      return;
    }

    const savedQuestions: Question[] = await response.json();
    setQuestionsDraft(savedQuestions);
    setConfigMessage("Quiz guardado. El próximo juego usará estas preguntas.");
  };

  // Función para cargar estadísticas obtenida de tu consulta
  const loadStats = useCallback(async () => {
    if (!gameCode) return;
    try {
      const response = await fetch(`${API}/games/${gameCode}/stats`, { headers: authHeaders });
      if (response.status === 401) { logoutHost(); return; }
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Error cargando estadísticas", err);
    }
  }, [gameCode, logoutHost]);

  const addQuestion = () => {
    setQuestionsDraft((questions) => [
      ...questions,
      { ...EMPTY_QUESTION, id: crypto.randomUUID(), options: [...EMPTY_QUESTION.options] },
    ]);
  };

  const removeQuestion = (index: number) => {
    setQuestionsDraft((questions) => questions.filter((_, i) => i !== index));
  };

  const updateQuestionText = (index: number, event: ChangeEvent<HTMLTextAreaElement>) => {
    const { value } = event.target;
    setQuestionsDraft((questions) => questions.map((q, i) => i === index ? { ...q, text: value } : q));
  };

  const updateExplanation = (index: number, event: ChangeEvent<HTMLTextAreaElement>) => {
    const { value } = event.target;
    setQuestionsDraft((questions) => questions.map((q, i) => i === index ? { ...q, explanation: value } : q));
  };

  const updateOption = (questionIndex: number, optionIndex: number, event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setQuestionsDraft((questions) =>
      questions.map((q, i) => {
        if (i !== questionIndex) return q;
        const options = q.options.map((opt, oi) => oi === optionIndex ? value : opt);
        return { ...q, options };
      })
    );
  };

  const updateCorrectAnswer = (questionIndex: number, correctAnswer: number) => {
    setQuestionsDraft((questions) => questions.map((q, i) => i === questionIndex ? { ...q, correctAnswer } : q));
  };

  const startIcebreakerHost = async () => {
    if (!game || !iceBreakerQuestion) return;
    const response = await fetch(`${API}/games/${game.code}/icebreaker`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ question: iceBreakerQuestion }),
    });
    if (response.status === 401) { logoutHost(); return; }
    const data: IceBreaker = await response.json();
    setIceBreakerData(data);
  };

  const closeIcebreakerHost = async () => {
    if (!game) return;
    const response = await fetch(`${API}/games/${game.code}/icebreaker/close`, { method: "PUT", headers: authHeaders });
    if (response.status === 401) { logoutHost(); return; }
    const data: { icebreaker: IceBreaker } = await response.json();
    setIceBreakerData(data.icebreaker);
    setShowIceBreaker(false);
  };

  // Intervalo unificado para juego y estadísticas en tiempo real
  useEffect(() => {
    if (!gameCode || !hostToken) return;

    const interval = setInterval(async () => {
      // 1. Actualizar juego
      const response = await fetch(`${API}/games/${gameCode}`, { headers: authHeaders });
      if (response.status === 401) { logoutHost(); return; }
      if (response.ok) {
        const updatedGame: Game = await response.json();
        applyGameUpdate(updatedGame);
      }
      
      // 2. Traer estadísticas en tiempo real si el juego inició
      loadStats();
    }, 2000);

    return () => clearInterval(interval);
  }, [gameCode, hostToken, logoutHost, applyGameUpdate, loadStats]);

  // Intervalo del Icebreaker
  useEffect(() => {
    if (!gameCode || !hostToken || !showIceBreaker) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API}/games/${gameCode}/icebreaker`, { headers: authHeaders });
        if (response.status === 401) { logoutHost(); return; }
        if (response.ok) {
          const data: IceBreaker = await response.json();
          setIceBreakerData(data);
        }
      } catch (err) {
        console.error("Error cargando respuestas de icebreaker", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [gameCode, hostToken, showIceBreaker, logoutHost]);

  // Temporizador de preguntas
  const currentQuestionNumber = game?.currentQuestion ?? -1;
  const questionCount = game?.questions.length ?? 0;

  useEffect(() => {
    if (currentQuestionNumber < 0 || currentQuestionNumber >= questionCount || timeLeft <= 0) return;

    const timer = setTimeout(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [currentQuestionNumber, questionCount, timeLeft]);

  const currentQuestion = game?.questions?.[game.currentQuestion];
  const liveRanking = [...(game?.players ?? [])].sort((a, b) => b.score - a.score);

  if (!hostToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-black text-white flex items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 w-full max-w-md">
          <p className="text-xs text-slate-400">API: {API}</p>
          <h1 className="text-4xl font-bold mb-6">Host Lilihoot</h1>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Usuario"
            className="w-full mb-3 rounded-xl bg-white/10 border border-white/20 p-3 text-white placeholder:text-slate-400"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            type="password"
            className="w-full mb-4 rounded-xl bg-white/10 border border-white/20 p-3 text-white placeholder:text-slate-400"
          />
          <button onClick={loginHost} className="w-full p-3 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 font-bold">
            Entrar
          </button>
          {loginError && <p className="mt-4 text-red-300">{loginError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8">
          <h1 className="text-5xl font-bold">🎮 Lilihoot Control Center</h1>
          <button onClick={logoutHost} className="rounded-xl bg-white/10 hover:bg-white/20 px-4 py-3">
            Salir
          </button>
        </div>

        {/* MODAL CONFIGURACIÓN QUIZ */}
        {configOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-slate-950/95 border border-white/10 p-6 shadow-2xl">
              <div className="flex items-center justify-between gap-4 mb-6">
                <h2 className="text-3xl font-bold">Configurar Quiz</h2>
                <button onClick={() => setConfigOpen(false)} className="rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2">
                  Cerrar
                </button>
              </div>

              <div className="grid gap-5">
                {questionsDraft.map((question, questionIndex) => (
                  <div key={question.id || questionIndex} className="rounded-2xl bg-black/20 p-5">
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <h3 className="text-xl font-bold">Pregunta {questionIndex + 1}</h3>
                      <button onClick={() => removeQuestion(questionIndex)} className="rounded-xl bg-red-600 hover:bg-red-500 px-3 py-2">
                        Eliminar
                      </button>
                    </div>

                    <textarea
                      value={question.text}
                      onChange={(e) => updateQuestionText(questionIndex, e)}
                      placeholder="Escribe la pregunta"
                      className="w-full min-h-24 rounded-xl bg-white/10 border border-white/20 p-3 text-white placeholder:text-slate-400 mb-4"
                    />

                    <textarea
                      value={question.explanation}
                      onChange={(e) => updateExplanation(questionIndex, e)}
                      placeholder="Explicación que verán las alumnas después de responder..."
                      className="w-full min-h-24 rounded-xl bg-white/10 border border-white/20 p-3 text-white placeholder:text-slate-400 mb-4"
                    />

                    <div className="grid md:grid-cols-2 gap-3">
                      {question.options.map((option, optionIndex) => (
                        <label key={optionIndex} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                          <input
                            type="radio"
                            name={`correct-${questionIndex}`}
                            checked={question.correctAnswer === optionIndex}
                            onChange={() => updateCorrectAnswer(questionIndex, optionIndex)}
                          />
                          <input
                            value={option}
                            onChange={(e) => updateOption(questionIndex, optionIndex, e)}
                            placeholder={`Opción ${optionIndex + 1}`}
                            className="w-full rounded-lg bg-transparent border border-white/20 p-2 text-white placeholder:text-slate-400"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 mt-6">
                <button onClick={addQuestion} className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-3">
                  Agregar Pregunta
                </button>
                <button onClick={saveQuestions} className="rounded-xl bg-green-600 hover:bg-green-500 px-4 py-3 font-bold">
                  Guardar Quiz
                </button>
              </div>
              {configMessage && <p className="mt-4 text-fuchsia-200">{configMessage}</p>}
            </div>
          </div>
        )}

        {/* MODAL ICEBREAKER */}
        {showIceBreaker && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-3xl rounded-3xl bg-slate-900 p-8 shadow-2xl border border-white/10 overflow-y-auto max-h-[90vh]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-extrabold text-pink-400 flex items-center gap-2">⏳ Chismesito time</h2>
                <button onClick={() => setShowIceBreaker(false)} className="rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2">
                  Ocultar Ventana
                </button>
              </div>

              {!iceBreakerData?.active ? (
                <div className="space-y-4">
                  <p className="text-slate-300">Escribe una pregunta abierta para lanzar a los alumnos mientras esperan.</p>
                  <textarea
                    value={iceBreakerQuestion}
                    onChange={(e) => setIceBreakerQuestion(e.target.value)}
                    placeholder="Ej: ¿Cómo pides tú el elote?"
                    className="w-full min-h-24 rounded-xl bg-white/5 border border-white/20 p-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-pink-500"
                  />
                  <button
                    onClick={startIcebreakerHost}
                    disabled={!iceBreakerQuestion || !game}
                    className="w-full p-4 rounded-xl bg-pink-600 hover:bg-pink-500 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    🚀 Lanzar Pregunta
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-black/30 p-4 rounded-2xl border border-pink-500/20">
                    <span className="text-xs text-pink-400 uppercase tracking-wider font-bold">Pregunta actual:</span>
                    <h3 className="text-2xl font-bold mt-1 text-white">{iceBreakerData.question}</h3>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold mb-3 text-slate-300">Respuestas Recibidas ({iceBreakerData.answers.length})</h4>
                    <div className="grid md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2">
                      {iceBreakerData.answers.map((ans) => (
                        <div key={ans.id} className="bg-white/5 border border-white/10 rounded-xl p-4 shadow-sm">
                          <p className="text-white mb-2 italic">"{ans.text}"</p>
                          <span className="text-xs text-fuchsia-400 font-semibold">👤 {ans.playerName}</span>
                        </div>
                      ))}
                      {iceBreakerData.answers.length === 0 && (
                        <p className="text-slate-500 col-span-2 text-center py-4">Esperando respuestas de los alumnos...</p>
                      )}
                    </div>
                  </div>
                  <button onClick={closeIcebreakerHost} className="w-full p-4 rounded-xl bg-red-600 hover:bg-red-500 font-bold text-white transition-all shadow-lg">
                    🛑 Cerrar Rompehielos e ir a por la victoria
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* CONTENIDO PRINCIPAL EN TRES COLUMNAS */}
        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* COLUMNA 1: Panel Control de la Sala */}
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6">
            <h2 className="text-2xl mb-4">Sala</h2>
            <button onClick={createGame} className="w-full mb-3 p-3 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500">
              Crear Juego
            </button>
            <button onClick={() => { setShowIceBreaker(true); setIceBreakerData(null); }} className="w-full bg-pink-600 mb-3 p-3 text-white font-bold rounded-xl">
              🍦 Ice Breaker
            </button>
            <button onClick={startGame} disabled={!game} className="w-full mb-3 p-3 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50">
              Iniciar Juego
            </button>
            <button onClick={nextQuestion} disabled={!game} className="w-full mb-3 p-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50">
              Siguiente Pregunta
            </button>
            <button onClick={openQuizConfig} className="w-full p-3 rounded-xl bg-yellow-600 hover:bg-yellow-500">
              Configurar Quiz
            </button>

            {game && (
              <>
                <h3 className="mt-8 text-lg">Código</h3>
                <div className="mt-4 flex flex-col items-center gap-4">
                  <div onClick={() => setShowQrModal(true)} className="bg-white p-4 rounded-2xl shadow-xl cursor-zoom-in hover:scale-105 transition-all duration-300">
                    <QRCode value={joinUrl} size={150} />
                    <p className="mt-2 text-center text-gray-600 text-xs font-semibold">🔍 Ampliar</p>
                  </div>
                  <div className="flex gap-2 w-full">
                    <button onClick={() => navigator.clipboard.writeText(joinUrl)} className="flex-1 bg-fuchsia-600 py-2 rounded-xl text-white text-sm">
                      📋 Link
                    </button>
                    <button onClick={() => navigator.clipboard.writeText(game.code)} className="flex-1 bg-fuchsia-600 py-2 rounded-xl text-white text-sm">
                      🔢 Código
                    </button>
                  </div>
                  <p className="text-fuchsia-300 font-bold text-2xl tracking-wider">{game.code}</p>
                </div>
                <p className="mt-4 text-slate-300">Jugadores unidos: {game.players.length}</p>
              </>
            )}
          </div>

          {/* COLUMNA 2: Pregunta Actual & Estadísticas Integradas */}
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 flex flex-col gap-6">
            <div>
              <h2 className="text-2xl mb-4">Pregunta Actual</h2>
              {currentQuestion ? (
                <>
                  <div className="mb-4 flex items-center justify-between gap-4 rounded-2xl bg-black/20 p-4">
                    <div>
                      <p className="text-sm text-slate-300">Cronómetro</p>
                      <p className="text-4xl font-black text-fuchsia-300">{timeLeft}s</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-300">Puntos máx.</p>
                      <p className="text-2xl font-bold text-yellow-300">{timeLeft * 100}</p>
                    </div>
                  </div>

                  <h3 className="text-2xl font-bold mb-4">{currentQuestion.text}</h3>
                  <div className="grid gap-3">
                    {currentQuestion.options.map((option, index) => (
                      <button
                        key={index}
                        className={`p-4 rounded-2xl text-white font-bold transition-all text-left px-6 ${
                          showExplanation && index === currentQuestion.correctAnswer
                            ? "bg-gradient-to-r from-green-500 to-emerald-600 ring-4 ring-green-300 scale-102"
                            : "bg-gradient-to-r from-fuchsia-500 to-purple-600"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>

                  <button onClick={() => setShowExplanation(!showExplanation)} className="mt-4 flex items-center gap-2 rounded-xl bg-yellow-500/20 px-4 py-2 hover:bg-yellow-500/40 text-sm">
                    💡 {showExplanation ? "Ocultar explicación" : "Mostrar explicación"}
                  </button>

                  {showExplanation && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl bg-green-500/10 border border-green-400/30 p-4">
                      <p className="text-sm text-green-300 mb-1">💡 Explicación</p>
                      <p className="text-white text-sm">{currentQuestion.explanation}</p>
                    </motion.div>
                  )}
                </>
              ) : (
                <div className="text-center mt-6 text-slate-400">
                  <p className="text-3xl mb-2">🎮</p>
                  <p>Esperando inicio de la trivia...</p>
                </div>
              )}
            </div>

            {/* SECCIÓN ESTADÍSTICAS REFORMATEADA E INTEGRADA */}
            <div className="border-t border-white/10 pt-6">
              <h2 className="text-2xl font-bold text-white mb-2">📊 Estadísticas de la sesión</h2>
              <p className="text-xs text-gray-400 mb-4">Rendimiento por pregunta en tiempo real.</p>
              
              <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                {stats.map((stat, i) => (
                  <div key={i} className="bg-black/20 rounded-xl p-3 border border-white/5">
                    <h4 className="text-sm font-semibold text-white mb-2 truncate">{stat.text}</h4>
                    <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        style={{ width: `${stat.percentage}%` }}
                        className={`h-full rounded-full transition-all duration-700 ${
                          stat.percentage >= 90 ? "bg-green-500" :
                          stat.percentage >= 70 ? "bg-yellow-400" :
                          stat.percentage >= 50 ? "bg-orange-400" : "bg-red-500"
                        }`}
                      />
                    </div>
                    <div className="mt-1 flex justify-between items-center text-xs">
                      <span className="text-slate-400">Aciertos</span>
                      <span className="font-bold text-white">{stat.percentage}%</span>
                    </div>
                  </div>
                ))}
                {stats.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-4">No hay estadísticas disponibles aún.</p>
                )}
              </div>
            </div>
          </div>

          {/* COLUMNA 3: Lista de Jugadores & Ranking */}
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6">
            <h2 className="text-2xl mb-4">👥 Jugadores</h2>
            <div className="max-h-40 overflow-y-auto space-y-1 mb-6">
              {game?.players.map((player) => (
                <p key={player.id} className="text-sm bg-white/5 p-2 rounded-lg">👤 {player.name}</p>
              ))}
              {game?.players.length === 0 && <p className="text-xs text-slate-400">Esperando que entren participantes...</p>}
            </div>

            <hr className="my-4 border-white/20" />

            <h2 className="text-2xl mb-4">🏆 Ranking</h2>
            <div className="space-y-2">
              {liveRanking.map((player, index) => (
                <div key={player.id} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-sm font-medium">
                    {["🥇", "🥈", "🥉"][index] ?? `#${index + 1}`} {player.name}
                  </span>
                  <span className="font-bold text-fuchsia-400">{player.score}</span>
                </div>
              ))}
              {liveRanking.length === 0 && (
                <p className="text-sm text-slate-400">El ranking aparecerá cuando envíen respuestas.</p>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* MODAL QR EXPANDIDO */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="relative bg-slate-950 border border-white/10 rounded-[32px] p-8 max-w-md w-full flex flex-col items-center justify-center text-center shadow-2xl">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white text-lg flex items-center justify-center hover:bg-fuchsia-600 transition-all duration-300"
            >
              ✕
            </button>
            <h3 className="text-2xl font-bold mb-6">🚀 Únete a Lilihoot</h3>
            <div className="bg-white p-6 rounded-2xl mb-6 shadow-inner">
              <QRCode value={joinUrl} size={260} />
            </div>
            <p className="text-sm text-slate-400 mb-6">📱 Escanea con la cámara de tu celular</p>
            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={() => {
                  if (!gameCode) return;
                  navigator.clipboard.writeText(gameCode);
                  setCodeCopied(true);
                  setTimeout(() => setCodeCopied(false), 2000);
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 font-bold text-sm"
              >
                {codeCopied ? "✅ Código copiado" : "🔢 Copiar código"}
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(joinUrl);
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2000);
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 font-bold text-sm"
              >
                {linkCopied ? "✅ Enlace copiado" : "📋 Copiar enlace"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}