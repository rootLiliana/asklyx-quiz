import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Host from "./pages/Host";
import Join from "./pages/Join";
import Quiz from "./pages/Quiz";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/host" element={<Host />} />

        <Route path="/join" element={<Join />} />

        <Route path="/quiz" element={<Quiz />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;