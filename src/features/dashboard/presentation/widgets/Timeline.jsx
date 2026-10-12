import { initials } from '../../../../core/utils/formatters';

const SHIFT_COLORS = {
  morning:   { bg: 'bg-amber-100',  text: 'text-amber-800',  dot: 'bg-amber-500' },
  afternoon: { bg: 'bg-blue-100',   text: 'text-blue-800',   dot: 'bg-blue-500' },
  evening:   { bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-500' },
  night:     { bg: 'bg-slate-200',  text: 'text-slate-800',  dot: 'bg-slate-600' },
  flexible:  { bg: 'bg-primary-light', text: 'text-primary', dot: 'bg-primary' },
};

export default function Timeline({ shifts }) {
  // Determine the hour range from shifts, default 8-22
  let minHour = 8, maxHour = 22;
  if (shifts.length > 0) {
    minHour = Math.min(...shifts.map((s) => s.start_hour));
    maxHour = Math.max(...shifts.map((s) => s.end_hour));
    minHour = Math.max(0, minHour - 1);
    maxHour = Math.min(23, maxHour + 1);
  }

  const hours = [];
  for (let h = minHour; h <= maxHour; h++) hours.push(h);

  function formatHour(h) {
    const suffix = h >= 12 ? 'PM' : 'AM';
    const display = h % 12 === 0 ? 12 : h % 12;
    return `${display} ${suffix}`;
  }

  return (
    <div className="relative">
      {hours.map((h) => {
        const shiftsAtHour = shifts.filter(
          (s) => s.start_hour <= h && h < s.end_hour
        );

        return (
          <div
            key={h}
            className="flex items-start gap-3 min-h-[52px] py-1 border-b border-border/50 last:border-b-0"
          >
            <div className="w-14 text-xs text-textLight font-semibold pt-2 shrink-0">
              {formatHour(h)}
            </div>
            <div className="flex-1 flex flex-wrap gap-2 pt-1">
              {shiftsAtHour.map((s) => {
                const cfg = SHIFT_COLORS[s.kind] ?? SHIFT_COLORS.morning;
                const isStart = s.start_hour === h;
                return (
                  <div
                    key={s.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${cfg.bg} ${cfg.text} text-xs font-semibold transition hover:scale-[1.02]`}
                    title={`${s.profiles?.full_name ?? 'Unknown'} · ${s.name} · ${s.start_hour}:00 - ${s.end_hour}:00`}
                  >
                    <div className={`w-5 h-5 rounded-full ${cfg.dot} text-white flex items-center justify-center text-[10px] font-bold shrink-0`}>
                      {initials(s.profiles?.full_name ?? 'U')}
                    </div>
                    <span className="truncate max-w-[140px]">
                      {s.profiles?.full_name ?? 'Unknown'}
                    </span>
                    {isStart && (
                      <span className="opacity-70 text-[10px]">
                        {s.start_hour}-{s.end_hour}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {shifts.length === 0 && (
        <div className="text-center py-12 text-textLight text-sm">
          No shifts scheduled for today
        </div>
      )}
    </div>
  );
}
