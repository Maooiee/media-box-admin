// admin-panel/src/features/shifts/presentation/ShiftsAdminPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalIcon, List, Users, Lock } from 'lucide-react';
import { shiftsAdminRepository } from '../data/shiftsAdminRepository';
import { createShift, SHIFT_KINDS, kindDot } from '../domain/Shift';
import { employeesRepository } from '../../employees/data/employeesRepository';
import CalendarGrid from './widgets/CalendarGrid';
import WeekView from './widgets/WeekView';
import EditShiftModal from './widgets/EditShiftModal';
import LeaveTab from '../../leave/presentation/LeaveTab';

const VIEWS = [
  { key: 'month', label: 'Month', icon: CalIcon },
  { key: 'week',  label: 'Week',  icon: List },
];

export default function ShiftsAdminPage() {
  const [topTab, setTopTab] = useState('shifts'); // 'shifts' | 'leave'

  return (
    <div className="space-y-4 relative">
      {/* Big warm radial glow behind the header */}
      <div
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(242,106,27,0.22) 0%, rgba(242,106,27,0.08) 40%, rgba(242,106,27,0) 70%)',
        }}
      />

      <div className="relative space-y-4">
        {/* Top tab switcher — gradient pills */}
        <div className="flex gap-2">
          <button
            onClick={() => setTopTab('shifts')}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition ${
              topTab === 'shifts'
                ? 'bg-gradient-to-br from-primary to-primary-dark text-white shadow-lg shadow-primary/30'
                : 'bg-white text-textMedium border border-border hover:border-primary/40 hover:bg-primary-light/20'
            }`}
          >
            Shifts
          </button>
          <button
            onClick={() => setTopTab('leave')}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition ${
              topTab === 'leave'
                ? 'bg-gradient-to-br from-primary to-primary-dark text-white shadow-lg shadow-primary/30'
                : 'bg-white text-textMedium border border-border hover:border-primary/40 hover:bg-primary-light/20'
            }`}
          >
            Leave Requests
          </button>
        </div>

        {topTab === 'leave' ? <LeaveTab /> : <ShiftsContent />}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Shifts content
// ──────────────────────────────────────────────────────────
function ShiftsContent() {
  const [view, setView] = useState('month');
  const [cursor, setCursor] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingShift, setEditingShift] = useState(null);
  const [filterEmployeeId, setFilterEmployeeId] = useState('');

  useEffect(() => { loadEmployees(); }, []);
  useEffect(() => {
    if (employees.length > 0) loadShifts();
  }, [cursor, view, employees]);

  function rangeForView() {
    if (view === 'month') {
      const y = cursor.getFullYear();
      const m = cursor.getMonth();
      return {
        from: toLocalDateStr(new Date(y, m, 1)),
        to: toLocalDateStr(new Date(y, m + 1, 0)),
      };
    }
    const weekStart = startOfWeek(cursor);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return {
      from: toLocalDateStr(weekStart),
      to: toLocalDateStr(weekEnd),
    };
  }

  function startOfWeek(d) {
    const s = new Date(d);
    s.setHours(0, 0, 0, 0);
    s.setDate(s.getDate() - s.getDay());
    return s;
  }

  async function loadEmployees() {
    try {
      const emps = await employeesRepository.fetchAll();
      setEmployees(emps);
    } catch (e) {
      console.error(e);
    }
  }

  async function loadShifts() {
    setLoading(true);
    try {
      const { from, to } = rangeForView();
      const raw = await shiftsAdminRepository.fetchAll({ from, to });

      const empMap = Object.fromEntries(employees.map((e) => [e.id, e]));
      const enriched = raw.map((r) => ({
        ...r,
        profiles: empMap[r.user_id]
          ? { full_name: empMap[r.user_id].full_name, employee_id: empMap[r.user_id].employee_id }
          : null,
      }));

      setShifts(enriched.map(createShift));
    } catch (e) {
      console.error(e);
      setShifts([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAssignToEmployee(employeeId, kindConfig, date) {
    const dateStr = toLocalDateStr(date);
    try {
      await shiftsAdminRepository.upsertShift({
        userId: employeeId,
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

  function isViewingPastMonth() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstOfViewedMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    return firstOfViewedMonth.getTime() < firstOfCurrentMonth.getTime();
  }

  const visibleShifts = useMemo(() => {
    if (!filterEmployeeId) return shifts;
    return shifts.filter((s) => s.userId === filterEmployeeId);
  }, [shifts, filterEmployeeId]);

  const visibleEmployees = useMemo(() => {
    if (!filterEmployeeId) return employees;
    return employees.filter((e) => e.id === filterEmployeeId);
  }, [employees, filterEmployeeId]);

  const totalShifts = visibleShifts.length;
  const openingCount = visibleShifts.filter((s) => s.kind === 'opening').length;
  const closingCount = visibleShifts.filter((s) => s.kind === 'closing').length;

  return (
    <div className="space-y-4">
      {/* Header — gradient band */}
      <div className="rounded-3xl bg-gradient-to-br from-primary-light/70 via-primary-light/25 to-transparent p-6 border border-primary/10 shadow-card">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold tracking-[0.18em] text-primary uppercase">
                Media Box
              </span>
              <span className="w-1 h-1 rounded-full bg-textFaint" />
              <span className="text-[10px] font-bold tracking-[0.18em] text-textLight uppercase">
                Schedule
              </span>
            </div>
            <h2 className="text-3xl font-bold text-textDark tracking-tight">Shifts</h2>
            <p className="text-sm text-textMedium mt-1 flex items-center gap-2 flex-wrap">
              <span>Long-press any day to assign</span>
              <span className="w-1 h-1 rounded-full bg-textLight" />
              <span>Click a chip to edit</span>
            </p>
          </div>

          <div className="flex gap-2.5 flex-wrap">
            <StatPill
              label="Total"
              value={totalShifts}
              className="bg-white/90 border-border text-textDark"
            />
            <StatPill
              label="Opening"
              value={openingCount}
              dot="bg-yellow"
              className="bg-gradient-to-br from-yellowLight to-yellowLight/50 border-yellow/30 text-yellow"
            />
            <StatPill
              label="Closing"
              value={closingCount}
              dot="bg-blue"
              className="bg-gradient-to-br from-blueLight to-blueLight/50 border-blue/30 text-blue"
            />
          </div>
        </div>
      </div>

      {/* Employee filter — subtle gradient bar */}
      <div className="rounded-2xl p-4 border border-border shadow-card bg-gradient-to-r from-white via-white to-primary-light/20 flex items-center gap-3 flex-wrap">
        <Users size={16} className="text-primary shrink-0" />
        <label className="text-[10px] font-bold tracking-wider text-textLight">
          FILTER
        </label>
        <select
          value={filterEmployeeId}
          onChange={(e) => setFilterEmployeeId(e.target.value)}
          className="flex-1 md:max-w-xs px-4 py-2 rounded-xl border border-border bg-white font-semibold text-textDark text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition"
        >
          <option value="">All employees ({employees.length})</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.full_name} ({e.employee_id})
            </option>
          ))}
        </select>
        {filterEmployeeId && (
          <button
            onClick={() => setFilterEmployeeId('')}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="rounded-2xl p-3 border border-border shadow-card bg-gradient-to-r from-white via-white to-primary-light/15 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={prev}
            className="w-9 h-9 rounded-full hover:bg-primary-light/40 flex items-center justify-center text-textDark transition"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-[160px] text-center font-bold text-textDark">
            {headerLabel()}
          </div>
          <button
            onClick={next}
            className="w-9 h-9 rounded-full hover:bg-primary-light/40 flex items-center justify-center text-textDark transition"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="ml-2 px-3 py-1.5 rounded-full text-xs font-semibold border border-border hover:border-primary/40 hover:bg-primary-light/30 transition"
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
                    ? 'bg-gradient-to-br from-primary to-primary-dark text-white shadow-md shadow-primary/30'
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
      </div>

      {/* Calendar */}
      {loading ? (
        <div className="text-center py-20 text-textLight">Loading...</div>
      ) : view === 'month' ? (
        <>
          {isViewingPastMonth() && (
            <div className="bg-gradient-to-br from-yellowLight to-yellowLight/60 border border-yellow/30 rounded-2xl px-5 py-3 flex items-center gap-3">
              <Lock size={16} className="text-yellow shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-yellow">
                  Viewing a past month
                </p>
                <p className="text-xs text-yellow/85 mt-0.5">
                  Past shifts are read-only. Click "Today" to return to the current month.
                </p>
              </div>
            </div>
          )}
          <CalendarGrid
            monthDate={cursor}
            shifts={visibleShifts}
            employees={visibleEmployees}
            onAssignToEmployee={handleAssignToEmployee}
            onOpenEditor={setEditingShift}
          />
        </>
      ) : (
        <WeekView
          weekStart={startOfWeek(cursor)}
          weekEnd={new Date(startOfWeek(cursor).getTime() + 6 * 86400000)}
          shifts={visibleShifts}
          employees={visibleEmployees}
          onAssignToEmployee={handleAssignToEmployee}
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

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────
function toLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function StatPill({ label, value, dot, className }) {
  return (
    <div
      className={`rounded-2xl px-4 py-2.5 border shadow-card flex items-center gap-2 ${className}`}
    >
      {dot && <span className={`w-2 h-2 rounded-full ${dot}`} />}
      <span className="text-xs font-semibold opacity-80">{label}</span>
      <span className="text-lg font-bold leading-none">{value}</span>
    </div>
  );
}