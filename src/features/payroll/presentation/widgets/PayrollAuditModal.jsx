// admin-panel/src/features/payroll/presentation/widgets/PayrollAuditModal.jsx
import { useEffect, useState } from 'react';
import { ShieldCheck, RefreshCw, Search } from 'lucide-react';
import Modal from '../../../../shared/components/Modal';
import Button from '../../../../shared/components/Button';
import { SkeletonList } from '../../../../shared/components/Skeleton';
import { payrollRepository } from '../../data/payrollRepository';

const ACTION_LABEL = {
  'adjustment.created': 'Adjustment created',
  'adjustment.approved': 'Adjustment approved',
  'adjustment.rejected': 'Adjustment rejected',
  'adjustment.pending': 'Adjustment reopened',
  'adjustment.deleted': 'Adjustment deleted',
  'deduction.deleted': 'Recurring deduction deleted',
  'run.finalized': 'Payroll finalized',
  'run.paid': 'Payroll marked paid',
};

function fmtWhen(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PayrollAuditModal({ open, onClose, onToast }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function load() {
    setLoading(true);
    try {
      setRows(await payrollRepository.fetchAuditLog({ limit: 120 }));
    } catch (e) {
      onToast?.(e.message || 'Failed to load audit log', 'error');
    } finally {
      setLoading(false);
    }
  }

  const query = search.trim().toLowerCase();
  const visible = query
    ? rows.filter(
        (r) =>
          String(r.actor_name ?? '').toLowerCase().includes(query) ||
          String(r.action ?? '').toLowerCase().includes(query) ||
          String(r.entity ?? '').toLowerCase().includes(query) ||
          String(r.entity_id ?? '').toLowerCase().includes(query)
      )
    : rows;

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Payroll audit log"
      subtitle="Who changed what, and when"
      maxWidth="max-w-3xl"
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="field-shell flex-1">
            <Search size={14} className="shrink-0 text-textLight" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search actor, action, or entity…"
              className="field-input"
            />
          </div>
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={load}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <SkeletonList rows={5} />
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-border bg-bg/40 px-4 py-8 text-center">
            <ShieldCheck size={22} className="mx-auto text-textLight" />
            <p className="mt-2 text-sm font-bold text-textDark">
              No audit entries yet
            </p>
            <p className="mt-0.5 text-xs text-textLight">
              Finalizing payroll, approvals, and deletions are recorded here.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-xs">
              <thead className="bg-bg text-[9px] uppercase tracking-wider text-textLight">
                <tr>
                  <th className="px-3 py-2 text-left font-bold">When</th>
                  <th className="px-3 py-2 text-left font-bold">Actor</th>
                  <th className="px-3 py-2 text-left font-bold">Action</th>
                  <th className="px-3 py-2 text-left font-bold">Entity</th>
                  <th className="px-3 py-2 text-left font-bold">Details</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="whitespace-nowrap px-3 py-2 text-textMedium">
                      {fmtWhen(r.created_at)}
                    </td>
                    <td className="px-3 py-2 font-semibold text-textDark">
                      {r.actor_name || 'System'}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-primary-light/50 px-2 py-0.5 text-[10px] font-bold text-primary">
                        {ACTION_LABEL[r.action] ?? r.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-textMedium">
                      {r.entity}
                      {r.entity_id ? (
                        <span className="ml-1 text-[9px] text-textLight">
                          {String(r.entity_id).slice(0, 8)}
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-textLight">
                      {r.details && Object.keys(r.details).length > 0
                        ? JSON.stringify(r.details)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
