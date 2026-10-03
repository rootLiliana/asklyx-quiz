// Espejo de server/src/materials/material.types.ts
export type CodeLanguage = "python" | "sql" | "bash" | "text";

export type MaterialBlock =
  | { type: "text"; text: string }
  | { type: "code"; language: CodeLanguage; code: string }
  | { type: "link"; url: string; label: string };

export interface Material {
  id: string;
  lessonId: string;
  title: string;
  blocks: MaterialBlock[];
  sortOrder: number;
  publishedAt: string | null;
  createdBy: string;
  updatedAt: string | null;
}

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

// GET /classes/:classId/materials/views — quién abrió el material de la sesión.
export interface MaterialViewReport {
  students: { id: string; name: string; lastNamePaternal: string | null; nickname: string; groupId: string; groupName: string }[];
  views: { materialId: string; studentId: string; firstViewedAt: string | null; lastViewedAt: string | null; viewCount: number }[];
}
