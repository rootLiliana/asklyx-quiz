import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/nunito-sans";
import "@fontsource-variable/sora";
import "../index.css";
import { installMockApi } from "./mockApi";
import DemoApp from "./DemoApp";

installMockApi();

// La alumna de ejemplo ya "entró" al juego ANA-1234.
try {
  localStorage.setItem("gameCode", "ANA-1234");
  localStorage.setItem("studentNickname", "Sofi");
  localStorage.setItem("studentToken", "demo");
} catch {
  // Sin almacenamiento (ventana privada): el Quiz mostrará "juego no disponible".
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DemoApp />
  </StrictMode>,
);
