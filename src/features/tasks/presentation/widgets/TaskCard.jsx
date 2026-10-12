import { Pencil, Paperclip, MessageSquare, User } from 'lucide-react';
import { initials } from '../../../../core/utils/formatters';

const STATUS_CFG = {
  backlog: {
    bg: 'bg-bg',
    text: 'text-textMedium',
    border: 'border-border',
    bar: 'bg-textFaint',
    label: 'Backlog',
  },
  onProgress: {
    bg: 'bg-yellowLight',
    text: 'text-yellow',
    border: 'border-yellow/30',
    bar: 'bg-yellow',
    label: 'On Progress',
  },
  onHold: {
    bg: 'bg-redLight',
    text: 'text-red',
    border: 'border-red/30',
    bar: 'bg-red',
    label: 'On Hold',
  },
  done: {
    bg: 'bg-greenLight',
    text: 'text-green',
    border: 'border-green/30',
    bar: 'bg-green',
    label: 'Done',
  },
};

export function statusConfig(status) {
  return STATUS_CFG[status] ?? STATUS_CFG.backlog;
}

export function dueBadge(dueDate) {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due - today) / (1000 * 60 * 60 * 24));

  if (diff < 0)  return { text: `Overdue ${Math.abs(diff)}d`, tone: 'danger' };
  if (diff === 0) return { text: 'Due today', tone: 'warning' };
  if (diff === 1) return { text: 'Due tomorrow', tone: 'warning' };
  if (diff <= 7)  return { text: `Due in ${diff}d`, tone: 'normal' };
  return { text: `Due in ${diff}d`, tone: 'muted' };
}

export default function TaskCard({ task, onEdit }) {
  const cfg = statusConfig(task.status);
  const badge = dueBadge(task.dueDate);
  const isOverdue = badge?.tone === 'danger';

  return (
    <div
      className={`group relative rounded-2xl border p-5 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden ${
        isOverdue
          ? 'bg-gradient-to-br from-redLight/60 via-white to-white border-red/30'
          : 'bg-gradient-to-br from-primary-light/30 via-white to-white border-border hover:border-primary/40'
      }`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${cfg.bar}`} />

      <div
        className="pointer-events-none absolute -top-16 -left-16 w-40 h-40 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(242,106,27,0.10) 0%, rgba(242,106,27,0) 70%)',
        }}
      />

      {isOverdue && (
        <div className="absolute inset-0 pointer-events-none rounded-2xl ring-1 ring-red/20 animate-pulse opacity-60" />
      )}

      <div className="pl-2 flex flex-col h-full relative z-[1]">
        <div className="flex items-start justify-between gap-2 mb-3">
          <span
            className={`text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}
          >
            {cfg.label.toUpperCase()}
          </span>

          {isOverdue && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-redLight text-red border border-red/30">
              OVERDUE
            </span>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(task);
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-textLight opacity-0 group-hover:opacity-100 hover:bg-white hover:text-primary transition ml-auto"
            title="Edit task"
          >
            <Pencil size={14} />
          </button>
        </div>

        <h3 className="font-bold text-textDark leading-snug mb-2 line-clamp-2">
          {task.title}
        </h3>

        {task.description && (
          <p className="text-sm text-textMedium leading-relaxed mb-3 line-clamp-2">
            {task.description}
          </p>
        )}

        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-light to-primary/30 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
            {initials(task.assigneeName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-textDark truncate">
              {task.assigneeName}
            </p>
            {task.assigneeId && (
              <p className="text-[10px] text-textLight truncate">
                {task.assigneeId}
              </p>
            )}
          </div>
        </div>

        <div className="mt-auto pt-3 border-t border-border flex items-center justify-between gap-2 flex-wrap">
          {task.dueDate ? (
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[10px] font-semibold ${
                  isOverdue ? 'text-red' : 'text-textLight'
                }`}
              >
                📅 {task.dueDate}
              </span>
              {badge && (
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                    badge.tone === 'danger'
                      ? 'bg-redLight text-red'
                      : badge.tone === 'warning'
                      ? 'bg-yellowLight text-yellow'
                      : 'bg-bg text-textMedium'
                  }`}
                >
                  {badge.text}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[10px] text-textLight">No due date</span>
          )}

          <div className="flex items-center gap-2.5 text-textLight">
            {task.attachments > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] font-semibold">
                <Paperclip size={11} /> {task.attachments}
              </span>
            )}
            {task.comments > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] font-semibold">
                <MessageSquare size={11} /> {task.comments}
              </span>
            )}
            {task.people > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] font-semibold">
                <User size={11} /> {task.people}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}