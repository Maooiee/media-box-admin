import { useEffect, useMemo, useState } from 'react';
import { Plus, User, Calendar as CalendarIcon, Clock, Tag, Type, AlignLeft, X, Check } from 'lucide-react';
import Modal from '../../../../shared/components/Modal';
import Button from '../../../../shared/components/Button';
import { tasksRepository } from '../../data/tasksRepository';
import { employeesRepository } from '../../../employees/data/employeesRepository';
import { initials } from '../../../../core/utils/formatters';

const STATUSES = [
  { key: 'backlog',    label: 'Backlog',  className: 'bg-bg text-textMedium border-border' },
  { key: 'onProgress', label: 'Progress', className: 'bg-yellowLight text-yellow border-yellow/30' },
  { key: 'onHold',     label: 'Hold',     className: 'bg-redLight text-red border-red/30' },
  { key: 'done',       label: 'Done',     className: 'bg-greenLight text-green border-green/30' },
];

function toLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toLocalDateStr(d);
}

function dueCountdown(dueDate) {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due - today) / (1000 * 60 * 60 * 24));

  if (diff < 0)  return { text: `Overdue by ${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'}`, tone: 'danger' };
  if (diff === 0) return { text: 'Due today', tone: 'warning' };
  if (diff === 1) return { text: 'Due tomorrow', tone: 'warning' };
  return { text: `Due in ${diff} days`, tone: 'normal' };
}

export default function AddTaskModal({ open, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [status, setStatus] = useState('backlog');
  const [employees, setEmployees] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;

    setTitle('');
    setDescription('');
    setAssignedTo('');
    setDueDate('');
    setDueTime('');
    setStatus('backlog');
    setError('');
    setPickerOpen(false);

    (async () => {
      try {
        const raw = await employeesRepository.fetchAll();
        setEmployees(raw);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [open]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === assignedTo) ?? null,
    [employees, assignedTo]
  );

  const countdown = dueCountdown(dueDate);

  // Quick-pick chips — highlight when the current dueDate matches
  const quickPicks = [
    { label: 'Today',     value: todayPlus(0) },
    { label: 'Tomorrow',  value: todayPlus(1) },
    { label: 'This week', value: todayPlus(3) },
    { label: 'Next week', value: todayPlus(7) },
  ];

  async function handleCreate() {
    if (!title.trim() || !assignedTo) {
      setError('Title and assignee are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await tasksRepository.createTask({
        title: title.trim(),
        description: description.trim(),
        status,
        dueDate,
        dueTime,
        assignedTo,
      });
      onCreated?.();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Task"
      subtitle="Create a new task and assign it to an employee"
      maxWidth="max-w-xl"
    >
      <div className="space-y-5">
        {/* Title */}
        <Field icon={Type} label="TITLE">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Design meeting"
            className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm font-medium text-textDark placeholder:text-textLight/70 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
          />
        </Field>

        {/* Description */}
        <Field icon={AlignLeft} label="DESCRIPTION">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What needs to be done?"
            className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm font-medium text-textDark placeholder:text-textLight/70 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition resize-none"
          />
        </Field>

        {/* Assignee — rich dropdown */}
        <Field icon={User} label="ASSIGNEE">
          <div className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-white hover:border-primary/40 transition text-left"
            >
              {selectedEmployee ? (
                <>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-light to-primary/30 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                    {initials(selectedEmployee.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-textDark truncate">
                      {selectedEmployee.full_name}
                    </p>
                    <p className="text-[10px] text-textLight truncate">
                      {selectedEmployee.employee_id} · {selectedEmployee.position}
                    </p>
                  </div>
                </>
              ) : (
                <span className="text-sm text-textLight py-1.5">Choose an employee...</span>
              )}
              <svg
                className={`w-4 h-4 text-textLight transition-transform shrink-0 ${pickerOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {pickerOpen && (
              <div className="absolute z-20 top-full left-0 right-0 mt-2 bg-white border border-border rounded-2xl shadow-2xl overflow-hidden animate-[slideUp_180ms_ease-out]">
                <div className="max-h-64 overflow-y-auto p-2">
                  {employees.length === 0 ? (
                    <p className="text-sm text-textLight px-3 py-6 text-center">
                      No employees
                    </p>
                  ) : (
                    employees.map((e) => {
                      const selected = e.id === assignedTo;
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => {
                            setAssignedTo(e.id);
                            setPickerOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 p-2 rounded-xl transition text-left ${
                            selected ? 'bg-primary-light/60' : 'hover:bg-bg'
                          }`}
                        >
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-light to-primary/30 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                            {initials(e.full_name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-textDark truncate">
                              {e.full_name}
                            </p>
                            <p className="text-[10px] text-textLight truncate">
                              {e.employee_id} · {e.position}
                            </p>
                          </div>
                          {selected && (
                            <Check size={16} className="text-primary shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </Field>

        {/* Due date */}
        <Field icon={CalendarIcon} label="DUE DATE">
          {/* Quick chips */}
          <div className="flex gap-2 mb-2 flex-wrap">
            {quickPicks.map((q) => {
              const active = dueDate === q.value;
              return (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setDueDate(q.value)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition ${
                    active
                      ? 'bg-gradient-to-br from-primary to-primary-dark text-white shadow-md shadow-primary/25'
                      : 'bg-white text-textMedium border border-border hover:border-primary/40 hover:bg-primary-light/20'
                  }`}
                >
                  {q.label}
                </button>
              );
            })}
            {dueDate && (
              <button
                type="button"
                onClick={() => setDueDate('')}
                className="px-3 py-1.5 rounded-full text-[11px] font-bold text-textLight hover:text-primary transition"
              >
                Clear
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm font-medium text-textDark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
            />
            <div className="relative">
              <Clock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textLight pointer-events-none" />
              <input
                type="text"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                placeholder="e.g. 10:00 - 11:00"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-white text-sm font-medium text-textDark placeholder:text-textLight/70 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              />
            </div>
          </div>
        </Field>

        {/* Countdown hint */}
        {countdown && (
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold animate-[fadeIn_200ms_ease-out] ${
              countdown.tone === 'danger'
                ? 'bg-redLight text-red border border-red/20'
                : countdown.tone === 'warning'
                ? 'bg-yellowLight text-yellow border border-yellow/20'
                : 'bg-bg text-textMedium'
            }`}
          >
            <Clock size={12} />
            {countdown.text}
          </div>
        )}

        {/* Status picker */}
        <Field icon={Tag} label="STATUS">
          <div className="grid grid-cols-4 gap-2">
            {STATUSES.map((s) => {
              const selected = status === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStatus(s.key)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold transition border ${
                    selected
                      ? `${s.className} ring-2 ring-offset-1 ring-primary/30 shadow-sm`
                      : 'bg-white text-textLight border-border hover:border-primary/40 hover:bg-primary-light/15'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </Field>

        {error && (
          <div className="p-3 rounded-xl bg-redLight text-red text-sm flex items-center gap-2 animate-[fadeIn_200ms_ease-out] border border-red/20">
            <X size={14} />
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-3 border-t border-border -mx-6 px-6 -mb-5 pb-5 bg-gradient-to-r from-white via-white to-primary-light/15">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button icon={Plus} onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating...' : 'Create Task'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ icon: Icon, label, children }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {Icon && <Icon size={12} className="text-primary" />}
        <label className="text-[10px] font-bold tracking-wider text-textLight uppercase">
          {label}
        </label>
      </div>
      {children}
    </div>
  );
}