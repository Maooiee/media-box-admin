import { Pencil } from 'lucide-react';
import { initials } from '../../../../core/utils/formatters';
import { statusConfig, dueBadge } from './TaskCard';

export default function TaskRow({ task, onEdit }) {
  const cfg = statusConfig(task.status);
  const badge = dueBadge(task.dueDate);
  const isOverdue = badge?.tone === 'danger';

  return (
    <div
      className={`group rounded-2xl border px-5 py-3.5 shadow-card hover:shadow-card-hover transition flex items-center gap-4 ${
        isOverdue
          ? 'bg-gradient-to-r from-redLight/60 via-white to-white border-red/30'
          : 'bg-gradient-to-r from-primary-light/20 via-white to-white border-border hover:border-primary/40'
      }`}
    >
      <div className={`w-2 h-2 rounded-full ${cfg.bar} shrink-0`} />

      <div className="flex-1 min-w-0">
        <p className="font-bold text-textDark truncate flex items-center gap-2">
          {task.title}
          {isOverdue && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-redLight text-red border border-red/30 shrink-0">
              OVERDUE
            </span>
          )}
        </p>
        {task.description && (
          <p className="text-xs text-textLight truncate mt-0.5">
            {task.description}
          </p>
        )}
      </div>

      <div className="hidden md:flex items-center gap-2 w-40 shrink-0">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-light to-primary/30 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
          {initials(task.assigneeName)}
        </div>
        <span className="text-xs font-semibold text-textDark truncate">
          {task.assigneeName}
        </span>
      </div>

      <span
        className={`hidden lg:inline-block text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full border shrink-0 ${cfg.bg} ${cfg.text} ${cfg.border}`}
      >
        {cfg.label.toUpperCase()}
      </span>

      <div className="hidden lg:flex items-center gap-1.5 w-32 shrink-0 justify-end">
        {task.dueDate && (
          <>
            <span
              className={`text-[10px] font-semibold ${
                isOverdue ? 'text-red' : 'text-textLight'
              }`}
            >
              {task.dueDate}
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
          </>
        )}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onEdit?.(task);
        }}
        className="w-8 h-8 rounded-full flex items-center justify-center text-textLight hover:bg-white hover:text-primary transition shrink-0"
      >
        <Pencil size={14} />
      </button>
    </div>
  );
}