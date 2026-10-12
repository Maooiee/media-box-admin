import { initials } from '../../../../core/utils/formatters';

const COLORS = {
  opening: { bg: 'bg-amber-100',  text: 'text-amber-800',  border: 'border-amber-200',  dot: 'bg-amber-500' },
  closing: { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-200',   dot: 'bg-blue-500' },
};

export default function ShiftChip({ shift, onClick, compact = false }) {
  const cfg = COLORS[shift.kind] ?? COLORS.opening;

  if (compact) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(shift);
        }}
       className={`w-full flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-left text-[10px] font-semibold transition-all duration-150 truncate hover:scale-[1.03] hover:shadow-sm hover:z-10 relative ${kindStyle(s.kind)}`}
      >
        <div className={`w-3 h-3 rounded-full ${cfg.dot} text-white flex items-center justify-center text-[7px] font-bold shrink-0`}>
          {initials(shift.employeeName)}
        </div>
        <span className="truncate">{shift.employeeName?.split(' ')[0] ?? '?'}</span>
      </button>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(shift);
      }}
      className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-lg border text-left text-[11px] font-semibold hover:opacity-90 transition ${cfg.bg} ${cfg.text} ${cfg.border}`}
      title={`${shift.employeeName} · ${shift.name} · ${shift.startHour}-${shift.endHour}`}
    >
      <div className={`w-4 h-4 rounded-full ${cfg.dot} text-white flex items-center justify-center text-[8px] font-bold shrink-0`}>
        {initials(shift.employeeName)}
      </div>
      <span className="truncate flex-1 min-w-0">
        {shift.employeeName ?? 'Unknown'}
      </span>
      <span className="text-[9px] opacity-70 shrink-0">
        {shift.startHour}-{shift.endHour}
      </span>
    </button>
  );
}
