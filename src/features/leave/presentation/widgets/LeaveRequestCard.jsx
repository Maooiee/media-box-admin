// admin-panel/src/features/leave/presentation/widgets/LeaveRequestCard.jsx
import { useState } from 'react';
import {
  Calendar,
  User as UserIcon,
  FileText,
  Paperclip,
  Check,
  X,
} from 'lucide-react';
import { leaveAdminRepository } from '../../data/leaveAdminRepository';

const STATUS_STYLE = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
};

const TYPE_STYLE = {
  sick: 'bg-red-50 text-red-700',
  vacation: 'bg-blue-50 text-blue-700',
  emergency: 'bg-amber-50 text-amber-700',
  maternity: 'bg-purple-50 text-purple-700',
  paternity: 'bg-teal-50 text-teal-700',
  bereavement: 'bg-gray-100 text-gray-700',
  others: 'bg-slate-100 text-slate-700',
};

export default function LeaveRequestCard({
  request,
  onApprove,
  onReject,
  onViewAttachment,
  busy,
}) {
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');

  const isPending = request.status === 'pending';

  return (
    <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-border">
        <div className="w-11 h-11 rounded-full bg-primary-light flex items-center justify-center text-primary font-bold text-sm shrink-0">
          {request.employeeName?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-textDark truncate">
            {request.employeeName}
          </p>
          <p className="text-xs text-textLight truncate">
            {request.employeeId}
            {request.position ? ` · ${request.position}` : ''}
          </p>
        </div>
        <span
          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wide ${STATUS_STYLE[request.status] ?? STATUS_STYLE.pending}`}
        >
          {request.statusLabel}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${TYPE_STYLE[request.leave_type] ?? TYPE_STYLE.others}`}
          >
            {request.typeLabel}
          </span>
          <span className="text-xs text-textMedium font-semibold inline-flex items-center gap-1.5">
            <Calendar size={12} /> {request.dateLabel}
          </span>
        </div>

        {request.reason && (
          <div className="bg-bg rounded-xl p-3 flex items-start gap-2">
            <FileText size={14} className="text-textLight mt-0.5 shrink-0" />
            <p className="text-xs text-textMedium leading-relaxed">
              {request.reason}
            </p>
          </div>
        )}

        {request.attachment_path && (
          <button
            onClick={() => onViewAttachment?.(request.attachment_path)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <Paperclip size={12} /> View attachment
          </button>
        )}

        {request.review_note && (
          <div className="bg-bg rounded-xl p-3 text-xs text-textMedium">
            <span className="font-bold text-textDark">Admin note: </span>
            {request.review_note}
          </div>
        )}
      </div>

      {/* Actions */}
      {isPending && (
        <div className="px-4 pb-4 space-y-2">
          {showNote ? (
            <>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note for the employee..."
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-border bg-bg text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  onClick={async () => {
                    await onApprove?.(request, note.trim() || null);
                    setShowNote(false);
                    setNote('');
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  <Check size={14} /> Approve
                </button>
                <button
                  disabled={busy}
                  onClick={async () => {
                    await onReject?.(request, note.trim() || null);
                    setShowNote(false);
                    setNote('');
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition disabled:opacity-50"
                >
                  <X size={14} /> Reject
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    setShowNote(false);
                    setNote('');
                  }}
                  className="px-3 py-2.5 rounded-xl border border-border text-xs font-semibold text-textMedium hover:bg-bg transition"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={() => setShowNote(true)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition disabled:opacity-50 border border-emerald-200"
              >
                <Check size={14} /> Approve
              </button>
              <button
                disabled={busy}
                onClick={() => setShowNote(true)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-50 text-red-700 text-xs font-bold hover:bg-red-100 transition disabled:opacity-50 border border-red-200"
              >
                <X size={14} /> Reject
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}