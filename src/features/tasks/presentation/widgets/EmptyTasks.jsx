import { CheckSquare, Plus } from 'lucide-react';
import EmptyState from '../../../../shared/components/EmptyState';

export default function EmptyTasks({ onAdd, filtered }) {
  return (
    <EmptyState
      icon={CheckSquare}
      title={filtered ? 'No matching tasks' : 'No tasks yet'}
      description={
        filtered
          ? 'Try a different filter or search term.'
          : 'Create your first task and assign it to a team member.'
      }
      action={
        !filtered ? (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-primary to-primary-dark px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5 hover:shadow-primary/50"
          >
            <Plus size={16} />
            Add Your First Task
          </button>
        ) : null
      }
    />
  );
}
