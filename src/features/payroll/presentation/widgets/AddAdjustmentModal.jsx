// admin-panel/src/features/payroll/presentation/widgets/AddAdjustmentModal.jsx
import { useEffect, useState } from 'react';
import { Plus, CheckCircle2, Clock3 } from 'lucide-react';
import Modal from '../../../../shared/components/Modal';
import Button from '../../../../shared/components/Button';
import DatePicker from '../../../../shared/components/DatePicker';
import { payrollRepository } from '../../data/payrollRepository';
import { toManilaDate } from '../../../../core/utils/formatters';

const today = () => toManilaDate();

const DURATION_KINDS = [
  { key: 'overtime', label: 'Overtime (+)', hint: 'Extra hours worked' },
  { key: 'undertime', label: 'Undertime (−)', hint: 'Hours not rendered' },
  { key: 'night_diff', label: 'Night diff', hint: '22:00–06:00 hours' },
  { key: 'rest_day', label: 'Rest day', hint: 'Hours on rest day' },
];

const AMOUNT_KINDS = [
  { key: 'allowance', label: 'Allowance', hint: 'Add to pay' },
  { key: 'bonus', label: 'Bonus', hint: 'One-time add-on' },
  { key: 'loan', label: 'Loan', hint: 'Deduction' },
  { key: 'cash_advance', label: 'Cash advance', hint: 'Deduction' },
  { key: 'other_deduction', label: 'Other deduction', hint: 'Deduction' },
];

const ALL_KINDS = [...DURATION_KINDS, ...AMOUNT_KINDS];
const AMOUNT_KIND_KEYS = new Set(AMOUNT_KINDS.map((k) => k.key));

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
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [approveNow, setApproveNow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setKind('overtime');
      setWorkDate(cutoff?.start ?? today());
      setHours('');
      setMinutes('');
      setAmount('');
      setReason('');
      setApproveNow(false);
      setBusy(false);
      setError('');
    }
  }, [open, cutoff]);

  if (!open) return null;

  const isAmountKind = AMOUNT_KIND_KEYS.has(kind);
  const totalMinutes =
    (parseInt(hours || '0', 10) || 0) * 60 +
    (parseInt(minutes || '0', 10) || 0);
  const amountValue = Number(amount) || 0;
  const valid = isAmountKind ? amountValue > 0 : totalMinutes > 0;

  async function handleSave() {
    setError('');
    if (!valid) {
      setError(
        isAmountKind
          ? 'Enter an amount greater than 0'
          : 'Enter a duration greater than 0'
      );
      return;
    }
    if (
      cutoff?.start &&
      cutoff?.end &&
      (workDate < cutoff.start || workDate > cutoff.end)
    ) {
      setError(`Date must be between ${cutoff.start} and ${cutoff.end}`);
      return;
    }

    setBusy(true);
    try {
      await payrollRepository.addAdjustment({
        userId,
        workDate,
        kind,
        minutes: isAmountKind ? 0 : totalMinutes,
        amount: isAmountKind ? amountValue : null,
        reason: reason.trim() || null,
        adminId,
        status: approveNow ? 'approved' : 'pending',
      });
      onToast?.(
        approveNow ? 'Adjustment added and approved' : 'Adjustment submitted for approval',
        'success'
      );
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title="Add payroll adjustment"
      subtitle={employeeName}
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-textLight">
            Type
          </label>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {ALL_KINDS.map((option) => {
              const active = kind === option.key;
              const deduction =
                option.key === 'undertime' ||
                (AMOUNT_KIND_KEYS.has(option.key) &&
                  ['loan', 'cash_advance', 'other_deduction'].includes(
                    option.key
                  ));
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setKind(option.key)}
                  className={`rounded-xl border px-2.5 py-2 text-left transition ${
                    active
                      ? deduction
                        ? 'border-red/40 bg-redLight/60 text-red'
                        : 'border-primary bg-primary text-white'
                      : 'border-border bg-bg text-textMedium hover:border-primary/40'
                  }`}
                >
                  <span className="block text-[11px] font-bold">
                    {option.label}
                  </span>
                  <span
                    className={`block text-[9px] ${
                      active && !deduction ? 'text-white/75' : 'text-textLight'
                    }`}
                  >
                    {option.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-textLight">
            Work date
          </label>
          <DatePicker
            value={workDate}
            onChange={setWorkDate}
            min={cutoff?.start}
            max={cutoff?.end}
            placeholder="Pick a work date"
          />
          <p className="mt-1.5 text-[10px] text-textLight">
            Must fall within {cutoff?.start} → {cutoff?.end}
          </p>
        </div>

        {isAmountKind ? (
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-textLight">
              Amount (₱)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="mt-1.5 text-[10px] text-textLight">
              Added to earnings for allowances/bonuses, or deducted for
              loans/cash advances/other deductions.
            </p>
          </div>
        ) : (
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-textLight">
              Duration
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                placeholder="0"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-20 rounded-xl border border-border bg-bg px-3 py-2.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="text-xs font-semibold text-textLight">hrs</span>
              <input
                type="number"
                min="0"
                max="59"
                placeholder="0"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-20 rounded-xl border border-border bg-bg px-3 py-2.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="text-xs font-semibold text-textLight">min</span>
              <span className="ml-auto text-xs font-bold text-primary">
                = {totalMinutes} min
              </span>
            </div>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-textLight">
            Reason (optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="e.g. Covered a colleague's shift"
            className="w-full resize-none rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <label className="flex items-start gap-2 rounded-xl border border-border bg-bg/40 px-3 py-2.5">
          <input
            type="checkbox"
            checked={approveNow}
            onChange={(e) => setApproveNow(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span className="text-xs text-textMedium">
            <span className="flex items-center gap-1 font-bold text-textDark">
              {approveNow ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}
              {approveNow ? 'Approve immediately' : 'Submit for approval'}
            </span>
            <span className="mt-0.5 block text-[10px] text-textLight">
              Pending adjustments are excluded from pay until approved.
            </span>
          </span>
        </label>

        {error && (
          <div className="rounded-xl border border-red/25 bg-redLight/60 px-3 py-2.5 text-xs text-red">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button icon={Plus} onClick={handleSave} disabled={busy || !valid}>
            {busy ? 'Saving…' : approveNow ? 'Add & approve' : 'Submit'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
