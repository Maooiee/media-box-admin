import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Lock } from 'lucide-react';
import { SHIFT_KINDS, kindStyle, kindDot } from '../../domain/Shift';
import { initials } from '../../../../core/utils/formatters';

const HOLD_MS = 400;
const MOVE_THRESHOLD = 10;

// Inline style per shift kind — bypasses Tailwind so colors always render.
const pillColor = (kind) => {
  if (kind === 'opening') {
    return { backgroundColor: '#fde68a', color: '#78350f', borderColor: '#fcd34d' };
  }
  if (kind === 'closing') {
    return { backgroundColor: '#bfdbfe', color: '#1e3a8a', borderColor: '#93c5fd' };
  }
  return { backgroundColor: '#e2e8f0', color: '#1e293b', borderColor: '#cbd5e1' };
};

export default function ExpandableDayCell({
  date,
  dayShifts,
  isToday,
  isMuted,
  isPast,
  isWeekend,
  isOpen,
  onOpen,
  onClose,
  employees,
  onAssignToEmployee,
  onOpenEditor,
  zIndex,
  disabled = false,
}) {
  const [step, setStep] = useState('employee');
  const [pickedEmployee, setPickedEmployee] = useState(null);
  const [assigned, setAssigned] = useState(null);
  const timerRef = useRef(null);
  const longFiredRef = useRef(false);
  const moveCleanupRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (moveCleanupRef.current) moveCleanupRef.current();
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setStep('employee');
      setPickedEmployee(null);
    }
  }, [isOpen]);

  function cancelHold() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (moveCleanupRef.current) {
      moveCleanupRef.current();
      moveCleanupRef.current = null;
    }
  }

  function startHold(e) {
    if (disabled) return;
    if (isPast) return;
    if (isOpen) return;

    longFiredRef.current = false;

    const point = e?.touches?.[0] ?? e;
    const startX = point?.clientX ?? 0;
    const startY = point?.clientY ?? 0;

    function onMove(ev) {
      const p = ev?.touches?.[0] ?? ev;
      const x = p?.clientX ?? 0;
      const y = p?.clientY ?? 0;
      if (
        Math.abs(x - startX) > MOVE_THRESHOLD ||
        Math.abs(y - startY) > MOVE_THRESHOLD
      ) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      }
    }

    function cleanup() {
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mousemove', onMove);
    }
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mousemove', onMove);
    moveCleanupRef.current = cleanup;

    timerRef.current = setTimeout(() => {
      longFiredRef.current = true;
      onOpen?.();
    }, HOLD_MS);
  }

  function handleCellClick() {
    if (disabled) return;
    if (isPast) return;
    cancelHold();
    if (longFiredRef.current) {
      longFiredRef.current = false;
      return;
    }
    if (isOpen) onClose?.();
    else onOpen?.();
  }

  function handleContextMenu(e) {
    e.preventDefault();
    if (disabled) return;
    if (isPast) return;
    cancelHold();
    onOpen?.();
  }

  function existingFor(employeeId) {
    return dayShifts.find((s) => s.userId === employeeId);
  }

  function handlePickKind(kindConfig, e) {
    e.stopPropagation();
    setAssigned(kindConfig.key);
    setTimeout(() => {
      onAssignToEmployee(pickedEmployee.id, kindConfig, date);
      onClose?.();
      setAssigned(null);
    }, 500);
  }

  function handleChipClick(e, shift) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (isPast) return;
    onOpenEditor?.(shift);
  }

  if (!date) return null;

  const dateNum = date.getDate();
  const hasShifts = dayShifts.length > 0;
  const locked = isPast;

  const overlay = isOpen
    ? createPortal(
        <>
          <div
            className="fixed inset-0 bg-black/30 z-[9998]"
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            onTouchStart={(e) => e.stopPropagation()}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="
              fixed z-[9999]
              left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
              w-[min(340px,calc(100vw-2rem))]
              max-h-[min(80vh,520px)]
              p-4
              rounded-2xl bg-white border-2 border-primary shadow-2xl
              overflow-y-auto
            "
          >
            <div className="flex items-center justify-between mb-3">
              {step === 'shift' ? (
                <button
                  onClick={() => {
                    setStep('employee');
                    setPickedEmployee(null);
                  }}
                  className="text-[10px] font-bold text-primary uppercase tracking-wider"
                >
                  ← Back
                </button>
              ) : (
                <span className="text-[10px] font-bold text-textLight uppercase tracking-wider">
                  Pick employee
                </span>
              )}
              <button
                onClick={() => onClose?.()}
                className="text-[10px] font-bold text-textLight hover:text-textDark transition uppercase tracking-wider"
              >
                Close
              </button>
            </div>

            {step === 'employee' && (
              <div className="space-y-1.5">
                <p className="text-sm font-bold text-textDark mb-2">
                  {dateNum} · Pick employee
                </p>
                {employees.map((emp) => {
                  const existing = existingFor(emp.id);
                  const cfg = existing
                    ? SHIFT_KINDS.find((k) => k.key === existing.kind)
                    : null;

                  return (
                    <button
                      key={emp.id}
                      onClick={() => {
                        setPickedEmployee(emp);
                        setStep('shift');
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition hover:scale-[1.02] ${
                        existing
                          ? 'bg-bg border-border'
                          : 'bg-white border-border hover:border-primary'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-primary text-[11px] font-bold shrink-0">
                        {initials(emp.full_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-textDark truncate">
                          {emp.full_name}
                        </p>
                        {existing && (
                          <p
                            className={`text-[10px] font-bold ${
                              cfg?.key === 'opening'
                                ? 'text-amber-700'
                                : 'text-blue-700'
                            }`}
                          >
                            {cfg?.label} ✓
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {step === 'shift' && (
              <div className="space-y-2">
                <p className="text-sm font-bold text-textDark mb-2">
                  {pickedEmployee?.full_name}
                </p>
                {existingFor(pickedEmployee?.id) && (
                  <p className="text-[10px] text-textLight text-center py-1">
                    Will replace current shift
                  </p>
                )}
                {SHIFT_KINDS.map((k) => {
                  const isAssigned = assigned === k.key;
                  return (
                    <button
                      key={k.key}
                      onClick={(e) => handlePickKind(k, e)}
                      className={`w-full flex items-center gap-2 px-3 py-3 rounded-xl border text-left transition hover:scale-[1.02] ${kindStyle(
                        k.key
                      )} ${isAssigned ? 'ring-2 ring-green-500 scale-[1.02]' : ''}`}
                    >
                      <span className="text-lg">{k.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs">{k.label}</p>
                        <p className="text-[9px] opacity-75 mt-0.5">
                          {k.start}:00 – {k.end}:00
                        </p>
                      </div>
                      {isAssigned && (
                        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                          <Check size={12} className="text-white" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>,
        document.body
      )
    : null;

  return (
    <>
      <div
        className="relative group border-r border-b border-border"
        style={{ zIndex: isOpen ? zIndex ?? 30 : 1 }}
        onMouseDown={startHold}
        onMouseUp={cancelHold}
        onMouseLeave={cancelHold}
        onTouchStart={startHold}
        onTouchEnd={cancelHold}
        onTouchCancel={cancelHold}
        onClick={handleCellClick}
        onContextMenu={handleContextMenu}
      >
        <div
          className={`relative min-h-[64px] md:min-h-[110px] p-1 md:p-1.5 select-none transition-all duration-300 ease-out ${
            locked ? 'cursor-not-allowed' : 'cursor-pointer'
          } ${isWeekend ? 'bg-primary-light/15' : isMuted ? 'bg-bg/30' : ''} ${
            isToday ? 'bg-primary-light/40' : ''
          } ${
            isOpen
              ? 'ring-2 ring-primary ring-inset'
              : locked
                ? ''
                : 'hover:bg-bg/70'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span
              className={`text-xs font-bold ${
                isToday
                  ? 'bg-primary text-white rounded-full w-5 h-5 md:w-7 md:h-7 flex items-center justify-center shadow-lg shadow-primary/40 ring-2 ring-primary/30 text-[10px] md:text-xs'
                  : isMuted
                    ? 'text-textFaint'
                    : locked
                      ? 'text-textLight'
                      : 'text-textDark'
              }`}
            >
              {dateNum}
            </span>
            <div className="flex items-center gap-1">
              {locked && (
                <Lock size={10} className="text-textLight" strokeWidth={2.5} />
              )}
              {hasShifts && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary-light text-primary min-w-[18px] text-center">
                  {dayShifts.length}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-0.5">
            {dayShifts.slice(0, 3).map((s) => {
              const chipStyle = pillColor(s.kind);

              if (locked) {
                return (
                  <div
                    key={s.id}
                    title={`${s.employeeName} · ${s.startHour}-${s.endHour}`}
                    className="w-full px-1.5 py-0.5 md:py-[3px] rounded-md border border-solid text-left text-[9px] md:text-[10px] font-bold truncate opacity-60"
                    style={chipStyle}
                  >
                    {initials(s.employeeName ?? '?')}
                  </div>
                );
              }

              return (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => handleChipClick(e, s)}
                  title={`${s.employeeName} · ${s.startHour}-${s.endHour}`}
                  className="w-full px-1.5 py-0.5 md:py-[3px] rounded-md border border-solid text-left text-[9px] md:text-[10px] font-bold truncate transition-all duration-150 hover:scale-[1.03] hover:shadow-md hover:z-10 relative cursor-pointer"
                  style={chipStyle}
                >
                  {initials(s.employeeName ?? '?')}
                </button>
              );
            })}
            {dayShifts.length > 3 && (
              <div className="text-[8px] md:text-[9px] text-textLight text-center">
                +{dayShifts.length - 3} more
              </div>
            )}
          </div>

          {!hasShifts && !isMuted && !locked && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[10px] text-primary/50 font-bold tracking-wide">
                + Add
              </span>
            </div>
          )}

          {locked && !isMuted && (
            <div className="absolute bottom-1 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <span className="text-[9px] text-textLight font-bold tracking-wide">
                Past
              </span>
            </div>
          )}
        </div>
      </div>

      {overlay}
    </>
  );
}