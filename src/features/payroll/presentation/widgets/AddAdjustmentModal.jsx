// admin-panel/src/features/payroll/presentation/widgets/AddAdjustmentModal.jsx
import { useEffect, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { payrollRepository } from '../../data/payrollRepository';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function AddAdjustmentModal({
  open,
  onClose,
  userId,
  employeeName,
  cutoff,
  adminId,
  onSaved,
  onToast,
}) {
  const [kind, setKind] = useState('overtime');
  const [workDate, setWorkDate] = useState(today());
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setKind('overtime');
      setWorkDate(cutoff?.start ?? today());
      setHours('');
      setMinutes('');
      setReason('');
      setBusy(false);
    }
  }, [open, cutoff]);

  if (!open) return null;

  const totalMinutes =
    (parseInt(hours || '0', 10) || 0) * 60 +
    (parseInt(minutes || '0', 10) || 0);

  async function handleSave() {
    if (totalMinutes <= 0) {
      onToast?.('Enter a duration greater than 0', 'error');
      return;
    }
    if (workDate < cutoff.start || workDate > cutoff.end) {
      onToast?.(
        `Date must be between ${cutoff.start} and ${cutoff.end}`,
        'error'
      );
      return;
    }

    setBusy(true);
    try {
      await payrollRepository.addAdjustment({
        userId,
        workDate,
        kind,
        minutes: totalMinutes,
        reason: reason.trim() || null,
        adminId,
      });
      onToast?.('Adjustment added', 'success');
      onSaved?.();
      onClose();
    } catch (e) {
      onToast?.(e.message || 'Failed to save', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Plus size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-textDark">
                Add Adjustment
              </h3>
              <p className="text-xs text-textLight mt-0.5">
                {employeeName}
              </p>
            </div>
          </div>
          <button
            onClick={() => !busy && onClose()}
            disabled={busy}
            className="w-8 h-8 rounded-full hover:bg-bg flex items-center justify-center text-textLight hover:text-textDark transition disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-textLight mb-1.5">
              Type
            </label>
            <div className="flex gap-2">
              {[
                { k: 'overtime', label: 'Overtime (+)' },
                { k: 'undertime', label: 'Undertime (−)' },
              ].map((o) => (
                <button
                  key={o.k}
                  onClick={() => setKind(o.k)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition border ${
                    kind === o.k
                      ? 'bg-primary text-white border-primary'
                      : 'bg-bg text-textMedium border-border hover:border-primary/40'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-textLight mb-1.5">
              Work date
            </label>
            <input
              type="date"
              value={workDate}
              min={cutoff?.start}
              max={cutoff?.end}
              onChange={(e) => setWorkDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-textLight mb-1.5">
              Duration
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                placeholder="0"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-20 px-3 py-2.5 rounded-xl border border-border bg-bg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="text-xs text-textLight font-semibold">hrs</span>
              <input
                type="number"
                min="0"
                max="59"
                placeholder="0"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-20 px-3 py-2.5 rounded-xl border border-border bg-bg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="text-xs text-textLight font-semibold">min</span>
              <span className="ml-auto text-xs font-bold text-primary">
                = {totalMinutes} min
              </span>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-textLight mb-1.5">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. Covered a colleague's shift"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-bg/40">
          <button
            onClick={() => !busy && onClose()}
            disabled={busy}
            className="px-4 py-2.5 rounded-full text-sm font-semibold text-textMedium hover:bg-bg transition disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={busy || totalMinutes <= 0}
            className="px-5 py-2.5 rounded-full text-sm font-semibold bg-primary text-white hover:bg-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}