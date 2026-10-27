import { useEffect, useMemo, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar as CalIcon, CalendarDays, List, Users, Lock, ChevronDown, Check, Search } from 'lucide-react';
import { shiftsAdminRepository } from '../data/shiftsAdminRepository';
import { createShift, SHIFT_KINDS, kindDot } from '../domain/Shift';
import { employeesRepository } from '../../employees/data/employeesRepository';
import CalendarGrid from './widgets/CalendarGrid';
import WeekView from './widgets/WeekView';
import EditShiftModal from './widgets/EditShiftModal';
import LeaveTab from '../../leave/presentation/LeaveTab';
import Toast from '../../../shared/components/Toast';
import PageHeader from '../../../shared/components/PageHeader';
import SegmentedTabs from '../../../shared/components/SegmentedTabs';
import { Skeleton } from '../../../shared/components/Skeleton';

const VIEWS = [
  { key: 'month', label: 'Month', icon: CalIcon },
  { key: 'week',  label: 'Week',  icon: List },
];

export default function ShiftsAdminPage() {
  // The tab is derived from the route so /leave is a real, linkable page.
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const topTab = pathname === '/leave' ? 'leave' : 'shifts';

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Section switcher — Shifts / Leave */}
      <div className="flex items-center justify-between gap-3">
        <SegmentedTabs
          value={topTab}
          onChange={(key) => navigate(key === 'leave' ? '/leave' : '/shifts')}
          items={[
            { key: 'shifts', label: 'Shifts', icon: CalIcon },
            { key: 'leave', label: 'Leave Requests', icon: CalendarDays },
          ]}
        />
      </div>

      {topTab === 'leave' ? <LeaveTab /> : <ShiftsContent />}
    </div>
  );
}

function ShiftsContent() {
  const [view, setView] = useState('month');
  const [cursor, setCursor] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingShift, setEditingShift] = useState(null);
  const [filterEmployeeId, setFilterEmployeeId] = useState('');
  const [toast, setToast] = useState(null);

  function showToast(message, type = 'error') {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 2800);
  }

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
      setEmployees([]);
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
      console.error('Error loading shifts:', e);
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
      showToast('Failed to save shift: ' + (e.message || 'unknown error'));
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
    <div className="space-y-3 md:space-y-4">
      {/* ─── Header ─── */}
      <PageHeader
        section="Schedule"
        title="Shifts"
        subtitle="Long-press any day to assign"
        icon={CalIcon}
      >
        <div className="flex flex-wrap gap-2 md:gap-2.5">
          <StatPill
            label="Total"
            value={totalShifts}
            className="border-border bg-white/90 text-textDark shadow-sm"
          />
          <StatPill
            label="Opening"
            value={openingCount}
            dot="bg-yellow"
            className="border-yellow/30 bg-gradient-to-br from-yellowLight/80 to-white text-yellow shadow-sm"
          />
          <StatPill
            label="Closing"
            value={closingCount}
            dot="bg-blue"
            className="border-blue/30 bg-gradient-to-br from-blueLight/80 to-white text-blue shadow-sm"
          />
        </div>
      </PageHeader>

      {/* Employee filter */}
      <div className="surface-toolbar relative z-20 flex flex-wrap items-center gap-2 p-2.5 md:gap-3 md:p-4">
        <Users size={15} className="shrink-0 text-primary" />
        <label className="shrink-0 text-[10px] font-bold tracking-wider text-textLight">
          FILTER
        </label>
        
        <EmployeePicker 
          employees={employees}
          value={filterEmployeeId}
          onChange={setFilterEmployeeId}
        />

        {filterEmployeeId && (
          <button
            onClick={() => setFilterEmployeeId('')}
            className="ml-2 shrink-0 text-[11px] font-semibold text-primary hover:underline md:text-xs"
          >
            Clear
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="surface-toolbar space-y-2 p-2.5 md:flex md:items-center md:justify-between md:gap-3 md:space-y-0 md:p-3">
        <div className="flex items-center gap-1.5 md:gap-2">
          <button
            onClick={prev}
            className="w-8 h-8 md:w-9 md:h-9 rounded-full hover:bg-bg flex items-center justify-center text-textDark transition"
          >
            <ChevronLeft size={16} className="md:hidden" />
            <ChevronLeft size={18} className="hidden md:block" />
          </button>
          <div className="flex-1 md:flex-none text-center md:min-w-[160px] font-bold text-sm md:text-base text-textDark truncate px-1">
            {headerLabel()}
          </div>
          <button
            onClick={next}
            className="w-8 h-8 md:w-9 md:h-9 rounded-full hover:bg-bg flex items-center justify-center text-textDark transition"
          >
            <ChevronRight size={16} className="md:hidden" />
            <ChevronRight size={18} className="hidden md:block" />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="px-2.5 md:px-3 py-1.5 rounded-full text-[11px] md:text-xs font-semibold border border-border hover:border-primary/40 hover:bg-primary-light/30 transition shrink-0"
          >
            Today
          </button>
        </div>

        <SegmentedTabs
          value={view}
          onChange={setView}
          items={VIEWS}
          className="self-center md:self-auto"
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 md:gap-4 px-1 md:px-2 flex-wrap">
        {SHIFT_KINDS.map((k) => (
          <div key={k.key} className="flex items-center gap-1.5 md:gap-2">
            <div className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-full ${kindDot(k.key)}`} />
            <span className="text-[10px] md:text-xs font-semibold text-textMedium">
              {k.label} ({k.start}–{k.end})
            </span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      {loading ? (
        <Skeleton className="h-[420px] w-full" rounded="rounded-2xl" />
      ) : (
        <>
          {isViewingPastMonth() && view === 'month' && (
            <div className="bg-gradient-to-br from-yellowLight to-yellowLight/60 border border-yellow/30 rounded-2xl px-4 md:px-5 py-3 flex items-start md:items-center gap-3">
              <Lock size={14} className="text-yellow shrink-0 mt-0.5 md:mt-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-bold text-yellow">
                  Viewing a past month
                </p>
                <p className="text-[11px] md:text-xs text-yellow/85 mt-0.5">
                  Past shifts are read-only. Click "Today" to return.
                </p>
              </div>
            </div>
          )}

          {view === 'month' ? (
            <CalendarGrid
              monthDate={cursor}
              shifts={visibleShifts}
              employees={visibleEmployees}
              onAssignToEmployee={handleAssignToEmployee}
              onOpenEditor={setEditingShift}
            />
          ) : (
            <WeekView
              weekStart={startOfWeek(cursor)}
              shifts={visibleShifts}
              employees={visibleEmployees}
              onAssignToEmployee={handleAssignToEmployee}
              onOpenEditor={setEditingShift}
            />
          )}
        </>
      )}

      <EditShiftModal
        open={!!editingShift}
        shift={editingShift}
        onClose={() => setEditingShift(null)}
        onSaved={loadShifts}
      />

      <Toast message={toast?.message} type={toast?.type} />
    </div>
  );
}

function toLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function StatPill({ label, value, dot, className }) {
  return (
    <div className={`rounded-xl md:rounded-2xl px-3 md:px-4 py-1.5 md:py-2.5 border flex items-center gap-1.5 md:gap-2 ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${dot}`} />}
      <span className="text-[10px] md:text-xs font-semibold opacity-80">{label}</span>
      <span className="text-sm md:text-lg font-bold leading-none">{value}</span>
    </div>
  );
}

// ─── Custom Employee Picker ───
function EmployeePicker({ employees, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const selected = employees.find((e) => e.id === value);

  const filtered = employees.filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.full_name?.toLowerCase().includes(q) ||
      e.employee_id?.toLowerCase().includes(q)
    );
  });

  return (
    <div ref={ref} className="relative w-full md:w-72">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition ${
          open
            ? 'border-primary ring-2 ring-primary/20 bg-white'
            : 'border-border bg-bg/50 hover:border-primary/40'
        }`}
      >
        <span className="text-textDark truncate flex-1 text-left">
          {selected ? selected.full_name : `All employees (${employees.length})`}
        </span>
        <ChevronDown size={16} className={`text-textLight transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white rounded-xl border border-border shadow-xl overflow-hidden animate-[slideUp_150ms_ease-out]">
          <div className="p-2 border-b border-border/50">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-bg">
              <Search size={14} className="text-textLight shrink-0" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or ID..."
                className="flex-1 bg-transparent outline-none text-xs text-textDark placeholder:text-textLight"
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto p-1 hide-scrollbar">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
                setSearch('');
              }}
              className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition ${
                !value ? 'bg-primary-light/60' : 'hover:bg-bg'
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-bg flex items-center justify-center shrink-0">
                <Users size={12} className="text-textLight" />
              </div>
              <span className="text-sm font-semibold text-textDark flex-1">All employees</span>
              {!value && <Check size={14} className="text-primary shrink-0" />}
            </button>

            {filtered.map((e) => {
              const isSelected = e.id === value;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    onChange(e.id);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition ${
                    isSelected ? 'bg-primary-light/60' : 'hover:bg-bg'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-light to-primary/30 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                    {e.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-textDark truncate">{e.full_name}</p>
                    <p className="text-[10px] text-textLight truncate">{e.employee_id}</p>
                  </div>
                  {isSelected && <Check size={14} className="text-primary shrink-0" />}
                </button>
              );
            })}

            {filtered.length === 0 && (
              <p className="text-xs text-textLight text-center py-4">No employees found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}