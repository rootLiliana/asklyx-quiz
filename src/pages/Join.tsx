import { useState } from "react";
import type { Game } from "../types/Game";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function Join() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  const joinGame = async () => {
    const response = await fetch(
      `http://localhost:3001/games/${code}/join`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
        }),
      }
    );

    const game: Game =
  await response.json();

          const player =
        game.players.find(
          p => p.name === name
        );

        if (!player) {
          return;
        }


      localStorage.setItem(
      "playerId",
      player.id
    );

      localStorage.setItem(
        "gameCode",
        game.code
      );


    console.log(game);
    navigate("/quiz");
  };

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
      animate={{
        rotate: 360,
      }}
      transition={{
        repeat: Infinity,
        duration: 20,
        ease: "linear",
      }}
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
      animate={{
        rotate: -360,
      }}
      transition={{
        repeat: Infinity,
        duration: 15,
        ease: "linear",
      }}
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
      animate={{
        rotate: 360,
      }}
      transition={{
        repeat: Infinity,
        duration: 25,
        ease: "linear",
      }}
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
      initial={{
        opacity: 0,
        y: 80,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.8,
      }}
      className="
        z-10

        bg-white/10
        backdrop-blur-md

        p-10
        rounded-3xl
        shadow-2xl

        w-full
        max-w-md

        hover:scale-[1.02]
        transition-all
        duration-300
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
        🎮 Asklyx
      </h1>

      <input
        className="
          w-full
          p-4
          rounded-xl
          mb-4

          text-lg

          bg-white
          text-black

          focus:outline-none
          focus:ring-4
          focus:ring-fuchsia-400
        "
        placeholder="Tu nombre"
        value={name}
        onChange={(e) =>
          setName(e.target.value)
        }
      />

      <input
        className="
          w-full
          p-4
          rounded-xl
          mb-6

          text-lg

          bg-white
          text-black

          focus:outline-none
          focus:ring-4
          focus:ring-fuchsia-400
        "
        placeholder="Código"
        value={code}
        onChange={(e) =>
          setCode(e.target.value)
        }
      />

      <button
        onClick={joinGame}
        className="
          w-full

          bg-gradient-to-r
          from-fuchsia-500
          to-purple-600

          hover:from-fuchsia-400
          hover:to-purple-500

          text-white
          font-bold
          text-lg

          py-4
          rounded-xl

          transition-all
          duration-300
        "
      >
        Entrar
      </button>
    </motion.div>
  </div>
);

}