import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Vista previa con la API simulada (src/demo). No se despliega: sirve para
// revisar el diseño sin servidor. `npm run build:demo` genera dist-demo/.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist-demo",
    emptyOutDir: true,
    rollupOptions: { input: "demo.html" },
  },
});
