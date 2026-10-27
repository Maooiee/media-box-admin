import { useEffect, useState } from 'react';
import { X, Clock, Calendar, CheckCircle, AlertCircle, Save, Edit3 } from 'lucide-react';
import { formatTime } from '../../../../core/utils/formatters';
import { attendanceRepository } from '../../data/attendanceRepository';

export default function AttendanceRecordDrawer({ open, record, onClose, onSaved }) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && record) {
      setNotes(record.notes ?? '');
      setEditingNotes(false);
      setError('');
    }
  }, [open, record]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open || !record) return null;

  const selfieUrl = attendanceRepository.getSelfieUrl(record.selfieUrl);

  function hoursWorked() {
    if (!record.timeIn || !record.timeOut) return '--';
    const ms = new Date(record.timeOut) - new Date(record.timeIn);
    if (ms <= 0) return '--';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  }

  const statusColor =
    record.status === 'present' ? 'text-green-700 bg-green-100 border-green-200' :
    record.status === 'late'    ? 'text-yellow-700 bg-yellow-100 border-yellow-200' :
    record.status === 'absent'  ? 'text-red-700 bg-red-100 border-red-200' :
                                  'text-gray-700 bg-gray-100 border-gray-200';

  async function handleSaveNotes() {
    setSaving(true);
    setError('');
    try {
      await attendanceRepository.updateRecord(record.id, { notes });
      onSaved?.();
      setEditingNotes(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]"
      onClick={onClose}
    >
      <div
        className="absolute right-0 top-0 bottom-0 w-full max-w-md overflow-y-auto border-l border-border bg-white shadow-float"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'slideInRight 280ms ease-out' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div>
            <p className="text-[10px] font-bold tracking-wider text-textLight">
              ATTENDANCE DETAIL
            </p>
            <h2 className="text-lg font-bold text-textDark mt-0.5">
              {record.employeeName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-bg flex items-center justify-center text-textLight hover:text-textDark transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Selfie */}
          {selfieUrl ? (
            <div className="relative rounded-2xl overflow-hidden border border-border shadow-sm">
              <img
                src={selfieUrl}
                alt="Selfie"
                className="w-full aspect-square object-cover cursor-pointer hover:opacity-95 transition"
                onClick={() => window.open(selfieUrl, '_blank')}
              />
              <div className="absolute top-3 right-3 bg-black/60 backdrop-blur text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                TAP TO ENLARGE
              </div>
            </div>
          ) : (
            <div className="rounded-2xl aspect-square bg-bg flex items-center justify-center border border-border">
              <p className="text-sm text-textLight">No selfie captured</p>
            </div>
          )}

          {/* Status pill */}
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold tracking-wider px-3 py-1.5 rounded-full border ${statusColor}`}>
              {record.status === 'present' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
              {record.status?.toUpperCase()}
            </span>
            <span className="text-xs text-textLight font-semibold flex items-center gap-1.5">
              <Calendar size={12} />
              {record.date}
            </span>
          </div>

          {/* Time in/out grid */}
          <div className="grid grid-cols-2 gap-3">
            <InfoTile
              label="TIME IN"
              value={formatTime(record.timeIn)}
              icon={<Clock size={14} />}
            />
            <InfoTile
              label="TIME OUT"
              value={formatTime(record.timeOut)}
              icon={<Clock size={14} />}
            />
          </div>

          {/* Hours worked */}
          <div className="bg-primary-light/40 border border-primary/20 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-wider text-primary">
                HOURS WORKED
              </p>
              <p className="text-2xl font-bold text-primary mt-0.5">
                {hoursWorked()}
              </p>
            </div>
            <Clock size={32} className="text-primary/40" />
          </div>

          {/* Employee info */}
          <div className="bg-bg rounded-2xl p-4 space-y-2">
            <Row label="Employee ID" value={record.employeeId} />
            {record.position && <Row label="Position" value={record.position} />}
          </div>

          {/* Notes — editable */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold tracking-wider text-textLight">
                NOTES FOR THE DAY
              </p>
              {!editingNotes && (
                <button
                  onClick={() => setEditingNotes(true)}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"
                >
                  <Edit3 size={10} /> EDIT
                </button>
              )}
            </div>

            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  autoFocus
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={5}
                  placeholder="What did they do today? Add notes to remember..."
                  className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm text-textDark placeholder:text-textLight/70 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition resize-none"
                />
                {error && (
                  <p className="text-xs text-red-600">{error}</p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setNotes(record.notes ?? '');
                      setEditingNotes(false);
                      setError('');
                    }}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold text-textMedium hover:bg-bg transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNotes}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-primary text-white hover:bg-primary-dark transition disabled:opacity-50"
                  >
                    <Save size={12} />
                    {saving ? 'Saving...' : 'Save Note'}
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="bg-amber-50 border border-amber-200 rounded-2xl p-4 cursor-pointer hover:bg-amber-100/70 transition min-h-[80px]"
                onClick={() => setEditingNotes(true)}
              >
                {record.notes ? (
                  <pre className="text-sm text-amber-900 whitespace-pre-wrap font-mono leading-relaxed">
                    {record.notes}
                  </pre>
                ) : (
                  <p className="text-sm text-amber-700/70 italic">
                    No notes yet. Click to add — remember what they did today.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Expiry */}
          {record.expiresAt && selfieUrl && (
            <div className="text-center text-[10px] text-textLight">
              Selfie auto-deletes on {new Date(record.expiresAt).toLocaleDateString('en-PH')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoTile({ label, value, icon }) {
  return (
    <div className="bg-bg rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-textLight mb-1.5">
        {icon}
        <p className="text-[10px] font-bold tracking-wider">{label}</p>
      </div>
      <p className="text-lg font-bold text-textDark">{value}</p>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-textLight font-semibold">{label}</span>
      <span className="text-sm font-bold text-textDark truncate">{value}</span>
    </div>
  );
}
