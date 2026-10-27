// admin-panel/src/features/shifts/presentation/widgets/WeekView.jsx
import { useState } from 'react';
import ExpandableDayCell from './ExpandableDayCell';

const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function WeekView({
  weekStart,
  shifts,
  employees,
  onAssignToEmployee,
  onOpenEditor,
}) {
  const [openDateKey, setOpenDateKey] = useState(null);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function shiftsForDate(date) {
    const key = dateKey(date);
    return shifts.filter((s) => s.shiftDate === key);
  }

  return (
    <div className="surface-card">
      {/* Weekday header row */}
      <div className="grid grid-cols-7 bg-bg border-b border-border rounded-t-2xl">
        {WEEKDAY_LABELS.map((d, i) => {
          const isWeekend = i === 0 || i === 6;
          return (
            <div
              key={d}
              className={`py-3 text-center text-[10px] font-bold tracking-wider ${
                isWeekend
                  ? 'text-primary/70 bg-primary-light/20'
                  : 'text-textLight'
              }`}
            >
              {d}
            </div>
          );
        })}
      </div>

      {/* Week row — same ExpandableDayCell as month view */}
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const dayShifts = shiftsForDate(d);
          const isToday = d.getTime() === today.getTime();
          const key = dateKey(d);
          const isPast = d.getTime() < today.getTime();

          return (
            <ExpandableDayCell
              key={i}
              date={d}
              dayShifts={dayShifts}
              isToday={isToday}
              isMuted={false}
              isPast={isPast}
              isWeekend={d.getDay() === 0 || d.getDay() === 6}
              isOpen={openDateKey === key}
              onOpen={() => setOpenDateKey(key)}
              onClose={() => setOpenDateKey(null)}
              employees={employees}
              onAssignToEmployee={onAssignToEmployee}
              onOpenEditor={onOpenEditor}
              zIndex={30 + i}
            />
          );
        })}
      </div>
    </div>
  );
}