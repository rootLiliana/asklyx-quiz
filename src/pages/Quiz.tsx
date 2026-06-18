import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { Question } from "../types/Question";
import type { Game } from "../types/Game";
import type { Player } from "../types/Player";
import Confetti from "react-confetti";

export default function Quiz() {
  const [question, setQuestion] =
    useState<Question | null>(null);

  const [waiting, setWaiting] =
    useState(false);

  const [finished, setFinished] =
    useState(false);

  const [result, setResult] =
    useState("");

  const [timeLeft, setTimeLeft] =
    useState(10);

  const [answered, setAnswered] =
    useState(false);

  const [leaderboard, setLeaderboard] =
    useState<Player[]>([]);

  const code =
    localStorage.getItem("gameCode");

  const loadQuestion = async () => {
    if (!code) return;

    const response = await fetch(
      `http://localhost:3001/games/${code}/question`
    );

    const data = await response.json();

    if (data.waiting) {
      setWaiting(true);
      return;
    }

    if (data.finished) {
      await loadLeaderboard();

      setFinished(true);

      return;
    }

    setWaiting(false);
    setFinished(false);

    setQuestion(data);
  };

  const loadLeaderboard = async () => {
    const response = await fetch(
      `http://localhost:3001/games/${code}/leaderboard`
    );

    const data: Player[] =
      await response.json();

    console.log("Leaderboard:", data);
    setLeaderboard(data);
  };

  useEffect(() => {
    loadQuestion();

    const interval = setInterval(
      loadQuestion,
      2000
    );

    return () =>
      clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!question) return;

    setTimeLeft(10);
    setAnswered(false);
    setResult("");
  }, [question?.id]);

  useEffect(() => {
    if (answered) return;

    if (timeLeft <= 0) return;

    const timer = setTimeout(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () =>
      clearTimeout(timer);
  }, [timeLeft, answered]);


  const submitAnswer = async (
    answer: number
  ) => {
    if (answered) return;

    const playerId =
      localStorage.getItem("playerId");

    if (!playerId) return;

    const response = await fetch(
      `http://localhost:3001/games/${code}/answer`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          playerId,
          answer,
          timeLeft,
        }),
      }
    );


    const data =
      await response.json();

    setResult(
      data.correct
        ? "✅ Correcto"
        : "❌ Incorrecto"
    );

    setAnswered(true);
  };

  if (!code) {
    return (
      <h1>
        No hay juego activo
      </h1>
    );
  }

  if (waiting) {
    return (
      <div
        className="
          min-h-screen
          flex
          items-center
          justify-center
          bg-gradient-to-br
          from-purple-900
          via-indigo-900
          to-black
        "
      >
        <motion.h1
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{
            repeat: Infinity,
            duration: 2,
          }}
          className="
            text-white
            text-4xl
            font-bold
          "
        >
          🎮 Esperando al experto...
        </motion.h1>
      </div>
    );
  }



  if (finished) {

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
        p-6
      "
      >
        <div
          className="
          bg-white/10
          backdrop-blur-xl
          rounded-3xl
          p-10
          shadow-2xl

          w-full
          max-w-4xl
        "
        >
          <h1
            className="
            text-6xl
            text-center
            mb-12
          "
          >
            🏆
          </h1>

          <h2
            className="
            text-white
            text-center
            text-5xl
            font-bold
            mb-16
          "
          >
            Ranking Final
          </h2>

          <div
            className="
            flex
            items-end
            justify-center
            gap-6
          "
          >
            {/* Segundo */}
            <div
              className="
              text-center
            "
            >
              <h2 className="text-5xl">
                🥈
              </h2>

              <p className="text-white text-2xl">
                {leaderboard[1]?.name}
              </p>

              <div
                className="
                h-40
                w-32
                bg-slate-400
                rounded-t-xl

                flex
                items-center
                justify-center

                text-white
                font-bold
              "
              >
                {leaderboard[1]?.score}
              </div>
            </div>

            {/* Primero */}
            <div
              className="
              text-center
            "
            >
              <h2 className="text-6xl">
                👑
              </h2>

              <h2 className="text-6xl">
                🥇
              </h2>

              <p className="text-white text-3xl">
                {leaderboard[0]?.name}
              </p>

              <div
                className="
                h-56
                w-36

                bg-yellow-500
                rounded-t-xl

                flex
                items-center
                justify-center

                text-white
                font-bold
                text-xl
              "
              >
                {leaderboard[0]?.score}
              </div>
            </div>

            {/* Tercero */}
            <div
              className="
              text-center
            "
            >
              <h2 className="text-5xl">
                🥉
              </h2>

              <p className="text-white text-2xl">
                {leaderboard[2]?.name}
              </p>

              <div
                className="
                h-28
                w-32

                bg-orange-700
                rounded-t-xl

                flex
                items-center
                justify-center

                text-white
                font-bold
              "
              >
                {leaderboard[2]?.score}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <h1>
        Cargando...
      </h1>
    );
  }

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

        p-6
      "
    >
      <motion.div
        initial={{
          opacity: 0,
          scale: 0.9,
        }}
        animate={{
          opacity: 1,
          scale: 1,
        }}
        className="
          bg-white/10
          backdrop-blur-xl

          rounded-3xl
          p-8

          shadow-2xl

          w-full
          max-w-4xl
        "
      >
        <div
          className="
    flex
    justify-between
    items-center
    mb-6
  "
        >
          <h2
            className="
        text-white
        text-xl
        font-bold
      "
          >
            Pregunta
          </h2>

          <div
            className="
        text-right
      "
          >
            <p
              className="
          text-white
          text-sm
        "
            >
              ⏱️ {timeLeft}s
            </p>

            <p
              className="
          text-fuchsia-300
          font-bold
          text-xl
        "
            >
              ⚡ {timeLeft * 100} pts
            </p>
          </div>
        </div>

        <motion.div
          animate={
            timeLeft <= 3
              ? {
                scale: [
                  1,
                  1.1,
                  1,
                ],
              }
              : {}
          }
          transition={{
            repeat: Infinity,
            duration: 0.8,
          }}
          className="
            w-24
            h-24

            rounded-full

            border-4
            border-fuchsia-400

            flex
            items-center
            justify-center

            text-white
            text-4xl
            font-bold

            mx-auto
            mb-8
          "
        >
          {timeLeft}
        </motion.div>

        <h1
          className="
            text-white
            text-3xl
            font-bold
            text-center
            mb-10
          "
        >
          {question.text}
        </h1>

        <div
          className="
            grid
            md:grid-cols-2
            gap-4
          "
        >
          {question.options.map(
            (option, index) => (
              <motion.button
                key={index}
                whileHover={{
                  scale: 1.03,
                }}
                whileTap={{
                  scale: 0.95,
                }}
                disabled={
                  answered ||
                  timeLeft === 0
                }
                onClick={() =>
                  submitAnswer(index)
                }
                className="
                  p-6

                  rounded-2xl

                  bg-gradient-to-r
                  from-fuchsia-500
                  to-purple-600

                  text-white
                  text-xl
                  font-bold

                  shadow-xl
                "
              >
                {option}
              </motion.button>
            )
          )}
        </div>

        <motion.div
          className="
            mt-8
            text-center
          "
        >
          <h2
            className="
              text-3xl
              font-bold
              text-white
            "
          >
            {timeLeft === 0 &&
              !answered
              ? "⌛ Tiempo agotado"
              : result}
          </h2>
        </motion.div>
      </motion.div>
    </div>
  );
}