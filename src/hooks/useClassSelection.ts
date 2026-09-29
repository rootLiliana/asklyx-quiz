import { useState } from "react";
import { pickDefaultClass, toIsoDay } from "../lib/classDates";
import { getTodayGroupName } from "../lib/studentGroup";
import type { ClassSummary, GroupSummary } from "../types/Host";

export interface ClassSelection {
  groupId: string;
  classId: string;
  selectedClass: ClassSummary | null;
  classesOfGroup: ClassSummary[];
  setGroupId: (groupId: string) => void;
  setClassId: (classId: string) => void;
}

// Grupo -> clase. Mientras la host no elija nada, sugiere el grupo que toca
// hoy (regla de días) y, dentro de él, la clase de hoy (o la más cercana).
export function useClassSelection(groups: GroupSummary[], classes: ClassSummary[]): ClassSelection {
  const [groupChoice, setGroupChoice] = useState<string | null>(null);
  const [classChoice, setClassChoice] = useState<string | null>(null);

  const todayGroupName = getTodayGroupName();
  const groupId =
    groupChoice ??
    groups.find((group) => group.name === todayGroupName)?.id ??
    groups[0]?.id ??
    "";

  const classesOfGroup = classes
    .filter((classItem) => classItem.groupId === groupId)
    .sort((a, b) => (toIsoDay(b.classDate) ?? "").localeCompare(toIsoDay(a.classDate) ?? ""));

  const selectedClass =
    classesOfGroup.find((classItem) => classItem.id === classChoice) ??
    (classChoice === null ? pickDefaultClass(classesOfGroup) : null);

  return {
    groupId,
    classId: selectedClass?.id ?? "",
    selectedClass,
    classesOfGroup,
    setGroupId: (id) => { setGroupChoice(id); setClassChoice(null); },
    setClassId: (id) => setClassChoice(id),
  };
}
