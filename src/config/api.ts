export const API =
  import.meta.env.VITE_API_URL ??
  "http://localhost:3001";

console.log("🌎 API:", API);