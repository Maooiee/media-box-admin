// admin-panel/src/features/payroll/presentation/widgets/FinalizeRunModal.jsx
import { useEffect, useMemo, useState } from 'react';
import { Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Modal from '../../../../shared/components/Modal';
import Button from '../../../../shared/components/Button';
import { payrollRepository } from '../../data/payrollRepository';
import { peso } from '../../domain/payrollRules';

export default function FinalizeRunModal({
  open,
  onClose,
  cutoff,
  rows = [],
  payMap = {},
  adminId = null,
  existingRun = null,
  onFinalized,
  onToast,
}) {
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setNotes(existingRun?.notes ?? '');
      setConfirmed(false);
      setError('');
      setBusy(false);
    }
  }, [open, existingRun]);

  const totals = useMemo(() => {
    let gross = 0;
    let deductions = 0;
    let net = 0;
    let thirteenth = 0;
    let employer = 0;
    for (const r of rows) {
      const p = payMap[r.user_id];
      if (!p) continue;
      gross += Number(p.gross) || 0;
      deductions += Number(p.totalDeductions) || 0;
      net += Number(p.net) || 0;
      thirteenth += Number(p.thirteenthMonthAccrual) || 0;
      employer += Number(p.employerContributionTotal) || 0;
    }
    return { gross, deductions, net, thirteenth, employer };
  }, [rows, payMap]);

  const locked = existingRun?.status === 'finalized' || existingRun?.status === 'paid';

  async function handleFinalize() {
    if (!confirmed || locked) return;
    setBusy(true);
    setError('');
    try {
      await payrollRepository.finalizeRun({
        periodStart: cutoff.start,
        periodEnd: cutoff.end,
        periodLabel: cutoff.label,
        rows,
        payMap,
        totals: {
          ...totals,
          employees: rows.length,
          generatedAt: new Date().toISOString(),
        },
        adminId,
        notes: notes.trim() || null,
      });
      onToast?.('Payroll finalized and locked', 'success');
      onFinalized?.();
      onClose();
    } catch (e) {
      const message = String(e?.message ?? e);
      setError(
        /relation .* does not exist|could not find the table/i.test(message)
          ? 'The payroll runs table is missing. Run 20261027120000_payroll_suite.sql first.'
          : message
      );
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={locked ? 'Payroll run locked' : 'Finalize payroll run'}
      subtitle={cutoff?.label}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        {locked ? (
          <div className="flex items-start gap-2 rounded-xl border border-green/30 bg-greenLight/50 px-3 py-2.5">
            <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-green" />
            <div className="text-xs text-textMedium">
              <p className="font-bold text-green">
                This period is already {existingRun.status}.
              </p>
              <p className="mt-0.5">
                Edits are locked. You can mark it paid from Payroll history.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-xl border border-yellow/40 bg-yellowLight/60 px-3 py-2.5">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-yellow" />
            <p className="text-xs text-textMedium">
              Finalizing saves a snapshot of every employee&apos;s pay and locks
              attendance adjustments for this period. You can still mark the run
              paid afterwards.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Metric label="Employees" value={rows.length} />
          <Metric label="Gross pay" value={peso(totals.gross)} />
          <Metric label="Deductions" value={peso(totals.deductions)} tone="bad" />
          <Metric label="Net pay" value={peso(totals.net)} tone="good" />
          <Metric label="13th month accrual" value={peso(totals.thirteenth)} />
          <Metric label="Employer contributions" value={peso(totals.employer)} />
        </div>

        {!locked && (
          <>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-textLight">
                Notes (optional)
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="e.g. Includes cash advance for Ana Cruz"
                className="w-full resize-none rounded-xl border border-border bg-bg px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <label className="flex items-start gap-2 rounded-xl border border-border bg-bg/40 px-3 py-2.5 text-xs text-textMedium">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span>
                I reviewed the payroll and understand this locks the period.
              </span>
            </label>
          </>
        )}

        {error && (
          <div className="rounded-xl border border-red/25 bg-redLight/60 px-3 py-2.5 text-xs text-red">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {locked ? 'Close' : 'Cancel'}
          </Button>
          {!locked && (
            <Button
              icon={Lock}
              onClick={handleFinalize}
              disabled={busy || !confirmed}
            >
              {busy ? 'Finalizing…' : 'Finalize & lock'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Metric({ label, value, tone = 'default' }) {
  const toneClass =
    tone === 'good'
      ? 'text-green'
      : tone === 'bad'
        ? 'text-red'
        : 'text-textDark';
  return (
    <div className="rounded-xl border border-border bg-white px-3 py-2.5">
      <p className="text-[9px] font-bold uppercase tracking-wider text-textLight">
        {label}
      </p>
      <p className={`mt-0.5 text-sm font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}
