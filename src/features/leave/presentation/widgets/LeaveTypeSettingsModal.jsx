// admin-panel/src/features/leave/presentation/widgets/LeaveTypeSettingsModal.jsx
import { useEffect, useState } from 'react';
import { Save, AlertTriangle, Wallet, WalletCards } from 'lucide-react';
import Modal from '../../../../shared/components/Modal';
import Button from '../../../../shared/components/Button';
import { SkeletonList } from '../../../../shared/components/Skeleton';
import { leaveTypesRepository } from '../../data/leaveTypesRepository';

export default function LeaveTypeSettingsModal({
  open,
  onClose,
  onSaved,
  onToast,
  readOnly = false,
}) {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setTypes(await leaveTypesRepository.fetchAll());
    } catch (e) {
      setError(e.message || 'Failed to load leave types');
    } finally {
      setLoading(false);
    }
  }

  function update(key, patch) {
    setTypes((list) =>
      list.map((t) => (t.key === key ? { ...t, ...patch } : t))
    );
  }

  async function handleSave() {
    if (readOnly) return;
    setSaving(true);
    setError('');
    try {
      for (const type of types) {
        await leaveTypesRepository.save(type);
      }
      onToast?.('Leave pay settings saved', 'success');
      onSaved?.();
      onClose();
    } catch (e) {
      const message = String(e?.message ?? e);
      setError(
        /relation .* does not exist|could not find the table/i.test(message)
          ? 'The payroll_leave_types table is missing. Run 20261027120000_payroll_suite.sql first.'
          : message
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Leave pay settings"
      subtitle="Choose which approved leave types are paid in payroll"
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-xl border border-blue/25 bg-blueLight/50 px-3 py-2.5">
          <Wallet size={14} className="mt-0.5 shrink-0 text-blue" />
          <p className="text-xs text-textMedium">
            Approved leave never counts as attendance or selfie compliance.
            Paid types add a separate leave-pay line; unpaid types are excluded
            from pay.
          </p>
        </div>

        {loading ? (
          <SkeletonList rows={5} />
        ) : (
          <div className="space-y-2">
            {types.map((type) => (
              <div
                key={type.key}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-white px-3 py-2.5"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-bg text-textMedium">
                  {type.isPaid ? (
                    <WalletCards size={15} className="text-green" />
                  ) : (
                    <Wallet size={15} className="text-textLight" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-textDark">
                    {type.label || type.key}
                  </p>
                  <p className="text-[10px] text-textLight">
                    {type.isPaid
                      ? 'Paid — adds the daily rate for each approved day'
                      : 'Unpaid — excluded from payroll'}
                  </p>
                </div>

                <label className="flex items-center gap-2 rounded-full border border-border bg-bg px-3 py-1.5 text-[11px] font-bold text-textMedium">
                  <input
                    type="checkbox"
                    checked={!!type.isPaid}
                    onChange={(e) => update(type.key, { isPaid: e.target.checked })}
                    disabled={readOnly}
                    className="h-4 w-4 accent-primary"
                  />
                  Paid
                </label>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red/25 bg-redLight/60 px-3 py-2.5 text-xs text-red">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Close
          </Button>
          <Button
            icon={Save}
            onClick={handleSave}
            disabled={saving || loading || readOnly}
          >
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
