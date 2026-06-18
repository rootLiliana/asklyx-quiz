import { useState, useEffect } from "react";
import type { Game } from "../types/Game";
import type { Player } from "../types/Player";

export default function Host() {
  const [game, setGame] =
    useState<Game | null>(null);

  const [leaderboard, setLeaderboard] =
    useState<Player[]>([]);

  const createGame = async () => {
    const response = await fetch(
      "http://localhost:3001/games",
      {
        method: "POST",
      }
    );

    const createdGame =
      await response.json();

    setGame(createdGame);
  };

  const startGame = async () => {
    if (!game) return;

    const response = await fetch(
      `http://localhost:3001/games/${game.code}/start`,
      {
        method: "POST",
      }
    );

    const updatedGame: Game =
      await response.json();

    setGame(updatedGame);
  };

  const nextQuestion = async () => {
    if (!game) return;

    const response = await fetch(
      `http://localhost:3001/games/${game.code}/next`,
      {
        method: "POST",
      }
    );

    const updatedGame: Game =
      await response.json();

    setGame(updatedGame);
  };

  const loadLeaderboard =
    async () => {
      if (!game) return;

      const response = await fetch(
        `http://localhost:3001/games/${game.code}/leaderboard`
      );

      const data: Player[] =
        await response.json();

      setLeaderboard(data);
    };

  useEffect(() => {
    if (!game) return;

    const interval = setInterval(
      async () => {
        const response =
          await fetch(
            `http://localhost:3001/games/${game.code}`
          );

        const updatedGame: Game =
          await response.json();

        setGame(updatedGame);
      },
      2000
    );

    return () =>
      clearInterval(interval);
  }, [game?.code]);

  const currentQuestion =
    game?.questions?.[
      game.currentQuestion
    ];

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
        <h1
          className="
            text-5xl
            font-bold
            mb-8
          "
        >
          🎮 Asklyx Control Center
        </h1>

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
              onClick={loadLeaderboard}
              disabled={!game}
              className="
                w-full
                p-3
                rounded-xl

                bg-yellow-600
                hover:bg-yellow-500
              "
            >
              Ver Ranking
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

            {leaderboard.map(
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
          </div>
        </div>
      </div>
    </div>
  );
}