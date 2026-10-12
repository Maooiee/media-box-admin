import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalIcon, List } from 'lucide-react';
import { shiftsAdminRepository } from '../../../shifts/data/shiftsAdminRepository';
import { createShift, SHIFT_KINDS, kindDot } from '../../../shifts/domain/Shift';
import CalendarGrid from '../../../shifts/presentation/widgets/CalendarGrid';
import WeekView from '../../../shifts/presentation/widgets/WeekView';
import EditShiftModal from '../../../shifts/presentation/widgets/EditShiftModal';

const VIEWS = [
  { key: 'month', label: 'Month', icon: CalIcon },
  { key: 'week',  label: 'Week',  icon: List },
];

export default function EmployeeScheduleTab({ employee }) {
  const [view, setView] = useState('month');
  const [cursor, setCursor] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingShift, setEditingShift] = useState(null);

  useEffect(() => {
    if (employee?.id) loadShifts();
  }, [cursor, view, employee?.id]);

  function rangeForView() {
    if (view === 'month') {
      const y = cursor.getFullYear();
      const m = cursor.getMonth();
      return {
        from: new Date(y, m, 1).toISOString().slice(0, 10),
        to: new Date(y, m + 1, 0).toISOString().slice(0, 10),
      };
    }
    const weekStart = startOfWeek(cursor);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return {
      from: weekStart.toISOString().slice(0, 10),
      to: weekEnd.toISOString().slice(0, 10),
    };
  }

  function startOfWeek(d) {
    const s = new Date(d);
    s.setHours(0, 0, 0, 0);
    s.setDate(s.getDate() - s.getDay());
    return s;
  }

  async function loadShifts() {
    if (!employee?.id) return;
    setLoading(true);
    try {
      const { from, to } = rangeForView();
      const raw = await shiftsAdminRepository.fetchAll({
        from, to, userId: employee.id,
      });

      const enriched = raw.map((r) => ({
        ...r,
        profiles: {
          full_name: employee.full_name,
          employee_id: employee.employee_id,
        },
      }));

      setShifts(enriched.map(createShift));
    } catch (e) {
      console.error(e);
      setShifts([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAssign(date, kindConfig) {
    const dateStr = date.toISOString().slice(0, 10);
    try {
      await shiftsAdminRepository.upsertShift({
        userId: employee.id,
        shiftDate: dateStr,
        name: `${kindConfig.label} Shift`,
        kind: kindConfig.key,
        startHour: kindConfig.start,
        endHour: kindConfig.end,
        isFlexible: false,
      });
      loadShifts();
    } catch (e) {
      console.error(e);
      alert('Failed to save shift: ' + e.message);
    }
  }

  function prev() {
    if (view === 'month') {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
    } else {
      const d = new Date(cursor);
      d.setDate(d.getDate() - 7);
      setCursor(d);
    }
  }

  function next() {
    if (view === 'month') {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
    } else {
      const d = new Date(cursor);
      d.setDate(d.getDate() + 7);
      setCursor(d);
    }
  }

  function headerLabel() {
    if (view === 'month') {
      return cursor.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
    }
    const s = startOfWeek(cursor);
    const e = new Date(s);
    e.setDate(e.getDate() + 6);
    const fmt = (d) => d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
    return `${fmt(s)} – ${fmt(e)}`;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white rounded-2xl p-3 border border-border shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={prev}
            className="w-9 h-9 rounded-full hover:bg-bg flex items-center justify-center text-textDark transition"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-[160px] text-center font-bold text-textDark">
            {headerLabel()}
          </div>
          <button
            onClick={next}
            className="w-9 h-9 rounded-full hover:bg-bg flex items-center justify-center text-textDark transition"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="ml-2 px-3 py-1.5 rounded-full text-xs font-semibold border border-border hover:bg-bg transition"
          >
            Today
          </button>
        </div>

        <div className="inline-flex gap-1 bg-bg rounded-full p-1">
          {VIEWS.map((v) => {
            const Icon = v.icon;
            return (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                  view === v.key
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-textMedium hover:text-textDark'
                }`}
              >
                <Icon size={12} />
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-2">
        {SHIFT_KINDS.map((k) => (
          <div key={k.key} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${kindDot(k.key)}`} />
            <span className="text-xs font-semibold text-textMedium">
              {k.label} ({k.start}–{k.end})
            </span>
          </div>
        ))}
        <span className="text-[10px] text-textLight ml-auto">
          Tap or hold a day to assign
        </span>
      </div>

      {/* Calendar */}
      {loading ? (
        <div className="text-center py-20 text-textLight">Loading...</div>
      ) : view === 'month' ? (
        <CalendarGrid
          monthDate={cursor}
          shifts={shifts}
          onAssign={handleAssign}
          onOpenEditor={setEditingShift}
        />
      ) : (
        <WeekView
          weekStart={startOfWeek(cursor)}
          shifts={shifts}
          onAssign={handleAssign}
          onOpenEditor={setEditingShift}
        />
      )}

      <EditShiftModal
        open={!!editingShift}
        shift={editingShift}
        onClose={() => setEditingShift(null)}
        onSaved={loadShifts}
      />
    </div>
  );
}
