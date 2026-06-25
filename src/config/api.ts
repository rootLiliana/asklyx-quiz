export const API =
  import.meta.env.VITE_API_URL ??
  "http://localhost:3001";

console.log("MODE:", import.meta.env.MODE);
console.log("PROD:", import.meta.env.PROD);
console.log("DEV:", import.meta.env.DEV);
console.log("VITE_API_URL:", import.meta.env.VITE_API_URL);
console.log("API:", API);