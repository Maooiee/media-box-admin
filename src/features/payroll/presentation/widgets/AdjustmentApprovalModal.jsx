// admin-panel/src/features/payroll/presentation/widgets/AdjustmentApprovalModal.jsx
import { useEffect, useState } from 'react';
import { Check, X, Clock3, RefreshCw } from 'lucide-react';
import Modal from '../../../../shared/components/Modal';
import Button from '../../../../shared/components/Button';
import { SkeletonList } from '../../../../shared/components/Skeleton';
import { payrollRepository } from '../../data/payrollRepository';
import { peso } from '../../domain/payrollRules';

const KIND_LABEL = {
  overtime: 'Overtime',
  undertime: 'Undertime',
  night_diff: 'Night differential',
  rest_day: 'Rest day',
  allowance: 'Allowance',
  bonus: 'Bonus',
  loan: 'Loan',
  cash_advance: 'Cash advance',
  other_deduction: 'Other deduction',
};

const DEDUCTION_KINDS = new Set([
  'undertime',
  'loan',
  'cash_advance',
  'other_deduction',
]);

export default function AdjustmentApprovalModal({
  open,
  onClose,
  cutoff,
  adminId = null,
  onChanged,
  onToast,
  readOnly = false,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [notes, setNotes] = useState({});

  useEffect(() => {
    if (open && cutoff) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cutoff]);

  async function load() {
    setLoading(true);
    try {
      setRows(
        await payrollRepository.fetchPendingAdjustments({
          from: cutoff.start,
          to: cutoff.end,
        })
      );
    } catch (e) {
      onToast?.(e.message || 'Failed to load approvals', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function decide(row, status) {
    setBusyId(row.id);
    try {
      await payrollRepository.setAdjustmentStatus({
        id: row.id,
        status,
        adminId,
        note: notes[row.id] || null,
      });
      onToast?.(
        status === 'approved' ? 'Adjustment approved' : 'Adjustment rejected',
        'success'
      );
      await load();
      onChanged?.();
    } catch (e) {
      onToast?.(e.message || 'Failed to update adjustment', 'error');
    } finally {
      setBusyId(null);
    }
  }

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="OT / UT approvals"
      subtitle={cutoff?.label}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-textLight">
            Pending adjustments are excluded from pay until approved.
          </p>
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={load}>
            Refresh
          </Button>
        </div>

        {readOnly && (
          <div className="flex items-start gap-2 rounded-xl border border-blue/25 bg-blueLight/50 px-3 py-2.5">
            <Clock3 size={13} className="mt-0.5 shrink-0 text-blue" />
            <p className="text-[11px] text-textMedium">
              This period is locked or your access is view-only. Adjustments
              can be reviewed here but not approved or rejected.
            </p>
          </div>
        )}

        {loading ? (
          <SkeletonList rows={3} />
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-border bg-bg/40 px-4 py-8 text-center">
            <Clock3 size={22} className="mx-auto text-textLight" />
            <p className="mt-2 text-sm font-bold text-textDark">
              No pending adjustments
            </p>
            <p className="mt-0.5 text-xs text-textLight">
              New OT/UT entries will appear here for review.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => {
              const isDeduction = DEDUCTION_KINDS.has(row.kind);
              return (
                <div
                  key={row.id}
                  className="rounded-2xl border border-border bg-white p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isDeduction
                          ? 'bg-redLight text-red'
                          : 'bg-greenLight text-green'
                      }`}
                    >
                      {KIND_LABEL[row.kind] ?? row.kind}
                    </span>
                    <span className="text-xs font-bold text-textDark">
                      {row.employee_name}
                    </span>
                    <span className="text-[10px] text-textLight">
                      {row.employee_id}
                    </span>
                    <span className="text-[10px] font-semibold text-textMedium">
                      {row.work_date}
                    </span>
                    <span className="ml-auto text-xs font-bold text-textDark">
                      {row.kind === 'allowance' ||
                      row.kind === 'bonus' ||
                      row.kind === 'loan' ||
                      row.kind === 'cash_advance' ||
                      row.kind === 'other_deduction'
                        ? peso(row.amount ?? 0)
                        : `${row.minutes} min`}
                    </span>
                  </div>

                  {row.reason && (
                    <p className="mt-1.5 text-[11px] italic text-textLight">
                      “{row.reason}”
                    </p>
                  )}

                  {!readOnly && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        value={notes[row.id] ?? ''}
                        onChange={(e) =>
                          setNotes((m) => ({ ...m, [row.id]: e.target.value }))
                        }
                        placeholder="Decision note (optional)"
                        className="min-w-[160px] flex-1 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-[11px] outline-none focus:border-primary/50"
                      />
                      <button
                        onClick={() => decide(row, 'approved')}
                        disabled={busyId === row.id}
                        className="inline-flex items-center gap-1 rounded-full bg-green px-3 py-1.5 text-[11px] font-bold text-white hover:bg-green/90 disabled:opacity-50"
                      >
                        <Check size={12} /> Approve
                      </button>
                      <button
                        onClick={() => decide(row, 'rejected')}
                        disabled={busyId === row.id}
                        className="inline-flex items-center gap-1 rounded-full border border-red/30 bg-redLight/60 px-3 py-1.5 text-[11px] font-bold text-red hover:bg-redLight disabled:opacity-50"
                      >
                        <X size={12} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end border-t border-border pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
