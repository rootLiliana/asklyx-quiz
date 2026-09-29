import { formatClassDate } from "../../lib/classDates";
import { fieldClass, labelClass } from "../../lib/hostStyles";
import type { ClassSelection } from "../../hooks/useClassSelection";
import type { GroupSummary } from "../../types/Host";

interface ClassPickerProps {
  groups: GroupSummary[];
  selection: ClassSelection;
}

export default function ClassPicker({ groups, selection }: ClassPickerProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <label className={labelClass}>Grupo</label>
        <select value={selection.groupId} onChange={(e) => selection.setGroupId(e.target.value)} className={fieldClass}>
          {groups.length === 0 && <option value="" className="text-black">No hay grupos</option>}
          {groups.map((group) => (
            <option key={group.id} value={group.id} className="text-black">{group.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Clase</label>
        <select value={selection.classId} onChange={(e) => selection.setClassId(e.target.value)} className={fieldClass}>
          {selection.classesOfGroup.length === 0 && (
            <option value="" className="text-black">Este grupo no tiene clases</option>
          )}
          {selection.classesOfGroup.map((classItem) => (
            <option key={classItem.id} value={classItem.id} className="text-black">
              {formatClassDate(classItem.classDate)} — {classItem.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
