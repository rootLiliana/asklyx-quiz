import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Join from "./pages/Join";
import Quiz from "./pages/Quiz";
import IceBreaker from "./pages/IceBreaker";

// Se descargan solo al abrirlas: así el celular de los alumnos no baja el
// panel del Host ni el resaltado de código para entrar a un juego.
const Host = lazy(() => import("./pages/Host"));
const Podium = lazy(() => import("./pages/Podium"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const MyResults = lazy(() => import("./pages/MyResults"));
const MyGroup = lazy(() => import("./pages/MyGroup"));

function Loading() {
  return (
    <div className="min-h-dvh bg-gradient-to-br from-purple-900 via-indigo-900 to-black flex items-center justify-center text-white/70">
      Cargando...
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />

          <Route path="/host" element={<Host />} />

          <Route path="/join" element={<Join />} />

          <Route path="/quiz" element={<Quiz />} />

          <Route path="/icebreaker" element={<IceBreaker />} />

          <Route path="/podium" element={<Podium />} />

          <Route path="/reset-password" element={<ResetPassword />} />

          <Route path="/mis-resultados" element={<MyResults />} />

          <Route path="/mi-grupo" element={<MyGroup />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
