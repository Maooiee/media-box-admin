import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { employeesRepository } from '../../data/employeesRepository';

export default function EditEmployeeModal({ open, employee, onClose, onSaved }) {
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [schedule, setSchedule] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && employee) {
      setFullName(employee.fullName ?? '');
      setPosition(employee.position ?? '');
      setSchedule(employee.schedule ?? '');
      setIsAdmin(employee.isAdmin ?? false);
      setIsActive(employee.isActive ?? true);
      setError('');
    }
  }, [open, employee]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await employeesRepository.updateEmployee(employee.id, {
        fullName: fullName.trim(),
        position: position.trim(),
        schedule: schedule.trim(),
        isAdmin,
        isActive,
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="text-lg font-bold text-textDark">Edit Employee</h3>
            <p className="text-[11px] text-textLight">{employee?.employeeId}</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-bg flex items-center justify-center text-textLight hover:text-textDark transition"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <Field label="Full Name">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </Field>

          <Field label="Position">
            <input
              type="text"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="Cashier"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </Field>

          <Field label="Schedule">
            <input
              type="text"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="Mon-Fri 9AM-6PM"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </Field>

          <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-bg cursor-pointer">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-sm font-semibold text-textDark">
              Admin access
            </span>
          </label>

          <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-bg cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-sm font-semibold text-textDark">
              Active employee
            </span>
          </label>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-textMedium hover:bg-bg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-dark transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-textLight uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}