import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function Home() {
  const navigate = useNavigate();

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
        transition={{
          duration: 0.8,
        }}
        className="
          bg-white/10
          backdrop-blur-xl

          rounded-3xl
          p-10

          shadow-2xl

          w-full
          max-w-xl

          text-center
        "
      >
        <h1
          className="
            text-6xl
            font-bold

            bg-gradient-to-r
            from-fuchsia-300
            to-purple-100

            bg-clip-text
            text-transparent

            mb-4
          "
        >
          🎮 Lilihoot
        </h1>

        <p
          className="
            text-white/80
            mb-10
            text-lg
          "
        >
          Quiz interactivo para clases,
          workshops y eventos.
        </p>

        <div
          className="
            flex
            flex-col
            gap-4
          "
        >
          <button
            onClick={() =>
              navigate("/host")
            }
            className="
              py-4

              rounded-xl

              bg-gradient-to-r
              from-fuchsia-500
              to-purple-600

              text-white
              font-bold
              text-xl

              hover:scale-105
              transition
            "
          >
            🎓 Crear Juego
          </button>

          <button
            onClick={() =>
              navigate("/join")
            }
            className="
              py-4

              rounded-xl

              bg-white/20

              text-white
              font-bold
              text-xl

              hover:bg-white/30
              transition
            "
          >
            🚀 Unirme
          </button>
        </div>
      </motion.div>
    </div>
  );
}