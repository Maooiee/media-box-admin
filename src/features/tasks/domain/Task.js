// admin-panel/src/features/tasks/domain/Task.js
export function createTask(raw) {
  return {
    id: raw.id,
    title: raw.title ?? 'Untitled',
    description: raw.description ?? '',
    status: raw.status ?? 'backlog',
    dueDate: raw.due_date,
    dueTime: raw.due_time,
    assignedTo: raw.assigned_to,
    assigneeName: raw.profiles?.full_name ?? 'Unknown',
    assigneeId: raw.profiles?.employee_id ?? '',
    assigneePosition: raw.profiles?.position ?? '',
    assignees: raw.assignees ?? [],
    attachments: raw.attachments ?? 0,
    comments: raw.comments ?? 0,
    people: raw.people ?? 0,
    createdAt: raw.created_at,
    completedAt: raw.completed_at ?? null,
  };
}

/** Minutes since this task was marked done, or null if not done. */
export function minutesSinceCompleted(task) {
  if (!task.completedAt) return null;
  const ms = Date.now() - new Date(task.completedAt).getTime();
  return Math.floor(ms / 60000);
}

/** True if the task has been done for more than `thresholdMin` minutes. */
export function isArchived(task, thresholdMin = 60) {
  const m = minutesSinceCompleted(task);
  return m !== null && m >= thresholdMin;
}

/** "2h ago", "45m ago", "just now" */
export function relativeTimeFromNow(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}