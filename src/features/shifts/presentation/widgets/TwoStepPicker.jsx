import { useEffect, useState } from 'react';
import { X, ChevronLeft, Check, UserCircle } from 'lucide-react';
import { SHIFT_KINDS, kindStyle, kindDot } from '../../domain/Shift';
import { initials } from '../../../../core/utils/formatters';

export default function TwoStepPicker({
  open,
  date,
  employees,
  dayShifts,        // existing shifts for that day
  onClose,
  onAssign,         // (employeeId, kindConfig)
}) {
  const [step, setStep] = useState('employee'); // 'employee' | 'shift'
  const [pickedEmployee, setPickedEmployee] = useState(null);

  useEffect(() => {
    if (open) {
      setStep('employee');
      setPickedEmployee(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') {
        if (step === 'shift') setStep('employee');
        else onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, step, onClose]);

  if (!open) return null;

  const readable = date
    ? new Date(date).toLocaleDateString('en-PH', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : '';

  function existingFor(employeeId) {
    return dayShifts.find((s) => s.userId === employeeId);
  }

  function handlePickEmployee(employee) {
    setPickedEmployee(employee);
    setStep('shift');
  }

  function handlePickKind(kindConfig) {
    onAssign(pickedEmployee.id, kindConfig);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-lg bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col animate-[slideUp_200ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {step === 'shift' && (
              <button
                onClick={() => setStep('employee')}
                className="w-8 h-8 rounded-full hover:bg-bg flex items-center justify-center text-textDark transition shrink-0"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-bold tracking-wider text-textLight">
                {readable.toUpperCase()}
              </p>
              <h2 className="text-lg font-bold text-textDark mt-0.5 truncate">
                {step === 'employee'
                  ? 'Pick employee'
                  : pickedEmployee?.full_name ?? ''}
              </h2>
              {step === 'shift' && (
                <p className="text-xs text-textLight mt-0.5 truncate">
                  {pickedEmployee?.employee_id}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-bg flex items-center justify-center text-textLight hover:text-textDark transition shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-6 py-5 flex-1">
          {step === 'employee' && (
            <>
              {employees.length === 0 ? (
                <div className="text-center py-8 text-textLight text-sm">
                  No employees
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {employees.map((emp) => {
                    const existing = existingFor(emp.id);
                    const cfg = existing
                      ? SHIFT_KINDS.find((k) => k.key === existing.kind)
                      : null;

                    return (
                      <button
                        key={emp.id}
                        onClick={() => handlePickEmployee(emp)}
                        className={`relative flex items-center gap-3 p-3 rounded-2xl border transition text-left ${
                          existing
                            ? 'bg-bg border-border'
                            : 'bg-white border-border hover:border-primary hover:bg-primary-light/30'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-primary text-sm font-bold shrink-0">
                          {initials(emp.full_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-textDark truncate">
                            {emp.full_name}
                          </p>
                          {existing ? (
                            <p className={`text-[10px] font-bold mt-0.5 ${cfg?.key === 'opening' ? 'text-amber-700' : 'text-blue-700'}`}>
                              {cfg?.emoji} {cfg?.label} · {existing.startHour}-{existing.endHour}
                            </p>
                          ) : (
                            <p className="text-[10px] text-textLight mt-0.5">
                              {emp.employee_id}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {dayShifts.length > 0 && (
                <div className="mt-5 pt-4 border-t border-border">
                  <p className="text-[10px] font-bold tracking-wider text-textLight mb-3">
                    ALREADY SCHEDULED TODAY ({dayShifts.length})
                  </p>
                  <div className="space-y-1.5">
                    {dayShifts.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 text-xs text-textMedium bg-bg rounded-xl px-3 py-2"
                      >
                        <div className={`w-2 h-2 rounded-full ${kindDot(s.kind)}`} />
                        <span className="font-semibold text-textDark">
                          {s.employeeName}
                        </span>
                        <span className="ml-auto text-[10px]">
                          {s.startHour}-{s.endHour}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {step === 'shift' && (
            <div className="space-y-3">
              {existingFor(pickedEmployee?.id) && (
                <div className={`rounded-2xl border p-3 text-xs font-semibold ${
                  existingFor(pickedEmployee.id).kind === 'opening'
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-blue-50 border-blue-200 text-blue-800'
                }`}>
                  Currently assigned:{' '}
                  {SHIFT_KINDS.find(k => k.key === existingFor(pickedEmployee.id).kind)?.label} ·{' '}
                  {existingFor(pickedEmployee.id).startHour}-
                  {existingFor(pickedEmployee.id).endHour}
                  <p className="text-[10px] font-normal mt-1 opacity-75">
                    Picking a new shift will replace it.
                  </p>
                </div>
              )}

              {SHIFT_KINDS.map((k, i) => (
                <button
                  key={k.key}
                  onClick={() => handlePickKind(k)}
                  style={{ animationDelay: `${i * 80}ms` }}
                  className={`w-full flex items-center gap-4 px-5 py-5 rounded-2xl border transition hover:scale-[1.01] hover:shadow-md animate-[chipSlide_320ms_ease-out_both] ${kindStyle(k.key)}`}
                >
                  <span className="text-3xl">{k.emoji}</span>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-base">{k.label}</p>
                    <p className="text-xs opacity-75 mt-0.5">
                      {k.start}:00 AM – {k.end}:00 PM
                    </p>
                  </div>
                  <Check size={20} className="opacity-30" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
