import { CheckSquare, Plus } from 'lucide-react';

export default function EmptyTasks({ onAdd, filtered }) {
  return (
    <div className="text-center py-20 px-6 rounded-3xl bg-white border border-border shadow-card relative overflow-hidden">
      {/* Soft warm radial glow behind the icon */}
      <div
        className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[400px] h-[300px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(242,106,27,0.10) 0%, rgba(242,106,27,0) 70%)',
        }}
      />

      <div className="relative z-[1]">
        {/* Icon — larger, gradient, with glow */}
        <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-primary-light via-primary-light/70 to-primary/20 flex items-center justify-center mb-5 shadow-lg shadow-primary/10 ring-1 ring-primary/15">
          <CheckSquare size={40} className="text-primary" />
        </div>

        <h3 className="text-lg font-bold text-textDark mb-1">
          {filtered ? 'No matching tasks' : 'No tasks yet'}
        </h3>
        <p className="text-sm text-textLight max-w-md mx-auto mb-6">
          {filtered
            ? 'Try a different filter or search term.'
            : 'Create your first task and assign it to a team member.'}
        </p>

        {!filtered && (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-br from-primary to-primary-dark text-white font-semibold text-sm shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 transition-all"
          >
            <Plus size={16} />
            Add Your First Task
          </button>
        )}
      </div>
    </div>
  );
}