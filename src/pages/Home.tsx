import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div>
      <h1>🎉 BEDU Quiz Live 🎉</h1>

      <button onClick={() => navigate("/host")}>
        Crear Juego
      </button>

      <button onClick={() => navigate("/join")}>
        Unirme
      </button>
    </div>
  );
}