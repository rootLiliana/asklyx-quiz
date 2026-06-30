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

const QUESTION_DURATION_SECONDS = 15;
const EMPTY_QUESTION: Question = {
  id: "",
  text: "",
  options: ["", "", "", ""],
  correctAnswer: 0,
  explanation: "",
};

export default function Host() {
  const [game, setGame] =
    useState<Game | null>(null);

  const [timeLeft, setTimeLeft] =
    useState(QUESTION_DURATION_SECONDS);

  const [hostToken, setHostToken] =
    useState(
      () =>
        localStorage.getItem("hostToken") ??
        ""
    );

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loginError, setLoginError] =
    useState("");

  const [configOpen, setConfigOpen] =
    useState(false);

  const [questionsDraft, setQuestionsDraft] =
    useState<Question[]>([]);

  const [configMessage, setConfigMessage] =
    useState("");

  const [showExplanation, setShowExplanation] =
  useState(false);

  const [showIceBreaker, setShowIceBreaker] =
  useState(false);

const [iceBreakerQuestion, setIceBreakerQuestion] =
  useState("");

const [iceBreakerData, setIceBreakerData] =
  useState<IceBreaker | null>(null);

  const currentQuestionIndex =
    useRef<number | null>(null);

  const authHeaders = {
    Authorization: `Bearer ${hostToken}`,
  };

  const logoutHost = useCallback(() => {
    localStorage.removeItem("hostToken");
    setHostToken("");
    setGame(null);
  }, []);

  const applyGameUpdate = useCallback(
    (updatedGame: Game) => {
      if (
        currentQuestionIndex.current !==
        updatedGame.currentQuestion
      ) {
        currentQuestionIndex.current =
          updatedGame.currentQuestion;

        setTimeLeft(
          updatedGame.questionDurationSeconds ??
            QUESTION_DURATION_SECONDS
        );
      }

      setGame(updatedGame);
    },
    []
  );

  const loginHost = async () => {
    setLoginError("");

    const response = await fetch(
      `${API}/host/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      }
    );

    if (!response.ok) {
      setLoginError(
        "Usuario o contraseña incorrectos."
      );
      return;
    }

    const data: { token: string } =
      await response.json();

    localStorage.setItem(
      "hostToken",
      data.token
    );
    setHostToken(data.token);
    setPassword("");
  };

  const createGame = async () => {
    const response = await fetch(
       `${API}/games`,
      {
        method: "POST",
        headers: authHeaders,
      }
    );

    if (response.status === 401) {
      logoutHost();
      return;
    }

    const createdGame =
      await response.json();

    applyGameUpdate(createdGame);
  };

  const startGame = async () => {
    if (!game) return;

    const response = await fetch(
       `${API}/games/${game.code}/start`,
      {
        method: "POST",
        headers: authHeaders,
      }
    );

    if (response.status === 401) {
      logoutHost();
      return;
    }

    const updatedGame: Game =
      await response.json();

    applyGameUpdate(updatedGame);
  };

  const nextQuestion = async () => {
    if (!game) return;

    const response = await fetch(
       `${API}/games/${game.code}/next`,
      {
        method: "POST",
        headers: authHeaders,
      }
    );

    if (response.status === 401) {
      logoutHost();
      return;
    }

    const updatedGame: Game =
      await response.json();
      

    applyGameUpdate(updatedGame);

    setShowExplanation(false);
  };

  const loadQuestions = async () => {
    setConfigMessage("");

    const response = await fetch(
      `${API}/host/questions`,
      {
        headers: authHeaders,
      }
    );

    if (response.status === 401) {
      logoutHost();
      return;
    }

    const data: Question[] =
      await response.json();

    setQuestionsDraft(data);
  };

  const openQuizConfig = async () => {
    setConfigOpen(true);
    await loadQuestions();
  };

  const saveQuestions = async () => {
    setConfigMessage("");

    const response = await fetch(
      `${API}/host/questions`,
      {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questions: questionsDraft,
        }),
      }
    );

    if (response.status === 401) {
      logoutHost();
      return;
    }

    if (!response.ok) {
      setConfigMessage(
        "Revisa que cada pregunta tenga texto, al menos dos opciones y una respuesta correcta."
      );
      return;
    }

    const savedQuestions: Question[] =
      await response.json();

    setQuestionsDraft(savedQuestions);
    setConfigMessage(
      "Quiz guardado. El próximo juego usará estas preguntas."
    );
  };

  const addQuestion = () => {
    setQuestionsDraft((questions) => [
      ...questions,
      {
        ...EMPTY_QUESTION,
        id: crypto.randomUUID(),
        options: [...EMPTY_QUESTION.options],
      },
    ]);
  };

  const removeQuestion = (index: number) => {
    setQuestionsDraft((questions) =>
      questions.filter(
        (_, questionIndex) =>
          questionIndex !== index
      )
    );
  };

  const updateQuestionText = (
    index: number,
    event: ChangeEvent<HTMLTextAreaElement>
  ) => {
    const { value } = event.target;

    setQuestionsDraft((questions) =>
      questions.map((question, questionIndex) =>
        questionIndex === index
          ? {
              ...question,
              text: value,
            }
          : question
      )
    );
  };

  const updateExplanation = (
  index: number,
  event: ChangeEvent<HTMLTextAreaElement>
) => {
  const { value } = event.target;

  setQuestionsDraft((questions) =>
    questions.map((question, questionIndex) =>
      questionIndex === index
        ? {
            ...question,
            explanation: value,
          }
        : question
    )
  );
};

  const updateOption = (
    questionIndex: number,
    optionIndex: number,
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const { value } = event.target;

    setQuestionsDraft((questions) =>
      questions.map((question, index) => {
        if (index !== questionIndex) {
          return question;
        }

        const options =
          question.options.map(
            (option, currentOptionIndex) =>
              currentOptionIndex ===
              optionIndex
                ? value
                : option
          );

        return {
          ...question,
          options,
        };
      })
    );
  };

  const updateCorrectAnswer = (
    questionIndex: number,
    correctAnswer: number
  ) => {
    setQuestionsDraft((questions) =>
      questions.map((question, index) =>
        index === questionIndex
          ? {
              ...question,
              correctAnswer,
            }
          : question
      )
    );
  };

const startIcebreakerHost = async () => {
    if (!game || !iceBreakerQuestion) return;

    const response = await fetch(`${API}/games/${game.code}/icebreaker`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question: iceBreakerQuestion }),
    });

    if (response.status === 401) {
      logoutHost();
      return;
    }

    const data: IceBreaker = await response.json();
    setIceBreakerData(data);
  };

  const closeIcebreakerHost = async () => {
    if (!game) return;

    const response = await fetch(`${API}/games/${game.code}/icebreaker/close`, {
      method: "PUT",
      headers: authHeaders,
    });

    if (response.status === 401) {
      logoutHost();
      return;
    }

    const data: { icebreaker: IceBreaker } = await response.json();
    setIceBreakerData(data.icebreaker);
    setShowIceBreaker(false); // Cierra el modal automáticamente al terminar
  };

  useEffect(() => {
    const gameCode = game?.code;

    if (!gameCode || !hostToken) return;

    const interval = setInterval(
      async () => {
        const response =
          await fetch(
             `${API}/games/${gameCode}`,
            {
              headers: {
                Authorization:
                  `Bearer ${hostToken}`,
              },
            }
          );

        if (response.status === 401) {
          logoutHost();
          return;
        }

        const updatedGame: Game =
          await response.json();

        applyGameUpdate(updatedGame);
      },
      2000
    );

    return () =>
      clearInterval(interval);
  }, [
    game?.code,
    hostToken,
    logoutHost,
    applyGameUpdate,
  ]);

  const currentQuestionNumber =
    game?.currentQuestion ?? -1;
  const questionCount =
    game?.questions.length ?? 0;

  useEffect(() => {
    if (currentQuestionNumber < 0) return;

    if (
      currentQuestionNumber >= questionCount
    ) {
      return;
    }

    if (timeLeft <= 0) return;

    const timer = setTimeout(() => {
      setTimeLeft(prev =>
        Math.max(0, prev - 1)
      );
    }, 1000);

    return () =>
      clearTimeout(timer);
  }, [
    currentQuestionNumber,
    questionCount,
    timeLeft,
  ]);

  const currentQuestion =
    game?.questions?.[
      game.currentQuestion
    ];

  const liveRanking =
    [...(game?.players ?? [])].sort(
      (a, b) => b.score - a.score
    );

  const visibleRanking =
    liveRanking;

  
    useEffect(() => {
    const gameCode = game?.code;
    if (!gameCode || !hostToken || !showIceBreaker) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API}/games/${gameCode}/icebreaker`, {
          headers: authHeaders,
        });
        
        if (response.status === 401) {
          logoutHost();
          return;
        }

        if (response.ok) {
          const data: IceBreaker = await response.json();
          setIceBreakerData(data);
        }
      } catch (err) {
        console.error("Error cargando respuestas de icebreaker", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [game?.code, hostToken, showIceBreaker, logoutHost]);

  if (!hostToken) {
    return (

      
      <div
        className="
          min-h-screen
          bg-gradient-to-br
          from-slate-950
          via-purple-950
          to-black
          text-white
          flex
          items-center
          justify-center
          p-6
        "
      >
        <div
          className="
            bg-white/10
            backdrop-blur-xl
            rounded-3xl
            p-8
            w-full
            max-w-md
          "
        >
          <p className="text-xs text-slate-400">
            API: {API}
          </p>
          <h1
            className="
              text-4xl
              font-bold
              mb-6
            "
          >
            Host Lilihoot
          </h1>

          <input
            value={username}
            onChange={(event) =>
              setUsername(event.target.value)
            }
            placeholder="Usuario"
            className="
              w-full
              mb-3
              rounded-xl
              bg-white/10
              border
              border-white/20
              p-3
              text-white
              placeholder:text-slate-400
            "
          />

          <input
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            placeholder="Contraseña"
            type="password"
            className="
              w-full
              mb-4
              rounded-xl
              bg-white/10
              border
              border-white/20
              p-3
              text-white
              placeholder:text-slate-400
            "
          />

          <button
            onClick={loginHost}
            className="
              w-full
              p-3
              rounded-xl
              bg-fuchsia-600
              hover:bg-fuchsia-500
              font-bold
            "
          >
            Entrar
          </button>

          {loginError && (
            <p
              className="
                mt-4
                text-red-300
              "
            >
              {loginError}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="
        min-h-screen

        bg-gradient-to-br
        from-slate-950
        via-purple-950
        to-black

        text-white
        p-8
      "
    >
      <div
        className="
          max-w-7xl
          mx-auto
        "
      >
        <div
          className="
            flex
            items-center
            justify-between
            gap-4
            mb-8
          "
        >
          <h1
            className="
              text-5xl
              font-bold
            "
          >
            🎮 Lilihoot Control Center
          </h1>

          <button
            onClick={logoutHost}
            className="
              rounded-xl
              bg-white/10
              hover:bg-white/20
              px-4
              py-3
            "
          >
            Salir
          </button>
        </div>

        {configOpen && (
          <div
            className="
              fixed
              inset-0
              z-50
              flex
              items-center
              justify-center
              bg-black/70
              backdrop-blur-sm
              p-4
            "
          >
            <div
              className="
                max-h-[90vh]
                w-full
                max-w-5xl
                overflow-y-auto
                rounded-3xl
                bg-slate-950/95
                border
                border-white/10
                p-6
                shadow-2xl
              "
            >
            <div
              className="
                flex
                items-center
                justify-between
                gap-4
                mb-6
              "
            >
              <h2
                className="
                  text-3xl
                  font-bold
                "
              >
                Configurar Quiz
              </h2>

              <button
                onClick={() =>
                  setConfigOpen(false)
                }
                className="
                  rounded-xl
                  bg-white/10
                  hover:bg-white/20
                  px-4
                  py-2
                "
              >
                Cerrar
              </button>
            </div>

            <div
              className="
                grid
                gap-5
              "
            >
              {questionsDraft.map(
                (question, questionIndex) => (
                  <div
                    key={
                      question.id ||
                      questionIndex
                    }
                    className="
                      rounded-2xl
                      bg-black/20
                      p-5
                    "
                  >
                    <div
                      className="
                        flex
                        items-center
                        justify-between
                        gap-4
                        mb-4
                      "
                    >
                      <h3
                        className="
                          text-xl
                          font-bold
                        "
                      >
                        Pregunta{" "}
                        {questionIndex + 1}
                      </h3>

                      <button
                        onClick={() =>
                          removeQuestion(
                            questionIndex
                          )
                        }
                        className="
                          rounded-xl
                          bg-red-600
                          hover:bg-red-500
                          px-3
                          py-2
                        "
                      >
                        Eliminar
                      </button>
                    </div>

                    <textarea
                      value={question.text}
                      onChange={(event) =>
                        updateQuestionText(
                          questionIndex,
                          event
                        )
                      }
                      placeholder="Escribe la pregunta"
                      className="
                        w-full
                        min-h-24
                        rounded-xl
                        bg-white/10
                        border
                        border-white/20
                        p-3
                        text-white
                        placeholder:text-slate-400
                        mb-4
                      "
                    />

                    <textarea
                      value={question.explanation}
                      onChange={(event) =>
                        updateExplanation(
                          questionIndex,
                          event
                        )
                      }
                      placeholder="Explicación que verán las alumnas después de responder..."
                      className="
                        w-full
                        min-h-24
                        rounded-xl
                        bg-white/10
                        border
                        border-white/20
                        p-3
                        text-white
                        placeholder:text-slate-400
                        mb-4
                      "
                    />

                    <div
                      className="
                        grid
                        md:grid-cols-2
                        gap-3
                      "
                    >
                      {question.options.map(
                        (
                          option,
                          optionIndex
                        ) => (
                          <label
                            key={optionIndex}
                            className="
                              flex
                              items-center
                              gap-3
                              rounded-xl
                              bg-white/5
                              p-3
                            "
                          >
                            <input
                              type="radio"
                              name={`correct-${questionIndex}`}
                              checked={
                                question.correctAnswer ===
                                optionIndex
                              }
                              onChange={() =>
                                updateCorrectAnswer(
                                  questionIndex,
                                  optionIndex
                                )
                              }
                            />

                            <input
                              value={option}
                              onChange={(event) =>
                                updateOption(
                                  questionIndex,
                                  optionIndex,
                                  event
                                )
                              }
                              placeholder={`Opción ${optionIndex + 1}`}
                              className="
                                w-full
                                rounded-lg
                                bg-transparent
                                border
                                border-white/20
                                p-2
                                text-white
                                placeholder:text-slate-400
                              "
                            />
                          </label>
                        )
                      )}
                    </div>
                  </div>
                )
              )}


            </div>


            <div
              className="
                flex
                flex-wrap
                gap-3
                mt-6
              "
            >
              <button
                onClick={addQuestion}
                className="
                  rounded-xl
                  bg-blue-600
                  hover:bg-blue-500
                  px-4
                  py-3
                "
              >
                Agregar Pregunta
              </button>

              <button
                onClick={saveQuestions}
                className="
                  rounded-xl
                  bg-green-600
                  hover:bg-green-500
                  px-4
                  py-3
                  font-bold
                "
              >
                Guardar Quiz
              </button>
            </div>

            {configMessage && (
              <p
                className="
                  mt-4
                  text-fuchsia-200
                "
              >
                {configMessage}
              </p>
            )}
            </div>
          </div>
        )}



        {showIceBreaker && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-3xl rounded-3xl bg-slate-900 p-8 shadow-2xl border border-white/10 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-extrabold text-pink-400 flex items-center gap-2">
                  ⏳ Chismesito time 
                </h2>
                <button
                  onClick={() => setShowIceBreaker(false)}
                  className="rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2"
                >
                  Ocultar Ventana
                </button>
              </div>

              {!iceBreakerData?.active ? (
                <div className="space-y-4">
                  <p className="text-slate-300">
                    Escribe una pregunta abierta para lanzar a los alumnos mientras esperan a que empiece la trivia oficial.
                  </p>
                  <textarea
                    value={iceBreakerQuestion}
                    onChange={(e) => setIceBreakerQuestion(e.target.value)}
                    placeholder="Ej: ¿Como pides tu elote?"
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
                /* FASE 2: Mostrar respuestas recibidas en tiempo real */
                <div className="space-y-6">
                  <div className="bg-black/30 p-4 rounded-2xl border border-pink-500/20">
                    <span className="text-xs text-pink-400 uppercase tracking-wider font-bold">Pregunta actual:</span>
                    <h3 className="text-2xl font-bold mt-1 text-white">{iceBreakerData.question}</h3>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold mb-3 text-slate-300">
                      Respuestas Recibidas ({iceBreakerData.answers.length})
                    </h4>
                    
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

                  <button
                    onClick={closeIcebreakerHost}
                    className="w-full p-4 rounded-xl bg-red-600 hover:bg-red-500 font-bold text-white transition-all shadow-lg"
                  >
                    🛑 Cerrar Rompehielos e ir a por la victoria
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
        


        <div
          className="
            grid
            lg:grid-cols-3
            gap-6
          "
        >
          {/* Panel Control */}

          <div
            className="
              bg-white/10
              backdrop-blur-xl
              rounded-3xl
              p-6
            "
          >
            <h2
              className="
                text-2xl
                mb-4
              "
            >
              Sala
            </h2>

            <button
              onClick={createGame}
              className="
                w-full
                mb-3
                p-3
                rounded-xl

                bg-fuchsia-600
                hover:bg-fuchsia-500
              "
            >
              Crear Juego
            </button>

           <button
            onClick={() => {
              setShowIceBreaker(true);
              setIceBreakerData(null);
            }}
            className="
              w-full
              bg-pink-600
               mb-3
              p-3
              text-white
              font-bold
              rounded-xl
            "
          >
            🍦 Ice Breaker
          </button>

            <button
              onClick={startGame}
              disabled={!game}
              className="
                w-full
                mb-3
                p-3
                rounded-xl

                bg-green-600
                hover:bg-green-500
              "
            >
              Iniciar Juego
            </button>

            <button
              onClick={nextQuestion}
              disabled={!game}
              className="
                w-full
                mb-3
                p-3
                rounded-xl

                bg-blue-600
                hover:bg-blue-500
              "
            >
              Siguiente Pregunta
            </button>

            <button
              onClick={openQuizConfig}
              className="
                w-full
                p-3
                rounded-xl

                bg-yellow-600
                hover:bg-yellow-500
              "
            >
              Configurar Quiz
            </button>

            {game && (
              <>
                <h3
                  className="
                    mt-8
                    text-lg
                  "
                >
                  Código
                </h3>

                <p
                  className="
                    text-4xl
                    font-bold
                    text-fuchsia-300
                  "
                >
                  {game.code}
                </p>

                <p
                  className="
                    mt-4
                    text-slate-300
                  "
                >
                  Jugadores:
                  {" "}
                  {
                    game.players.length
                  }
                </p>
              </>
            )}
          </div>

          {/* Pregunta Actual */}


          <div
            className="
              bg-white/10
              backdrop-blur-xl
              rounded-3xl
              p-6
            "
          >
            <h2
              className="
                text-2xl
                mb-6
              "
            >
              Pregunta Actual
            </h2>

            {currentQuestion ? (
              <>
                <div
                  className="
                    mb-6
                    flex
                    items-center
                    justify-between
                    gap-4
                    rounded-2xl
                    bg-black/20
                    p-4
                  "
                >
                  <div>
                    <p
                      className="
                        text-sm
                        text-slate-300
                      "
                    >
                      Cronómetro
                    </p>

                    <p
                      className="
                        text-4xl
                        font-black
                        text-fuchsia-300
                      "
                    >
                      {timeLeft}s
                    </p>
                  </div>

                  <div
                    className="
                      text-right
                    "
                  >
                    <p
                      className="
                        text-sm
                        text-slate-300
                      "
                    >
                      Puntos máximos ahora
                    </p>

                    <p
                      className="
                        text-2xl
                        font-bold
                        text-yellow-300
                      "
                    >
                      {timeLeft * 100}
                    </p>
                  </div>
                </div>

                <h3
                  className="
                    text-3xl
                    font-bold
                    mb-6
                  "
                >
                  {
                    currentQuestion.text
                  }
                </h3>

                <div
                  className="
                    grid
                    gap-3
                  "
                >
                  {currentQuestion.options.map(
                    (
                      option,
                      index
                    ) => (
                      <div
                        key={index}
                        className="
                          bg-purple-800/50
                          border
                          border-purple-400/30
                          p-4
                          rounded-xl
                        "
                      >
                        {option}
                      </div>
                    )
                  )}
                </div>
               <button
                onClick={() =>
                  setShowExplanation(!showExplanation)
                }
                className="
                  mt-6
                  flex
                  items-center
                  gap-2
                  rounded-xl
                  bg-yellow-500/20
                  px-4
                  py-2
                  hover:bg-yellow-500/40
                "
              >
                💡
                {showExplanation
                  ? "Ocultar explicación"
                  : "Mostrar explicación"}
              </button>

              {showExplanation && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="
                    mt-4
                    rounded-xl
                    bg-green-500/10
                    border
                    border-green-400/30
                    p-4
                  "
                >
                  <p className="text-sm text-green-300 mb-2">
                    💡 Explicación
                  </p>

                  <p className="text-white">
                    {currentQuestion.explanation}
                  </p>
                </motion.div>
              )}
              </>

              
            ) : (
              <div
                className="
                  text-center
                  mt-10
                "
              >
                <h3
                  className="
                    text-3xl
                  "
                >
                  🎮
                </h3>

                <p>
                  Esperando inicio...
                </p>
              </div>
            )}
          </div>

          {/* Jugadores + Ranking */}

          <div
            className="
              bg-white/10
              backdrop-blur-xl
              rounded-3xl
              p-6
            "
          >
            <h2
              className="
                text-2xl
                mb-4
              "
            >
              👥 Jugadores
            </h2>

            {game?.players.map(
              (player) => (
                <p
                  key={player.id}
                  className="
                    mb-2
                  "
                >
                  👤 {player.name}
                </p>
              )
            )}

            <hr
              className="
                my-6
                border-white/20
              "
            />

            <h2
              className="
                text-2xl
                mb-4
              "
            >
              🏆 Ranking
            </h2>

            {visibleRanking.map(
              (
                player,
                index
              ) => (
                <div
                  key={player.id}
                  className="
                    flex
                    justify-between
                    mb-3

                    bg-white/5
                    p-3
                    rounded-xl
                  "
                >
                  <span>
                    {
                      [
                        "🥇",
                        "🥈",
                        "🥉",
                      ][index] ??
                      `#${index + 1}`
                    }
                    {" "}
                    {player.name}
                  </span>

                  <span>
                    {player.score}
                  </span>
                </div>
              )
            )}

            {visibleRanking.length === 0 && (
              <p
                className="
                  text-slate-300
                "
              >
                El ranking aparecerá cuando
                entren jugadoras.
              </p>
            )}
          </div>
        </div>
      </div>

      
    </div>
  );


  
}
