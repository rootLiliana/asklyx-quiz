export const CODE_LANGUAGES = ["python", "sql", "bash", "text"] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];

// Bloques del material, en orden.
export type MaterialBlock =
  // Formato básico: # título, ## subtítulo, **negritas**, *cursiva*, `código`,
  // listas con "- " o "1. ".
  | { type: "text"; text: string }
  | { type: "code"; language: CodeLanguage; code: string }
  | { type: "link"; url: string; label: string };

// El material es de la sesión (lesson): lo ven todos los grupos que la tienen.
export interface Material {
  id: string;
  lessonId: string;
  title: string;
  blocks: MaterialBlock[];
  sortOrder: number;
  // null = borrador. Una fecha (puede ser futura) = visible desde entonces.
  publishedAt: string | null;
  createdBy: string;
  updatedAt: string | null;
}

export interface MaterialFields {
  title: string;
  blocks: MaterialBlock[];
  publishedAt: Date | null;
}

// Vista de la alumna: sus clases y el material ya publicado de cada una.
export interface StudentClassMaterials {
  id: string;
  lessonId: string | null;
  name: string;
  classDate: string | null;
  startTime: string | null;
  endTime: string | null;
  groupName: string;
  materials: { id: string; title: string; publishedAt: string | null }[];
}
