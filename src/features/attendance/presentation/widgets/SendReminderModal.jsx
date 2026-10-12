// admin-panel/src/features/attendance/presentation/widgets/SendReminderModal.jsx
import { useEffect, useState } from 'react';
import { X, Bell, Send } from 'lucide-react';
import { sendPush } from '../../data/notificationsRepository';

const PRESETS = [
  {
    label: 'Missing time-out',
    text: 'You forgot to time out yesterday. Please submit a correction.',
  },
  {
    label: 'Retake selfie',
    text: 'Please retake your selfie — the last one was too low quality.',
  },
  {
    label: 'Time-in reminder',
    text: 'Reminder: Please time in before 9:00 AM tomorrow.',
  },
  {
    label: 'Late reminder',
    text: 'You were marked late today. Please be on time tomorrow.',
  },
];

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.userId       - profiles.id of the target employee
 * @param {string} props.employeeName - display name (for the header)
 * @param {(msg:string, type:'success'|'error')=>void} [props.onToast]
 */
export default function SendReminderModal({
  open,
  onClose,
  userId,
  employeeName,
  onToast,
}) {
  const [title, setTitle] = useState('Media Box Reminder');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle('Media Box Reminder');
      setBody('');
      setSending(false);
    }
  }, [open, userId]);

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
        channelId: 'attendance_channel',
      });
      if (res?.success === false) {
        throw new Error(res?.error || 'send-push returned success:false');
      }
      onToast?.(`Reminder sent to ${employeeName || 'employee'}`, 'success');
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
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
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
                  onClick={() => setBody(p.text)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold border border-border bg-bg text-textMedium hover:border-primary hover:text-primary transition"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

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
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Type a custom reminder, or pick a preset above..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <p className="text-[10px] text-textLight mt-1">
              {body.length} characters · delivered to channel{' '}
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