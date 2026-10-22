import { memo, useEffect, useMemo, useRef, useState } from 'react';
import ExpandableDayCell from './ExpandableDayCell';
import { SHIFT_KINDS, kindDot } from '../../domain/Shift';
import { X, Check } from 'lucide-react';

const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function sameDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayBetween(candidate, start, end) {
  if (!start || !end) return false;
  const t = candidate.getTime();
  const s = start.getTime();
  const e = end.getTime();
  return t >= Math.min(s, e) && t <= Math.max(s, e);
}

const DragCell = memo(function DragCell({
  cell,
  dayShifts,
  isToday,
  isPast, // <-- We receive isPast
  isWeekend,
  isOpen,
  inDragRange,
  isDragStart,
  isDragEnd,
  dragging,
  zIndex,
  onOpen,
  onClose,
  onBeginDrag,
  onExtendDrag,
  onEndDrag,
  employees,
  onAssignToEmployee,
  onOpenEditor,
}) {
  if (!cell || !cell.date) return null;

  const handleTouchStart = () => {
    if (cell.muted || isPast) return; // <-- Block touch drag on past
    onBeginDrag(cell.date, cell.muted);
  };

  const handleTouchMove = (e) => {
    if (cell.muted || isPast) return;
    const touch = e.touches[0];
    if (!touch) return;
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const cellEl = el?.closest('[data-date]');
    if (!cellEl) return;
    const dateStr = cellEl.getAttribute('data-date');
    if (!dateStr) return;
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return;
    onExtendDrag(new Date(y, m - 1, d), false);
  };

  const handleTouchEnd = () => {
    onEndDrag?.();
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    if (cell.muted || isPast) return; // <-- Block mouse drag on past
    onBeginDrag(cell.date, cell.muted);
  };

  return (
    <div
      data-date={`${cell.date.getFullYear()}-${String(cell.date.getMonth() + 1).padStart(2, '0')}-${String(cell.date.getDate()).padStart(2, '0')}`}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => onExtendDrag(cell.date, cell.muted)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`relative transition-colors duration-75 ${
        inDragRange ? 'bg-primary-light/50' : ''
      } ${
        isDragStart || isDragEnd
          ? 'ring-2 ring-primary/60 ring-inset z-20'
          : ''
      }`}
      style={{ touchAction: 'none' }}
    >
      <ExpandableDayCell
        date={cell.date}
        dayShifts={dayShifts}
        isToday={isToday}
        isMuted={cell.muted}
        isPast={isPast}
        isWeekend={isWeekend}
        isOpen={isOpen}
        onOpen={onOpen}
        onClose={onClose}
        employees={employees}
        onAssignToEmployee={onAssignToEmployee}
        onOpenEditor={onOpenEditor}
        zIndex={zIndex}
        disabled={dragging}
      />
    </div>
  );
});

export default function CalendarGrid({
  monthDate,
  shifts,
  employees,
  onAssignToEmployee,
  onBulkAssign,
  onOpenEditor,
}) {
  const [openDateKey, setOpenDateKey] = useState(null);
  const dragStartRef = useRef(null);
  const dragEndRef = useRef(null);
  const draggedRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [, forceRender] = useState(0);
  const [pending, setPending] = useState(null);

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const cells = useMemo(() => {
    const out = [];
    for (let i = startWeekday - 1; i >= 0; i--) {
      out.push({ date: new Date(year, month - 1, daysInPrev - i), muted: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ date: new Date(year, month, d), muted: false });
    }
    const remaining = (7 - (out.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      out.push({ date: new Date(year, month + 1, i), muted: true });
    }
    return out;
  }, [year, month, startWeekday, daysInMonth, daysInPrev]);

  const shiftsByDate = useMemo(() => {
    const map = new Map();
    for (const s of shifts) {
      if (!map.has(s.shiftDate)) map.set(s.shiftDate, []);
      map.get(s.shiftDate).push(s);
    }
    return map;
  }, [shifts]);

  useEffect(() => {
    if (!dragging) return;
    function onUp() {
      const start = dragStartRef.current;
      const end = dragEndRef.current;
      setDragging(false);
      if (start && end && !sameDay(start, end)) {
        setPending({ start, end });
      } else {
        dragStartRef.current = null;
        dragEndRef.current = null;
        draggedRef.current = false;
      }
    }
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    window.addEventListener('touchcancel', onUp);
    return () => {
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('touchcancel', onUp);
    };
  }, [dragging]);

  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return;
      setDragging(false);
      dragStartRef.current = null;
      dragEndRef.current = null;
      draggedRef.current = false;
      setPending(null);
      forceRender((v) => v + 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function handleBeginDrag(date, muted) {
    if (muted) return;
    if (!date || isNaN(date.getTime())) return;

    // Do not allow dragging or editing if the date is in the past
    if (date.getTime() < today.getTime()) return;

    dragStartRef.current = date;
    dragEndRef.current = date;
    draggedRef.current = false;
    setDragging(true);
    setOpenDateKey(null);
    forceRender((v) => v + 1);
  }

  function handleExtendDrag(date, muted) {
    if (!dragging || muted) return;
    if (!date || isNaN(date.getTime())) return;
    if (date.getTime() < today.getTime()) return; // Don't extend into the past
    const cur = dragEndRef.current;
    if (cur && sameDay(cur, date)) return;
    dragEndRef.current = date;
    draggedRef.current = true;
    forceRender((v) => v + 1);
  }

  function handleEndDrag() {
    const start = dragStartRef.current;
    const end = dragEndRef.current;
    setDragging(false);
    if (start && end && !sameDay(start, end)) {
      setPending({ start, end });
    } else {
      dragStartRef.current = null;
      dragEndRef.current = null;
      draggedRef.current = false;
    }
    forceRender((v) => v + 1);
  }

  function rangeDates(start, end) {
    const a = start.getTime() <= end.getTime() ? start : end;
    const b = start.getTime() <= end.getTime() ? end : start;
    const out = [];
    const cur = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const last = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    while (cur <= last) {
      out.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }

  async function handleConfirm({ employeeIds, kindKey, skipWeekends }) {
    const start = pending.start;
    const end = pending.end;
    const dates = rangeDates(start, end).filter((d) => {
      if (!skipWeekends) return true;
      const dow = d.getDay();
      return dow !== 0 && dow !== 6;
    });
    const kindConfig = SHIFT_KINDS.find((k) => k.key === kindKey);
    if (!kindConfig) return;
    const rows = [];
    for (const empId of employeeIds) {
      for (const d of dates) {
        rows.push({ userId: empId, kindConfig, date: d });
      }
    }
    if (typeof onBulkAssign === 'function') {
      await onBulkAssign(rows);
    } else if (typeof onAssignToEmployee === 'function') {
      for (const row of rows) {
        // eslint-disable-next-line no-await-in-loop
        await onAssignToEmployee(row.userId, row.kindConfig, row.date);
      }
    }
    setPending(null);
    dragStartRef.current = null;
    dragEndRef.current = null;
    draggedRef.current = false;
    forceRender((v) => v + 1);
  }

  return (
    <div
      className="bg-white rounded-2xl border border-border shadow-sm select-none"
      onMouseLeave={() => {
        if (dragging && dragStartRef.current && dragEndRef.current && draggedRef.current) {
          setPending({ start: dragStartRef.current, end: dragEndRef.current });
          setDragging(false);
        }
      }}
    >
      <div className="grid grid-cols-7 bg-bg border-b border-border rounded-t-2xl">
        {WEEKDAY_LABELS.map((d, i) => {
          const isWeekend = i === 0 || i === 6;
          return (
            <div
              key={d}
              className={`py-2 md:py-3 text-center text-[9px] md:text-[10px] font-bold tracking-wider ${
                isWeekend ? 'text-primary/70 bg-primary-light/20' : 'text-textLight'
              }`}
            >
              {d}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const key = dateKey(cell.date);
          const dayShifts = shiftsByDate.get(key) ?? [];
          const isToday = cell.date.getTime() === today.getTime();
          const isPast = cell.date.getTime() < today.getTime();

          const inDragRange =
            dragging &&
            dragStartRef.current &&
            dragEndRef.current &&
            dayBetween(cell.date, dragStartRef.current, dragEndRef.current);

          const isDragStart = dragging && sameDay(cell.date, dragStartRef.current);
          const isDragEnd = dragging && sameDay(cell.date, dragEndRef.current);

          return (
            <DragCell
              key={key}
              cell={cell}
              dayShifts={dayShifts}
              isToday={isToday}
              isPast={isPast}
              isWeekend={cell.date.getDay() === 0 || cell.date.getDay() === 6}
              isOpen={openDateKey === key}
              inDragRange={!!inDragRange}
              isDragStart={isDragStart}
              isDragEnd={isDragEnd}
              dragging={dragging}
              zIndex={30 + i}
              onOpen={() => {
                if (dragging || pending || isPast) return; // <-- Block past
                setOpenDateKey(key);
              }}
              onClose={() => setOpenDateKey(null)}
              onBeginDrag={handleBeginDrag}
              onExtendDrag={handleExtendDrag}
              onEndDrag={handleEndDrag}
              employees={employees}
              onAssignToEmployee={onAssignToEmployee}
              onOpenEditor={onOpenEditor}
            />
          );
        })}
      </div>

      {pending && (
        <BulkRangePopup
          start={pending.start}
          end={pending.end}
          employees={employees}
          onClose={() => {
            setPending(null);
            dragStartRef.current = null;
            dragEndRef.current = null;
            forceRender((v) => v + 1);
          }}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Bulk range popup
// ─────────────────────────────────────────────────────────────
function BulkRangePopup({ start, end, employees, onClose, onConfirm }) {
  const [kindKey, setKindKey] = useState(SHIFT_KINDS[0]?.key ?? 'opening');
  const [selectedEmployees, setSelectedEmployees] = useState(
    employees.length > 0 ? [employees[0].id] : []
  );
  const [skipWeekends, setSkipWeekends] = useState(true);
  const [busy, setBusy] = useState(false);

  const a = start.getTime() <= end.getTime() ? start : end;
  const b = start.getTime() <= end.getTime() ? end : start;

  const allDates = [];
  {
    const cur = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const last = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    while (cur <= last) {
      allDates.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
  }
  const effectiveDates = allDates.filter((d) => {
    if (!skipWeekends) return true;
    const dow = d.getDay();
    return dow !== 0 && dow !== 6;
  });

  const totalShifts = effectiveDates.length * selectedEmployees.length;

  function toggleEmployee(id) {
    setSelectedEmployees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const startLabel = a.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  const endLabel = b.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });

  async function handleConfirm() {
    if (selectedEmployees.length === 0 || effectiveDates.length === 0) return;
    setBusy(true);
    try {
      await onConfirm({ employeeIds: selectedEmployees, kindKey, skipWeekends });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[100]"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[calc(100vw-1.5rem)] max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl border border-border overflow-hidden max-h-[90vh] flex flex-col">
          <div className="relative px-5 pt-5 pb-4 bg-gradient-to-br from-primary-light/70 via-primary-light/30 to-transparent border-b border-primary/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold tracking-[0.18em] text-primary uppercase">
                    Media Box
                  </span>
                  <span className="w-1 h-1 rounded-full bg-textFaint" />
                  <span className="text-[10px] font-bold tracking-[0.18em] text-textLight uppercase">
                    Range assign
                  </span>
                </div>
                <h3 className="text-lg font-bold text-textDark tracking-tight">
                  {startLabel} → {endLabel}
                </h3>
                <p className="text-xs text-textMedium mt-0.5">
                  {effectiveDates.length} day{effectiveDates.length === 1 ? '' : 's'} selected
                  {skipWeekends && allDates.length !== effectiveDates.length
                    ? ` (${allDates.length - effectiveDates.length} weekend skipped)`
                    : ''}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/70 hover:bg-white border border-border flex items-center justify-center text-textMedium transition shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="p-5 space-y-4 overflow-y-auto">
            <div>
              <p className="text-[10px] font-bold tracking-[0.14em] text-textLight uppercase mb-2">
                Shift type
              </p>
              <div className="grid grid-cols-2 gap-2">
                {SHIFT_KINDS.map((k) => {
                  const selected = kindKey === k.key;
                  return (
                    <button
                      key={k.key}
                      onClick={() => setKindKey(k.key)}
                      className={`relative flex items-center gap-2 px-3 py-2.5 rounded-2xl border transition-all text-left ${
                        selected
                          ? 'bg-gradient-to-br from-primary-light/60 to-primary-light/20 border-primary/40 shadow-card'
                          : 'bg-white border-border hover:border-primary/30'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full shrink-0 ${kindDot(k.key)}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-textDark truncate">{k.label}</p>
                        <p className="text-[10px] text-textLight">
                          {k.start}:00–{k.end}:00
                        </p>
                      </div>
                      {selected && <Check size={14} className="text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold tracking-[0.14em] text-textLight uppercase">
                  Employees
                </p>
                {employees.length > 1 && (
                  <button
                    onClick={() => {
                      if (selectedEmployees.length === employees.length) {
                        setSelectedEmployees([]);
                      } else {
                        setSelectedEmployees(employees.map((e) => e.id));
                      }
                    }}
                    className="text-[11px] font-bold text-primary hover:underline"
                  >
                    {selectedEmployees.length === employees.length ? 'Clear' : 'All'}
                  </button>
                )}
              </div>
              <div className="rounded-2xl border border-border divide-y divide-border overflow-hidden max-h-40 overflow-y-auto">
                {employees.length === 0 ? (
                  <p className="text-xs text-textLight text-center py-4">No employees.</p>
                ) : (
                  employees.map((e) => {
                    const selected = selectedEmployees.includes(e.id);
                    return (
                      <label
                        key={e.id}
                        className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition ${
                          selected ? 'bg-primary-light/30' : 'hover:bg-bg'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleEmployee(e.id)}
                          className="w-4 h-4 rounded border-border accent-[#F26A1B]"
                        />
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-light to-primary/30 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                          {(e.full_name ?? '?')[0].toUpperCase()}
                        </div>
                        <p className="text-xs font-semibold text-textDark truncate flex-1">
                          {e.full_name}
                        </p>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-semibold text-textMedium cursor-pointer select-none">
              <input
                type="checkbox"
                checked={skipWeekends}
                onChange={(e) => setSkipWeekends(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-[#F26A1B]"
              />
              Skip weekends (Sat & Sun)
            </label>
          </div>

          <div className="border-t border-border bg-gradient-to-r from-white via-white to-primary-light/15 p-4 flex items-center justify-between gap-3">
            <span className="text-xs text-textMedium">
              {totalShifts > 0 ? (
                <>
                  <span className="font-bold text-textDark">{totalShifts}</span> shift
                  {totalShifts === 1 ? '' : 's'}
                </>
              ) : (
                <span className="text-textLight">Nothing to assign</span>
              )}
            </span>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={busy}
                className="px-4 py-2 rounded-full text-xs font-semibold border border-border bg-white text-textMedium hover:bg-bg transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={busy || totalShifts === 0}
                className="px-4 py-2 rounded-full text-xs font-semibold bg-gradient-to-br from-primary to-primary-dark text-white shadow-lg shadow-primary/30 hover:shadow-primary/50 disabled:opacity-50"
              >
                {busy ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}