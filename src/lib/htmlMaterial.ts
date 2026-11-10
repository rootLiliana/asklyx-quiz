// Lectura de un archivo .html para el material interactivo.
// El límite coincide con MAX_HTML del servidor (server/src/materials/material.service.ts).
export const MAX_HTML = 1_000_000;

export type HtmlFile = { html: string; fileName: string; title: string };

// Devuelve el archivo leído o un mensaje de error para la host.
export async function readHtmlFile(file: File): Promise<HtmlFile | string> {
  if (!/\.html?$/i.test(file.name)) return "El archivo debe ser .html";

  const html = await file.text();
  if (!html.trim()) return "El archivo está vacío.";
  if (html.length > MAX_HTML) return "El archivo pesa más de 1 MB.";

  // Título sugerido: el <title> de la página o, si no tiene, el nombre del archivo.
  const pageTitle = new DOMParser().parseFromString(html, "text/html").title.trim();
  const title = (pageTitle || file.name.replace(/\.html?$/i, "").replace(/[_-]+/g, " ")).slice(0, 200);

  return { html, fileName: file.name, title };
}

export function formatKb(text: string): string {
  return `${Math.max(1, Math.round(new Blob([text]).size / 1024))} KB`;
}
