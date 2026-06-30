import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Host from "./pages/Host";
import Join from "./pages/Join";
import Quiz from "./pages/Quiz";
import IceBreaker from "./pages/IceBreaker";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/host" element={<Host />} />

        <Route path="/join" element={<Join />} />

        <Route path="/quiz" element={<Quiz />} />

        <Route path="/icebreaker" element={<IceBreaker />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;