// admin-panel/src/features/payroll/presentation/widgets/PayrollHistoryModal.jsx
import { useEffect, useState } from 'react';
import {
  History,
  RefreshCw,
  Printer,
  CheckCircle2,
  Lock,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import Modal from '../../../../shared/components/Modal';
import Button from '../../../../shared/components/Button';
import { SkeletonList } from '../../../../shared/components/Skeleton';
import { payrollRepository } from '../../data/payrollRepository';
import { peso } from '../../domain/payrollRules';

const STATUS_STYLE = {
  draft: 'bg-bg text-textMedium border-border',
  review: 'bg-yellowLight text-yellow border-yellow/30',
  finalized: 'bg-blueLight text-blue border-blue/30',
  paid: 'bg-greenLight text-green border-green/30',
};

export default function PayrollHistoryModal({
  open,
  onClose,
  adminId = null,
  onReprint,
  onToast,
  onChanged,
  readOnly = false,
}) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [itemsByRun, setItemsByRun] = useState({});

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function load() {
    setLoading(true);
    try {
      setRuns(await payrollRepository.fetchRuns({ limit: 60 }));
    } catch (e) {
      onToast?.(e.message || 'Failed to load payroll history', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function toggle(run) {
    if (expanded === run.id) {
      setExpanded(null);
      return;
    }
    setExpanded(run.id);
    if (!itemsByRun[run.id]) {
      try {
        const { items } = await payrollRepository.fetchRun(run.id);
        setItemsByRun((m) => ({ ...m, [run.id]: items }));
      } catch (e) {
        onToast?.(e.message || 'Failed to load run items', 'error');
      }
    }
  }

  async function handleReprint(run) {
    setBusyId(run.id);
    try {
      const { items } = itemsByRun[run.id]
        ? { items: itemsByRun[run.id] }
        : await payrollRepository.fetchRun(run.id);
      const rows = (items ?? []).map((i) => ({
        ...(i.snapshot ?? {}),
        user_id: i.user_id,
        full_name: i.employee_name,
        employee_id: i.employee_id,
      }));
      await onReprint?.({ run, rows });
    } catch (e) {
      onToast?.(e.message || 'Failed to reprint', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkPaid(run) {
    setBusyId(run.id);
    try {
      await payrollRepository.markRunPaid({ runId: run.id, adminId });
      onToast?.('Run marked as paid', 'success');
      await load();
      onChanged?.();
    } catch (e) {
      onToast?.(e.message || 'Failed to mark run paid', 'error');
    } finally {
      setBusyId(null);
    }
  }

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Payroll history"
      subtitle="Finalized runs, snapshots, and payment status"
      maxWidth="max-w-3xl"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-textLight">
            Finalizing a period creates an immutable snapshot here.
          </p>
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={load}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <SkeletonList rows={4} />
        ) : runs.length === 0 ? (
          <div className="rounded-2xl border border-border bg-bg/40 px-4 py-8 text-center">
            <History size={22} className="mx-auto text-textLight" />
            <p className="mt-2 text-sm font-bold text-textDark">
              No finalized runs yet
            </p>
            <p className="mt-0.5 text-xs text-textLight">
              Finalize a cutoff from the payroll page to create the first
              snapshot.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {runs.map((run) => {
              const totals = run.totals ?? {};
              const isOpen = expanded === run.id;
              const items = itemsByRun[run.id] ?? [];
              return (
                <div
                  key={run.id}
                  className="overflow-hidden rounded-2xl border border-border bg-white"
                >
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <button
                      onClick={() => toggle(run)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-bg text-textLight hover:text-primary"
                      aria-label="Toggle run details"
                    >
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-textDark">
                        {run.period_label ||
                          `${run.period_start} → ${run.period_end}`}
                      </p>
                      <p className="text-[10px] text-textLight">
                        {run.period_start} → {run.period_end}
                        {run.finalized_at
                          ? ` · finalized ${new Date(run.finalized_at).toLocaleString('en-PH')}`
                          : ''}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${
                        STATUS_STYLE[run.status] ?? STATUS_STYLE.draft
                      }`}
                    >
                      {run.status}
                    </span>

                    <div className="text-right">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-textLight">
                        Net pay
                      </p>
                      <p className="text-sm font-bold text-textDark">
                        {peso(totals.net ?? 0)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleReprint(run)}
                        disabled={busyId === run.id}
                        className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[10px] font-bold text-textMedium hover:border-primary/40 hover:text-primary disabled:opacity-50"
                      >
                        <Printer size={11} /> Reprint
                      </button>
                      {run.status === 'finalized' && !readOnly && (
                        <button
                          onClick={() => handleMarkPaid(run)}
                          disabled={busyId === run.id}
                          className="inline-flex items-center gap-1 rounded-full border border-green/30 bg-greenLight/50 px-2.5 py-1 text-[10px] font-bold text-green hover:bg-greenLight disabled:opacity-50"
                        >
                          <CheckCircle2 size={11} /> Mark paid
                        </button>
                      )}
                      {run.status === 'paid' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-greenLight/60 px-2.5 py-1 text-[10px] font-bold text-green">
                          <CheckCircle2 size={11} /> Paid
                        </span>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-border bg-bg/30 px-4 py-3">
                      {items.length === 0 ? (
                        <p className="text-xs text-textLight">
                          Loading snapshot…
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="text-[9px] uppercase tracking-wider text-textLight">
                              <tr>
                                <th className="py-1.5 text-left font-bold">Employee</th>
                                <th className="py-1.5 text-right font-bold">Gross</th>
                                <th className="py-1.5 text-right font-bold">Deductions</th>
                                <th className="py-1.5 text-right font-bold">Net</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((i) => (
                                <tr key={i.id} className="border-t border-border/60">
                                  <td className="py-1.5 font-semibold text-textDark">
                                    {i.employee_name}
                                    <span className="ml-1 text-[9px] text-textLight">
                                      {i.employee_id}
                                    </span>
                                  </td>
                                  <td className="py-1.5 text-right">
                                    {peso(i.gross)}
                                  </td>
                                  <td className="py-1.5 text-right text-red">
                                    {peso(i.deductions)}
                                  </td>
                                  <td className="py-1.5 text-right font-bold text-textDark">
                                    {peso(i.net)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {run.notes && (
                        <p className="mt-2 rounded-lg bg-white px-2.5 py-1.5 text-[11px] text-textMedium">
                          <span className="font-bold text-textDark">Notes: </span>
                          {run.notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border pt-3 text-[10px] text-textLight">
          <span className="inline-flex items-center gap-1">
            <Lock size={11} /> Finalized runs are locked snapshots.
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
