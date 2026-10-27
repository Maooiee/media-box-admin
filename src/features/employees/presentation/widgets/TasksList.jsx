const STATUS_CFG = {
  backlog:    { bg: 'bg-gray-100',   text: 'text-gray-700',   label: 'Backlog',     dot: 'bg-gray-400' },
  onProgress: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'On Progress', dot: 'bg-yellow-500' },
  onHold:     { bg: 'bg-red-100',    text: 'text-red-700',    label: 'On Hold',     dot: 'bg-red-500' },
  done:       { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Done',        dot: 'bg-green-500' },
};

export default function TasksList({ tasks }) {
  const open = tasks.filter((t) => t.status !== 'done');
  const completed = tasks.filter((t) => t.status === 'done');

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-bold text-textDark">Open Tasks</h3>
          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">
            {open.length}
          </span>
        </div>

        {open.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-border text-center text-textLight text-sm">
            No open tasks
          </div>
        ) : (
          <div className="space-y-3">
            {open.map((t) => <TaskRow key={t.id} task={t} />)}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-bold text-textDark">Completed</h3>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
            {completed.length}
          </span>
        </div>

        {completed.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-border text-center text-textLight text-sm">
            No completed tasks yet
          </div>
        ) : (
          <div className="space-y-3">
            {completed.map((t) => <TaskRow key={t.id} task={t} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskRow({ task }) {
  const cfg = STATUS_CFG[task.status] ?? STATUS_CFG.backlog;

  return (
    <div className="surface-card surface-card-hover flex items-start gap-4 p-4">
      <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot} mt-2 shrink-0`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h4 className="font-bold text-textDark leading-snug">{task.title}</h4>
          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${cfg.bg} ${cfg.text} whitespace-nowrap`}>
            {cfg.label}
          </span>
        </div>

        {task.description && (
          <p className="text-sm text-textMedium mt-1 leading-relaxed line-clamp-2">
            {task.description}
          </p>
        )}

        {task.due_date && (
          <p className="text-xs text-textLight mt-2">
            📅 Due <strong className="text-textMedium">{task.due_date}</strong>
            {task.due_time ? ` · ${task.due_time}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}
