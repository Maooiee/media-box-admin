import { useEffect, useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import Modal from '../../../../shared/components/Modal';
import Button from '../../../../shared/components/Button';
import { shiftsAdminRepository } from '../../data/shiftsAdminRepository';
import { employeesRepository } from '../../../employees/data/employeesRepository';
import { SHIFT_KINDS } from '../../domain/Shift';

export default function EditShiftModal({ open, shift, onClose, onSaved }) {
  const [userId, setUserId] = useState('');
  const [shiftDate, setShiftDate] = useState('');
  const [name, setName] = useState('Morning Shift');
  const [kind, setKind] = useState('morning');
  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(17);
  const [isFlexible, setIsFlexible] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEdit = !!shift?.id;

  useEffect(() => {
    if (!open) return;

    (async () => {
      try {
        const raw = await employeesRepository.fetchAll();
        setEmployees(raw);
      } catch (e) {
        console.error(e);
      }
    })();

    if (shift) {
      setUserId(shift.userId ?? '');
      setShiftDate(shift.shiftDate ?? '');
      setName(shift.name ?? '');
      setKind(shift.kind ?? 'morning');
      setStartHour(shift.startHour ?? 8);
      setEndHour(shift.endHour ?? 17);
      setIsFlexible(shift.isFlexible ?? false);
    } else {
      setUserId('');
      setShiftDate(shift?.shiftDate ?? new Date().toISOString().slice(0, 10));
      setName('Morning Shift');
      setKind('morning');
      setStartHour(8);
      setEndHour(17);
      setIsFlexible(false);
    }
    setError('');
    setConfirmDelete(false);
  }, [open, shift]);

  function pickKind(k) {
    setKind(k.key);
    setStartHour(k.start);
    setEndHour(k.end);
    const label =
      k.key === 'afternoon' ? 'Mid Shift' :
      k.key === 'morning'   ? 'Morning Shift' :
      k.key === 'evening'   ? 'Evening Shift' :
      k.key === 'night'     ? 'Night Shift' :
                              'Flexible Shift';
    setName(label);
  }

  async function handleSave() {
    if (!userId || !shiftDate) {
      setError('Employee and date are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await shiftsAdminRepository.updateShift(shift.id, {
          name, kind, startHour, endHour, isFlexible,
        });
      } else {
        await shiftsAdminRepository.createShift({
          userId, shiftDate, name, kind, startHour, endHour, isFlexible,
        });
      }
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!shift?.id) return;
    setSaving(true);
    try {
      await shiftsAdminRepository.deleteShift(shift.id);
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Shift' : 'Add Shift'}
      subtitle={isEdit ? `Editing ${shift.employeeName}'s shift` : 'Schedule a new shift'}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        {!isEdit && (
          <Field label="EMPLOYEE">
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary bg-white"
            >
              <option value="">Choose an employee...</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name} ({e.employee_id})
                </option>
              ))}
            </select>
          </Field>
        )}

        {!isEdit && (
          <Field label="DATE">
            <input
              type="date"
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary bg-white"
            />
          </Field>
        )}

        <Field label="SHIFT TYPE">
          <div className="grid grid-cols-5 gap-2">
            {SHIFT_KINDS.map((k) => (
              <button
                key={k.key}
                type="button"
                onClick={() => pickKind(k)}
                className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  kind === k.key
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-white text-textMedium border border-border hover:bg-bg'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="NAME">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary bg-white"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="START HOUR">
            <select
              value={startHour}
              onChange={(e) => setStartHour(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary bg-white"
            >
              {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </Field>
          <Field label="END HOUR">
            <select
              value={endHour}
              onChange={(e) => setEndHour(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary bg-white"
            >
              {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </Field>
        </div>

        <label className="flex items-center gap-3 cursor-pointer bg-bg rounded-xl px-4 py-3">
          <input
            type="checkbox"
            checked={isFlexible}
            onChange={(e) => setIsFlexible(e.target.checked)}
            className="w-4 h-4 accent-[#F26A1B]"
          />
          <span className="text-sm font-medium text-textDark">
            Flexible shift (employee picks start time)
          </span>
        </label>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>
        )}

        <div className="flex justify-between gap-2 pt-2">
          <div>
            {isEdit && !confirmDelete && (
              <Button
                variant="ghost"
                icon={Trash2}
                onClick={() => setConfirmDelete(true)}
                disabled={saving}
                className="!text-red-600 hover:!bg-red-50"
              >
                Delete
              </Button>
            )}
            {isEdit && confirmDelete && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-700 font-semibold">
                  Sure?
                </span>
                <Button variant="danger" size="sm" onClick={handleDelete} disabled={saving}>
                  Yes, delete
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button icon={Save} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Save' : 'Create Shift'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-bold tracking-wider text-textLight block mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}
