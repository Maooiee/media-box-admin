export function createShift(raw) {
  return {
    id: raw.id,
    userId: raw.user_id,
    shiftDate: raw.shift_date,
    name: raw.name ?? 'Shift',
    kind: raw.kind ?? 'opening',
    startHour: raw.start_hour,
    endHour: raw.end_hour,
    isFlexible: raw.is_flexible ?? false,
    employeeName: raw.profiles?.full_name ?? 'Unknown',
    employeeId: raw.profiles?.employee_id ?? '',
  };
}

// Only two shift kinds for the mall
export const SHIFT_KINDS = [
  { key: 'opening', label: 'Opening', start: 9,  end: 18, color: 'amber', emoji: '🌅' },
  { key: 'closing', label: 'Closing', start: 13, end: 22, color: 'blue',  emoji: '🌆' },
];

export function kindStyle(kind) {
  switch (kind) {
    case 'opening': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'closing': return 'bg-blue-100 text-blue-800 border-blue-200';
    default:        return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

export function kindDot(kind) {
  switch (kind) {
    case 'opening': return 'bg-amber-500';
    case 'closing': return 'bg-blue-500';
    default:        return 'bg-gray-400';
  }
}

export function kindLabel(kind) {
  const found = SHIFT_KINDS.find((k) => k.key === kind);
  return found?.label ?? 'Shift';
}
