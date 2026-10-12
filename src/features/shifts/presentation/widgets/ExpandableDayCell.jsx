import { useEffect, useRef, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { SHIFT_KINDS, kindStyle, kindDot } from '../../domain/Shift';
import { initials } from '../../../../core/utils/formatters';

const HOLD_MS = 400;

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
}) {
  const [step, setStep] = useState('employee');
  const [pickedEmployee, setPickedEmployee] = useState(null);
  const [assigned, setAssigned] = useState(null);
  const timerRef = useRef(null);
  const longFiredRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setStep('employee');
      setPickedEmployee(null);
    }
  }, [isOpen]);

  function startHold() {
    if (isPast) return;
    longFiredRef.current = false;
    timerRef.current = setTimeout(() => {
      longFiredRef.current = true;
      onOpen?.();
    }, HOLD_MS);
  }

  function cancelHold() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handleCellClick() {
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

  // ─── CHIP CLICK ───
  function handleChipClick(e, shift) {
    e.preventDefault();
    e.stopPropagation();
    if (isPast) return;
    onOpenEditor?.(shift);
  }

  const dateNum = date.getDate();
  const hasShifts = dayShifts.length > 0;
  const locked = isPast;

  return (
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
      {/* ─── Normal cell ─── */}
      <div
        className={`relative min-h-[110px] p-1.5 select-none transition-all duration-300 ease-out ${
          locked ? 'cursor-not-allowed' : 'cursor-pointer'
        } ${isWeekend ? 'bg-primary-light/15' : isMuted ? 'bg-bg/30' : ''} ${
          isToday ? 'bg-primary-light/40' : ''
        } ${
          isOpen
            ? 'opacity-0 pointer-events-none'
            : locked
              ? ''
              : 'hover:bg-bg/70'
        }`}
      >
        {/* Day number + count */}
        <div className="flex items-center justify-between mb-1">
          <span
            className={`text-xs font-bold ${
              isToday
                ? 'bg-primary text-white rounded-full w-7 h-7 flex items-center justify-center shadow-lg shadow-primary/40 ring-2 ring-primary/30'
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

        {/* Chips */}
        <div className="space-y-0.5">
          {dayShifts.slice(0, 3).map((s) => {
            if (locked) {
              return (
                <div
                  key={s.id}
                  title={`${s.employeeName} · ${s.startHour}-${s.endHour}`}
                  className={`w-full flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-left text-[10px] font-semibold truncate opacity-60 ${kindStyle(
                    s.kind
                  )}`}
                >
                  <div
                    className={`w-3 h-3 rounded-full ${kindDot(
                      s.kind
                    )} text-white flex items-center justify-center text-[7px] font-bold shrink-0`}
                  >
                    {initials(s.employeeName ?? '?')}
                  </div>
                  <span className="truncate flex-1 min-w-0">
                    {s.employeeName?.split(' ')[0] ?? '?'}
                  </span>
                </div>
              );
            }

            return (
              <button
                key={s.id}
                type="button"
                onMouseDown={(e) => {
                  // Prevents the parent's long-press from firing
                  e.stopPropagation();
                }}
                onClick={(e) => handleChipClick(e, s)}
                title={`${s.employeeName} · ${s.startHour}-${s.endHour}`}
                className={`w-full flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-left text-[10px] font-semibold truncate transition-all duration-150 hover:scale-[1.05] hover:shadow-md hover:z-10 relative cursor-pointer ${kindStyle(
                  s.kind
                )}`}
              >
                <div
                  className={`w-3 h-3 rounded-full ${kindDot(
                    s.kind
                  )} text-white flex items-center justify-center text-[7px] font-bold shrink-0`}
                >
                  {initials(s.employeeName ?? '?')}
                </div>
                <span className="truncate flex-1 min-w-0">
                  {s.employeeName?.split(' ')[0] ?? '?'}
                </span>
              </button>
            );
          })}
          {dayShifts.length > 3 && (
            <div className="text-[9px] text-textLight text-center">
              +{dayShifts.length - 3} more
            </div>
          )}
        </div>

        {/* "+ Add" hint on empty cells */}
        {!hasShifts && !isMuted && !locked && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[10px] text-primary/50 font-bold tracking-wide">
              + Add
            </span>
          </div>
        )}

        {/* Past indicator */}
        {locked && !isMuted && (
          <div className="absolute bottom-1 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <span className="text-[9px] text-textLight font-bold tracking-wide">
              Past
            </span>
          </div>
        )}
      </div>

      {/* ─── Expanded overlay ─── */}
      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute inset-0 -m-2 p-3 rounded-2xl bg-white border-2 border-primary shadow-2xl origin-top-left animate-[spreadOpen_280ms_ease-out_forwards] overflow-y-auto"
          style={{ minWidth: 220, minHeight: 260 }}
        >
          <div className="flex items-center justify-between mb-3 animate-[fadeIn_200ms_ease-out_80ms_both]">
            {step === 'shift' && (
              <button
                onClick={() => {
                  setStep('employee');
                  setPickedEmployee(null);
                }}
                className="text-[10px] font-bold text-primary uppercase tracking-wider"
              >
                ← Back
              </button>
            )}
            <span className="text-sm font-bold text-textDark">
              {step === 'employee'
                ? `${dateNum} · Pick employee`
                : pickedEmployee?.full_name}
            </span>
            <button
              onClick={() => onClose?.()}
              className="text-[10px] font-bold text-textLight hover:text-textDark transition uppercase tracking-wider"
            >
              Close
            </button>
          </div>

          {step === 'employee' && (
            <div className="space-y-1.5">
              {employees.map((emp, i) => {
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
                    style={{ animationDelay: `${80 + i * 50}ms` }}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-xl border text-left transition animate-[chipSlide_280ms_ease-out_both] hover:scale-[1.02] ${
                      existing
                        ? 'bg-bg border-border'
                        : 'bg-white border-border hover:border-primary'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-primary-light flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                      {initials(emp.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-textDark truncate">
                        {emp.full_name}
                      </p>
                      {existing && (
                        <p
                          className={`text-[9px] font-bold ${
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
              {existingFor(pickedEmployee?.id) && (
                <p className="text-[10px] text-textLight text-center py-1">
                  Will replace current shift
                </p>
              )}
              {SHIFT_KINDS.map((k, i) => {
                const isAssigned = assigned === k.key;
                return (
                  <button
                    key={k.key}
                    onClick={(e) => handlePickKind(k, e)}
                    style={{ animationDelay: `${100 + i * 90}ms` }}
                    className={`w-full flex items-center gap-2 px-3 py-3 rounded-xl border text-left transition animate-[chipSlide_320ms_ease-out_both] hover:scale-[1.02] ${kindStyle(
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
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center animate-[popIn_200ms_ease-out]">
                        <Check size={12} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}