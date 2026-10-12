import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import Modal from '../../../../shared/components/Modal';
import Button from '../../../../shared/components/Button';
import { attendanceRepository } from '../../data/attendanceRepository';

export default function QuickNoteModal({ open, record, onClose, onSaved }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && record) {
      setNote(record.notes ?? '');
      setError('');
    }
  }, [open, record]);

  async function handleSave() {
    if (!record?.id) return;
    setSaving(true);
    setError('');
    try {
      const existing = (record.notes ?? '').trim();
      const stamp = new Date().toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const newLine = `[${stamp}] ${note.trim()}`;
      const merged = existing ? `${existing}\n${newLine}` : newLine;

      await attendanceRepository.updateRecord(record.id, { notes: merged });
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
      title="Add Note"
      subtitle={record ? `${record.employeeName} · ${record.date}` : ''}
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold tracking-wider text-textLight block mb-2">
            WHAT HAPPENED TODAY?
          </label>
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="e.g. Fixed the display case, handled morning rush, restocked shelves..."
            className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm text-textDark placeholder:text-textLight/70 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition resize-none"
          />
          <p className="text-[10px] text-textLight mt-2">
            The note will be timestamped and saved. Existing notes are kept.
          </p>
        </div>

        {record?.notes && (
          <div>
            <p className="text-[10px] font-bold tracking-wider text-textLight mb-1.5">
              EXISTING NOTES
            </p>
            <div className="bg-bg rounded-xl p-3 max-h-32 overflow-y-auto">
              <pre className="text-xs text-textMedium whitespace-pre-wrap font-mono leading-relaxed">
                {record.notes}
              </pre>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            icon={Save}
            onClick={handleSave}
            disabled={saving || !note.trim()}
          >
            {saving ? 'Saving...' : 'Save Note'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}