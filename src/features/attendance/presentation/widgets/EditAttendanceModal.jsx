import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import Modal from '../../../../shared/components/Modal';
import Button from '../../../../shared/components/Button';
import { attendanceRepository } from '../../data/attendanceRepository';
import {
  manilaDateTimeToIso,
  toManilaTimeInput,
} from '../../../../core/utils/formatters';

const STATUSES = [
  { key: 'present', label: 'Present' },
  { key: 'late',    label: 'Late' },
  { key: 'absent',  label: 'Absent' },
];

export default function EditAttendanceModal({ open, record, onClose, onSaved }) {
  const [timeIn, setTimeIn] = useState('');
  const [timeOut, setTimeOut] = useState('');
  const [status, setStatus] = useState('present');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (record) {
      setTimeIn(toManilaTimeInput(record.timeIn));
      setTimeOut(toManilaTimeInput(record.timeOut));
      setStatus(record.status ?? 'present');
      setNotes(record.notes ?? '');
      setError('');
    }
  }, [record]);

  async function handleSave() {
    if (!record) return;
    setSaving(true);
    setError('');
    try {
      await attendanceRepository.updateRecord(record.id, {
        timeIn: manilaDateTimeToIso(record.date, timeIn),
        timeOut: manilaDateTimeToIso(record.date, timeOut),
        status,
        notes,
      });
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
      title="Edit Attendance"
      subtitle={record ? `${record.employeeName} · ${record.date}` : ''}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="TIME IN">
            <input
              type="time"
              value={timeIn}
              onChange={(e) => setTimeIn(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary bg-white"
            />
          </Field>
          <Field label="TIME OUT">
            <input
              type="time"
              value={timeOut}
              onChange={(e) => setTimeOut(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary bg-white"
            />
          </Field>
        </div>

        <Field label="STATUS">
          <div className="flex gap-2">
            {STATUSES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setStatus(s.key)}
                className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                  status === s.key
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-white text-textMedium border border-border hover:bg-bg'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="NOTES (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Reason for correction, e.g. forgot to clock out"
            className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary bg-white resize-none"
          />
        </Field>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button icon={Save} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
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
