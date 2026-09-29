import { useEffect, useState } from "react";
import { API } from "../config/api";
import type { ClassSummary, GroupSummary } from "../types/Host";

interface ClassCatalog {
  groups: GroupSummary[];
  classes: ClassSummary[];
  loading: boolean;
  error: string;
}

// Grupos y clases (GET /groups y GET /classes son públicos).
export function useClassCatalog(): ClassCatalog {
  const [catalog, setCatalog] = useState<ClassCatalog>({ groups: [], classes: [], loading: true, error: "" });

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetch(`${API}/groups`), fetch(`${API}/classes`)])
      .then(async ([groupsResponse, classesResponse]) => {
        if (!groupsResponse.ok || !classesResponse.ok) throw new Error("catalog request failed");
        const groups: GroupSummary[] = await groupsResponse.json();
        const classes: ClassSummary[] = await classesResponse.json();
        if (!cancelled) setCatalog({ groups, classes, loading: false, error: "" });
      })
      .catch((error: unknown) => {
        console.error("Error cargando grupos y clases", error);
        if (!cancelled) {
          setCatalog({ groups: [], classes: [], loading: false, error: "No pudimos cargar los grupos y las clases." });
        }
      });

    return () => { cancelled = true; };
  }, []);

  return catalog;
}
