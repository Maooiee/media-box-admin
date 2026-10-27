// admin-panel/src/features/tasks/presentation/TasksPage.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, LayoutGrid, List as ListIcon, History, Clock,
  CheckCircle2, AlertTriangle, CalendarClock, CheckSquare,
} from 'lucide-react';
import { tasksRepository } from '../data/tasksRepository';
import {
  createTask, isArchived, minutesSinceCompleted, relativeTimeFromNow,
} from '../domain/Task';
import { supabase } from '../../../core/config/supabase';
import PageHeader from '../../../shared/components/PageHeader';
import StatTile from '../../../shared/components/StatTile';
import SegmentedTabs from '../../../shared/components/SegmentedTabs';
import SearchField from '../../../shared/components/SearchField';
import FilterChips from '../../../shared/components/FilterChips';
import EmptyState from '../../../shared/components/EmptyState';
import { SkeletonGrid } from '../../../shared/components/Skeleton';
import AddTaskModal from './widgets/AddTaskModal';
import TaskCard from './widgets/TaskCard';
import TaskRow from './widgets/TaskRow';
import EmptyTasks from './widgets/EmptyTasks';
import EditTaskModal from './widgets/EditTaskModal';

const HISTORY_THRESHOLD_MIN = 60;
const STATUS_TABS = [
  { key: 'all',        label: 'All' },
  { key: 'backlog',    label: 'Backlog' },
  { key: 'onProgress', label: 'Progress' },
  { key: 'onHold',     label: 'On Hold' },
  { key: 'done',       label: 'Done' },
];

const SORTS = [
  { key: 'newest', label: 'Newest first' },
  { key: 'due',    label: 'Due date' },
  { key: 'title',  label: 'Title A–Z' },
];

// ─── Helpers ─────────────────────────────────────────────
function taskDueMs(task) {
  if (!task.dueDate) return null;
  const t = new Date(task.dueDate);
  t.setHours(23, 59, 59, 999);
  return t.getTime();
}
function isOverdue(task) {
  if (task.status === 'done') return false;
  const due = taskDueMs(task);
  if (!due) return false;
  return Date.now() > due;
}
function isDueSoon(task) {
  if (task.status === 'done') return false;
  const due = taskDueMs(task);
  if (!due) return false;
  const diff = due - Date.now();
  return diff > 0 && diff <= 48 * 60 * 60 * 1000;
}
function isCompletedToday(task) {
  if (!task.completedAt) return false;
  const d = new Date(task.completedAt);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

// ─────────────────────────────────────────────────────────
export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageTab, setPageTab] = useState('active');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [view, setView] = useState('grid');
  const [showAdd, setShowAdd] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [liveIndicator, setLiveIndicator] = useState(false);

  const employeesRef = useRef([]);

  useEffect(() => {
    loadTasks();
    loadEmployees();

    const channel = supabase
      .channel('tasks-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          console.log('🔔 Realtime task change:', payload.eventType);
          setLiveIndicator(true);
          setTimeout(() => setLiveIndicator(false), 800);
          loadTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadEmployees() {
    try {
      const { employeesRepository } = await import(
        '../../employees/data/employeesRepository'
      );
      const emps = await employeesRepository.fetchAll();
      employeesRef.current = emps;
    } catch (e) {
      console.warn('Failed to load employees:', e);
    }
  }

  async function loadTasks() {
    setLoading(true);
    try {
      const raw = await tasksRepository.fetchAll();
      if (employeesRef.current.length === 0) await loadEmployees();
      const emps = employeesRef.current;
      const empMap = Object.fromEntries(emps.map((e) => [e.id, e]));
      const enriched = raw.map((t) => {
        const emp = empMap[t.assigned_to];
        return {
          ...t,
          profiles: emp
            ? {
                full_name: emp.full_name,
                employee_id: emp.employee_id,
                position: emp.position,
              }
            : null,
        };
      });
      setTasks(enriched.map(createTask));
    } catch (e) {
      console.error(e);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  const { activeTasks, historyTasks } = useMemo(() => {
    const active = [];
    const history = [];
    for (const t of tasks) {
      if (isArchived(t, HISTORY_THRESHOLD_MIN)) history.push(t);
      else active.push(t);
    }
    history.sort(
      (a, b) =>
        new Date(b.completedAt ?? 0).getTime() -
        new Date(a.completedAt ?? 0).getTime()
    );
    return { activeTasks: active, historyTasks: history };
  }, [tasks]);

  const current = pageTab === 'active' ? activeTasks : historyTasks;

  const visible = useMemo(() => {
    let list = current;
    if (pageTab === 'active' && filter !== 'all') {
      list = list.filter((t) => t.status === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.title?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.assigneeName?.toLowerCase().includes(q)
      );
    }
    list = [...list];
    if (pageTab === 'history') {
      // already sorted
    } else {
      if (sort === 'newest') {
        list.sort((a, b) => {
          const ao = isOverdue(a) ? 1 : 0;
          const bo = isOverdue(b) ? 1 : 0;
          if (ao !== bo) return bo - ao;
          return new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0);
        });
      } else if (sort === 'due') {
        list.sort((a, b) => {
          const ao = isOverdue(a) ? 1 : 0;
          const bo = isOverdue(b) ? 1 : 0;
          if (ao !== bo) return bo - ao;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate) - new Date(b.dueDate);
        });
      } else if (sort === 'title') {
        list.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
      }
    }
    return list;
  }, [current, pageTab, filter, search, sort]);

  const total    = activeTasks.length;
  const backlog  = activeTasks.filter((t) => t.status === 'backlog').length;
  const progress = activeTasks.filter((t) => t.status === 'onProgress').length;
  const onHold   = activeTasks.filter((t) => t.status === 'onHold').length;
  const done     = activeTasks.filter((t) => t.status === 'done').length;

  const overdueCount = activeTasks.filter(isOverdue).length;
  const dueSoonCount = activeTasks.filter(isDueSoon).length;
  const doneTodayCount = tasks.filter(isCompletedToday).length;

  const hasFilters =
    (pageTab === 'active' && filter !== 'all') || search.trim().length > 0;

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Header */}
      <PageHeader
        section="Tasks"
        title="Tasks"
        subtitle="Manage all tasks across your team"
        icon={CheckSquare}
        action={
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 rounded-full bg-gradient-to-br from-primary to-primary-dark text-white font-semibold text-xs md:text-sm shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 transition-all"
          >
            <Plus size={14} className="md:hidden" />
            <Plus size={15} className="hidden md:block" />
            <span className="whitespace-nowrap">Add Task</span>
          </button>
        }
      />

      {/* Stats — 4 tiles on desktop, 2×2 on mobile */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        <StatTile label="Total" value={total} tone="brand" icon={<CheckSquare size={14} />} />
        <StatTile label="Overdue" value={overdueCount} tone="bad" icon={<AlertTriangle size={14} />} />
        <StatTile label="Due soon" value={dueSoonCount} tone="warn" icon={<CalendarClock size={14} />} />
        <StatTile label="Done today" value={doneTodayCount} tone="good" icon={<CheckCircle2 size={14} />} />
      </div>

      {/* Tabs + Filters */}
      <div className="space-y-2 md:space-y-0 md:flex md:items-center md:gap-3 md:flex-wrap">
        {/* Active/History tabs */}
        <SegmentedTabs
          value={pageTab}
          onChange={setPageTab}
          items={[
            { key: 'active', label: 'Active', icon: Clock, count: activeTasks.length },
            { key: 'history', label: 'History', icon: History, count: historyTasks.length },
          ]}
        />

        {/* Status chips — horizontal scroll on mobile */}
        {pageTab === 'active' && (
          <FilterChips
            options={STATUS_TABS.map((t) => ({
              ...t,
              count:
                t.key === 'all' ? total :
                t.key === 'backlog' ? backlog :
                t.key === 'onProgress' ? progress :
                t.key === 'onHold' ? onHold :
                done,
            }))}
            value={filter}
            onChange={setFilter}
          />
        )}
      </div>

      {/* Toolbar */}
      <div className="surface-toolbar space-y-2 p-2 md:flex md:flex-wrap md:items-center md:gap-2 md:space-y-0">
        {/* Search */}
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search tasks…"
          className="md:min-w-[220px] md:flex-1"
        />

        {/* Sort + View — same row on mobile */}
        <div className="flex items-center gap-2">
          {pageTab === 'active' && (
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="field-select flex-1 text-xs md:flex-none"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          )}

          <div className="inline-flex bg-white border border-border rounded-full p-0.5 shadow-sm shrink-0">
            <button
              onClick={() => setView('grid')}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                view === 'grid'
                  ? 'bg-gradient-to-br from-primary to-primary-dark text-white shadow-sm'
                  : 'text-textMedium hover:text-textDark'
              }`}
              title="Grid view"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setView('list')}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                view === 'list'
                  ? 'bg-gradient-to-br from-primary to-primary-dark text-white shadow-sm'
                  : 'text-textMedium hover:text-textDark'
              }`}
              title="List view"
            >
              <ListIcon size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Task list */}
      {loading ? (
        <SkeletonGrid count={6} />
      ) : visible.length === 0 ? (
        pageTab === 'history' ? (
          <EmptyHistory filtered={hasFilters} />
        ) : (
          <EmptyTasks onAdd={() => setShowAdd(true)} filtered={hasFilters} />
        )
      ) : pageTab === 'history' ? (
        view === 'grid' ? (
          <HistoryGrid tasks={visible} onEdit={setEditingTask} />
        ) : (
          <HistoryList tasks={visible} onEdit={setEditingTask} />
        )
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
          {visible.map((t) => (
            <TaskCard key={t.id} task={t} onEdit={setEditingTask} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((t) => (
            <TaskRow key={t.id} task={t} onEdit={setEditingTask} />
          ))}
        </div>
      )}

      <AddTaskModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={loadTasks}
      />

      {editingTask && (
        <EditTaskModal
          open={!!editingTask}
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSaved={loadTasks}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// History sub-components
// ─────────────────────────────────────────────────────────
function HistoryList({ tasks, onEdit }) {
  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <HistoryRow key={t.id} task={t} onEdit={onEdit} />
      ))}
    </div>
  );
}

function HistoryRow({ task, onEdit }) {
  const mins = minutesSinceCompleted(task);
  const isRecent = mins !== null && mins < 24 * 60;

  return (
    <div className="bg-white rounded-2xl border border-border shadow-card hover:border-primary/30 transition group">
      <div className="flex items-center gap-3 p-3 md:p-4">
        <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-greenLight flex items-center justify-center text-green shrink-0">
          <CheckCircle2 size={14} className="md:hidden" />
          <CheckCircle2 size={16} className="hidden md:block" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-textDark truncate">
              {task.title}
            </p>
            {isRecent && (
              <span className="text-[10px] font-bold text-green bg-greenLight border border-green/20 px-2 py-0.5 rounded-full">
                {relativeTimeFromNow(task.completedAt)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] md:text-[11px] text-textLight flex-wrap">
            <span className="inline-flex items-center gap-1">
              <span className="w-5 h-5 rounded-full bg-primary-light flex items-center justify-center text-primary text-[9px] font-bold">
                {task.assigneeName?.[0]?.toUpperCase() ?? '?'}
              </span>
              {task.assigneeName}
            </span>
            <span className="w-1 h-1 rounded-full bg-textLight" />
            <span>
              {new Date(task.completedAt).toLocaleString('en-PH', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>

        <button
          onClick={() => onEdit(task)}
          className="text-[11px] font-bold text-primary hover:underline md:opacity-0 md:group-hover:opacity-100 transition shrink-0"
        >
          View
        </button>
      </div>
    </div>
  );
}

function EmptyHistory({ filtered }) {
  return (
    <EmptyState
      icon={History}
      title={filtered ? 'No matching history' : 'Nothing here yet'}
      description={
        filtered
          ? 'Try a different search.'
          : 'Tasks move here 1 hour after being marked done.'
      }
    />
  );
}

function HistoryGrid({ tasks, onEdit }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
      {tasks.map((t) => (
        <HistoryCard key={t.id} task={t} onEdit={onEdit} />
      ))}
    </div>
  );
}

function HistoryCard({ task, onEdit }) {
  const mins = minutesSinceCompleted(task);
  const isRecent = mins !== null && mins < 24 * 60;

  return (
    <div className="group bg-white rounded-2xl border border-border shadow-card hover:border-green/40 hover:shadow-card-hover transition-all overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-green to-green/70" />

      <div className="p-3 md:p-4 space-y-2.5 md:space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-greenLight flex items-center justify-center text-green shrink-0">
            <CheckCircle2 size={14} className="md:hidden" />
            <CheckCircle2 size={16} className="hidden md:block" />
          </div>
          {isRecent && (
            <span className="text-[10px] font-bold text-green bg-greenLight border border-green/20 px-2 py-0.5 rounded-full shrink-0">
              {relativeTimeFromNow(task.completedAt)}
            </span>
          )}
        </div>

        <div>
          <p className="text-sm font-bold text-textDark leading-snug line-clamp-2">
            {task.title}
          </p>
          {task.description ? (
            <p className="text-[11px] text-textLight mt-1 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          ) : null}
        </div>

        <div className="border-t border-border/60" />

        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary-light flex items-center justify-center text-primary text-[9px] font-bold shrink-0">
              {task.assigneeName?.[0]?.toUpperCase() ?? '?'}
            </span>
            <span className="text-[11px] font-semibold text-textMedium truncate">
              {task.assigneeName}
            </span>
          </div>
          <p className="text-[10px] text-textLight">
            {new Date(task.completedAt).toLocaleString('en-PH', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>

        <button
          onClick={() => onEdit(task)}
          className="w-full text-[11px] font-bold text-primary hover:underline text-center md:opacity-0 md:group-hover:opacity-100 transition-opacity pt-1"
        >
          View details →
        </button>
      </div>
    </div>
  );
}