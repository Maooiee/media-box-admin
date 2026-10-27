// admin-panel/src/features/attendance/presentation/widgets/SendReminderModal.jsx
import { useEffect, useState } from 'react';
import { X, Bell, Send } from 'lucide-react';
import { sendPush } from '../../data/notificationsRepository';
import { toManilaDate } from '../../../../core/utils/formatters';

const PRESETS = [
  {
    label: 'Missing time-out',
    kind: 'missed_time_out',
    text: 'You forgot to time out yesterday. Please submit a correction.',
  },
  {
    label: 'Retake selfie',
    kind: 'retake_selfie',
    text: 'Please retake your selfie — the last one was too low quality.',
  },
  {
    label: 'Time-in reminder',
    kind: 'time_in',
    text: 'Reminder: Please time in before 9:00 AM tomorrow.',
  },
  {
    label: 'Late reminder',
    kind: 'late',
    text: 'You were marked late today. Please be on time tomorrow.',
  },
];

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.userId       - profiles.id of the target employee
 * @param {string} props.employeeName - display name (for the header)
 * @param {string} [props.recordDate] - YYYY-MM-DD of the attendance record
 * @param {string} [props.suggestedKind] - preset to prefill based on the record
 * @param {(msg:string, type:'success'|'error')=>void} [props.onToast]
 */
export default function SendReminderModal({
  open,
  onClose,
  userId,
  employeeName,
  recordDate,
  suggestedKind = 'admin_reminder',
  onToast,
}) {
  const [title, setTitle] = useState('Media Box Reminder');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState('admin_reminder');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      const preset = PRESETS.find((p) => p.kind === suggestedKind);
      setTitle('Media Box Reminder');
      setBody(preset?.text ?? '');
      setKind(preset?.kind ?? 'admin_reminder');
      setSending(false);
    }
  }, [open, userId, suggestedKind]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape' && !sending) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, sending, onClose]);

  if (!open) return null;

  async function handleSend() {
    if (!userId) {
      onToast?.('Missing user id for this record.', 'error');
      return;
    }
    if (!body.trim()) {
      onToast?.('Message body is required.', 'error');
      return;
    }

    setSending(true);
    try {
      const res = await sendPush({
        userId,
        title: title.trim() || 'Media Box Reminder',
        body: body.trim(),
        kind,
        data:
          kind === 'retake_selfie' && recordDate
            ? { date: recordDate }
            : undefined,
        channelId: 'attendance_channel',
      });
      if (res?.success === false) {
        throw new Error(res?.error || 'send-push returned success:false');
      }
      if (res?.push === false) {
        onToast?.(
          res.warning || 'Reminder saved in the app, but the push failed.',
          'error'
        );
      } else {
        onToast?.(`Reminder sent to ${employeeName || 'employee'}`, 'success');
      }
      onClose();
    } catch (e) {
      console.error('sendPush failed:', e);
      onToast?.(e.message || 'Failed to send reminder', 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={() => !sending && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/60 bg-white shadow-float"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Bell size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-textDark">
                Send Reminder
              </h3>
              <p className="text-xs text-textLight mt-0.5 truncate max-w-[260px]">
                {employeeName ? `To: ${employeeName}` : 'Pick a message'}
              </p>
            </div>
          </div>
          <button
            onClick={() => !sending && onClose()}
            disabled={sending}
            className="w-8 h-8 rounded-full hover:bg-bg flex items-center justify-center text-textLight hover:text-textDark transition disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Presets */}
          <div>
            <p className="text-[10px] font-bold tracking-wider uppercase text-textLight mb-2">
              Quick presets
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setBody(p.text);
                    setKind(p.kind);
                  }}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold border border-border bg-bg text-textMedium hover:border-primary hover:text-primary transition"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {kind === 'retake_selfie' &&
            recordDate &&
            recordDate !== toManilaDate() && (
              <p className="text-[11px] font-semibold text-yellow bg-yellowLight border border-yellow/30 rounded-xl px-3 py-2">
                This record is not from today. Retake works only for today&apos;s
                attendance — the employee cannot replace an old selfie.
              </p>
            )}

          {/* Title */}
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-textLight mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-textLight mb-1.5">
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => {
                const value = e.target.value;
                setBody(value);
                setKind(
                  PRESETS.find((p) => p.text === value)?.kind ??
                    'admin_reminder'
                );
              }}
              rows={4}
              placeholder="Type a custom reminder, or pick a preset above..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <p className="text-[10px] text-textLight mt-1">
              {body.length} characters · saved in the app and pushed to{' '}
              <code className="bg-bg px-1 rounded">attendance_channel</code>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-bg/40">
          <button
            onClick={() => !sending && onClose()}
            disabled={sending}
            className="px-4 py-2.5 rounded-full text-sm font-semibold text-textMedium hover:bg-bg transition disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !body.trim()}
            className="px-5 py-2.5 rounded-full text-sm font-semibold bg-primary text-white hover:bg-primary-dark shadow-md shadow-primary/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {sending ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send size={14} />
                Send
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}