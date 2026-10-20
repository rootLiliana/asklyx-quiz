// Datos inventados para la vista previa del Control Center. Ningún nombre es real.
import type { AttendanceStatus, ClassSummary, GroupAttendanceMatrix, GroupSummary, ModuleSummary, SavedQuizSummary } from "../types/Host";
import type { SessionResultDetail, SessionResultSummary, StudentHistory } from "../types/Results";
import type { PublicUser } from "../types/User";

export const DEMO_HOST: PublicUser = {
  id: "u-host",
  name: "Anna",
  lastNamePaternal: "Demo",
  lastNameMaternal: null,
  email: "anna@ejemplo.mx",
  nickname: "anna_host",
  role: "HOST",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

const CDD1 = "Tecnolochicas PRO - CDD1 2026";
const CDD2 = "Tecnolochicas PRO - CDD2 2026";

export const GROUPS: GroupSummary[] = [
  { id: "g1", name: CDD1 },
  { id: "g2", name: CDD2 },
];

export const MODULES: ModuleSummary[] = [
  { id: "m1", name: "Bases de datos SQL", orderNumber: 1 },
  { id: "m2", name: "Bases de datos NoSQL", orderNumber: 2 },
];

const SESSIONS: [string, string, string][] = [
  // [nombre, fecha CDD1, fecha CDD2]
  ["Sesión 2 · Agrupamientos", "2026-09-28", "2026-09-29"],
  ["SUM, AVG y COUNT", "2026-09-30", "2026-10-01"],
  ["Subconsultas", "2026-10-05", "2026-10-06"],
  ["JOINs", "2026-10-07", "2026-10-08"],
  ["Introducción a NoSQL", "2026-10-12", "2026-10-13"],
  ["Agregaciones en MongoDB", "2026-10-14", "2026-10-15"],
  ["Casos de uso", "2026-10-19", "2026-10-20"],
];

export const CLASSES: ClassSummary[] = SESSIONS.flatMap(([name, d1, d2], i) => [
  { id: `c1-${i}`, name, moduleId: i < 4 ? "m1" : "m2", groupId: "g1", description: null, classDate: d1, startTime: "16:00", endTime: "18:00", status: "ACTIVE", lessonId: `l${i}` },
  { id: `c2-${i}`, name, moduleId: i < 4 ? "m1" : "m2", groupId: "g2", description: null, classDate: d2, startTime: "16:00", endTime: "18:00", status: "ACTIVE", lessonId: `l${i}` },
]);

const QUIZ_DEFS: [string, number, number][] = [
  // [título, índice de sesión, preguntas]
  ["Agregaciones en Mongo", 5, 3],
  ["NoSQL: lo básico", 4, 4],
  ["JOINs: la revancha", 3, 4],
  ["Subconsultas", 2, 5],
  ["Funciones de agregación", 1, 6],
  ["Casos de uso", 6, 5],
];

export const QUIZZES: SavedQuizSummary[] = QUIZ_DEFS.map(([title, session, count], i) => {
  const classItem = CLASSES.find((c) => c.id === `c1-${session}`)!;
  return {
    id: `qz${i + 1}`,
    title,
    classId: classItem.id,
    className: classItem.name,
    classDate: classItem.classDate,
    groupId: "g1",
    groupName: CDD1,
    questionCount: count,
    hasResults: session < 6,
  };
});

const FIRST = ["Valeria", "Ximena", "Renata", "Camila", "Daniela", "Fernanda", "Regina", "Mariana", "Sofía", "Andrea", "Paola", "Natalia"];
const LAST = ["Torres", "Ramírez", "Flores", "Morales", "Cruz", "Ortiz", "Reyes", "Vargas", "Mendoza", "Castillo", "Ruiz", "Navarro"];
const NICK = ["vale_dev", "xime", "renata.py", "cam", "dani_sql", "fer", "regi", "mar", "sofi", "andy", "pao", "nati"];

export const STUDENTS = FIRST.map((name, i) => ({
  id: `s${i + 1}`,
  name,
  lastNamePaternal: LAST[i] ?? null,
  nickname: NICK[i] ?? null,
  groupId: i % 2 === 0 ? "g1" : "g2",
}));

// Generador pseudoaleatorio con semilla: los datos salen iguales cada vez.
function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

export function attendanceFor(groupId: string): GroupAttendanceMatrix {
  const rand = seeded(groupId === "g1" ? 7 : 11);
  const classes = CLASSES.filter((c) => c.groupId === groupId).map((c) => ({ id: c.id, name: c.name, classDate: c.classDate }));
  const students = STUDENTS.filter((s) => s.groupId === groupId);
  const records: GroupAttendanceMatrix["records"] = [];
  for (const c of classes.slice(0, -1)) {
    for (const s of students) {
      const r = rand();
      const status: AttendanceStatus | null = r < 0.72 ? "PRESENT" : r < 0.82 ? "LATE" : r < 0.88 ? "JUSTIFIED" : r < 0.95 ? "ABSENT" : null;
      if (status) records.push({ classId: c.id, studentId: s.id, status });
    }
  }
  return { classes, students: students.map(({ id, name, lastNamePaternal, nickname }) => ({ id, name, lastNamePaternal, nickname })), records };
}

const AVERAGES = [48, 54, 63, 71, 82, 91];

export function resultSessions(groupId: string | null): SessionResultSummary[] {
  const groups = groupId ? GROUPS.filter((g) => g.id === groupId) : GROUPS;
  return groups.flatMap((group, gi) =>
    QUIZZES.filter((q) => q.hasResults).map((quiz, i) => {
      const session = Number(quiz.classId.split("-")[1]);
      const classItem = CLASSES.find((c) => c.id === `c${gi + 1}-${session}`)!;
      return {
        sessionId: `${group.id}-${quiz.id}`,
        gameCode: `ANA-${1200 + i * 37 + gi}`,
        playedAt: `${classItem.classDate}T17:30:00.000Z`,
        quizId: quiz.id,
        quizTitle: quiz.title,
        classId: classItem.id,
        className: classItem.name,
        classDate: classItem.classDate,
        groupId: group.id,
        groupName: group.name,
        students: 5 + ((i + gi) % 2),
        averagePercentage: Math.max(30, Math.min(98, (AVERAGES[i] ?? 60) + (gi ? 4 : 0))),
      };
    }),
  );
}

export function resultDetail(sessionId: string): SessionResultDetail | null {
  const summary = resultSessions(null).find((s) => s.sessionId === sessionId);
  if (!summary) return null;
  const rand = seeded(sessionId.length * 13 + summary.averagePercentage);
  const total = QUIZZES.find((q) => q.id === summary.quizId)?.questionCount ?? 4;
  const students = STUDENTS.filter((s) => s.groupId === summary.groupId).map((s) => {
    const correct = Math.round(rand() * total);
    return {
      studentId: s.id,
      name: s.name,
      lastNamePaternal: s.lastNamePaternal,
      nickname: s.nickname,
      correctAnswers: correct,
      totalQuestions: total,
      percentage: Math.round((correct / total) * 100),
      score: correct * 1000 + Math.round(rand() * 900),
    };
  }).sort((a, b) => b.score - a.score);
  const questions = Array.from({ length: total }, (_, i) => {
    const answered = students.length;
    const correct = Math.round(rand() * answered);
    return { questionId: `p${i + 1}`, text: `Pregunta ${i + 1} de “${summary.quizTitle}”`, answered, correct, percentage: Math.round((correct / answered) * 100) };
  }).sort((a, b) => a.percentage - b.percentage);
  return { session: summary, students, questions };
}

export function studentHistory(studentId: string): StudentHistory {
  const student = STUDENTS.find((s) => s.id === studentId);
  const entries = resultSessions(student?.groupId ?? null).map((s, i) => {
    const total = QUIZZES.find((q) => q.id === s.quizId)?.questionCount ?? 4;
    const correct = (i * 3 + studentId.length) % (total + 1);
    return {
      sessionId: s.sessionId,
      playedAt: s.playedAt,
      quizTitle: s.quizTitle,
      className: s.className,
      classDate: s.classDate,
      correctAnswers: correct,
      totalQuestions: total,
      percentage: Math.round((correct / total) * 100),
    };
  });
  const average = entries.length ? Math.round(entries.reduce((sum, e) => sum + e.percentage, 0) / entries.length) : null;
  return { averagePercentage: average, entries };
}

export const USERS: PublicUser[] = [
  DEMO_HOST,
  { ...DEMO_HOST, id: "u-admin", name: "Lili", lastNamePaternal: "Admin", email: "admin@ejemplo.mx", nickname: "lili_admin", role: "ADMIN" },
  { ...DEMO_HOST, id: "u-host2", name: "Miriam", lastNamePaternal: "Host", email: "miriam@ejemplo.mx", nickname: "mir_host", role: "HOST" },
  ...STUDENTS.map((s) => ({
    ...DEMO_HOST,
    id: s.id,
    name: s.name,
    lastNamePaternal: s.lastNamePaternal,
    email: `${(s.nickname ?? s.name).replace(/[^a-z]/gi, "").toLowerCase()}@ejemplo.mx`,
    nickname: s.nickname,
    role: "STUDENT" as const,
  })),
];

export const MEMBERSHIPS = STUDENTS.map((s) => ({ userId: s.id, groupId: s.groupId }));
