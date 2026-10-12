import { useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { SHIFT_KINDS, kindStyle } from '../../domain/Shift';

export default function QuickShiftPicker({
  open,
  date,
  employeeName,
  existingShift,
  onClose,
  onPick,
  onRemove,
  onEdit,
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const readable = date
    ? new Date(date).toLocaleDateString('en-PH', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden animate-[slideUp_200ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Header */}
        <div className="px-6 pt-4 pb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-wider text-textLight">
              {readable.toUpperCase()}
            </p>
            <h2 className="text-lg font-bold text-textDark mt-1">
              {employeeName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-bg flex items-center justify-center text-textLight hover:text-textDark transition shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Current shift (if any) */}
        {existingShift && (
          <div className="px-6 pb-4">
            <div className={`rounded-2xl border p-4 ${kindStyle(existingShift.kind)}`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold tracking-wider opacity-80">
                    CURRENT
                  </p>
                  <p className="text-sm font-bold mt-0.5">
                    {existingShift.name} · {existingShift.startHour}:00 – {existingShift.endHour}:00
                  </p>
                </div>
                <button
                  onClick={() => onRemove?.(existingShift)}
                  className="w-9 h-9 rounded-full bg-white/70 flex items-center justify-center hover:bg-white transition shrink-0"
                  title="Remove shift"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <button
                onClick={() => onEdit?.(existingShift)}
                className="mt-3 w-full text-xs font-bold uppercase tracking-wider py-2 rounded-xl bg-white/60 hover:bg-white transition"
              >
                Edit details
              </button>
            </div>
          </div>
        )}

        {/* Picker */}
        <div className="px-6 pb-6">
          <p className="text-xs font-bold tracking-wider text-textLight mb-3">
            {existingShift ? 'REPLACE WITH' : 'PICK A SHIFT'}
          </p>

          <div className="space-y-2">
            {SHIFT_KINDS.map((k) => (
              <button
                key={k.key}
                onClick={() => onPick?.(k)}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl border transition hover:scale-[1.01] ${kindStyle(k.key)}`}
              >
                <span className="text-2xl">{k.emoji}</span>
                <div className="flex-1 text-left">
                  <p className="font-bold">{k.label}</p>
                  <p className="text-xs opacity-75 mt-0.5">
                    {k.start}:00 AM – {k.end}:00 PM
                  </p>
                </div>
                <div className="text-xs font-bold opacity-50">Select →</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
