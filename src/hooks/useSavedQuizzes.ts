import { useCallback, useEffect, useState } from "react";
import type { HostFetch, SavedQuizSummary } from "../types/Host";

export function useSavedQuizzes(api: HostFetch) {
  const [quizzes, setQuizzes] = useState<SavedQuizSummary[]>([]);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    api("/host/quizzes")
      .then(async (response) => {
        if (!response.ok) throw new Error(`status ${response.status}`);
        const data: SavedQuizSummary[] = await response.json();
        if (!cancelled) { setQuizzes(data); setError(""); }
      })
      .catch((err: unknown) => {
        console.error("Error cargando quizzes", err);
        if (!cancelled) setError("No pudimos cargar los quizzes guardados.");
      });

    return () => { cancelled = true; };
  }, [api, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);

  return { quizzes, error, reload };
}
