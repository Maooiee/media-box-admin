import { useEffect, useState } from 'react';
import { Save, Trash2, Type, AlignLeft, Tag } from 'lucide-react';
import Modal from '../../../../shared/components/Modal';
import Button from '../../../../shared/components/Button';
import { tasksRepository } from '../../data/tasksRepository';

const STATUSES = [
  { key: 'backlog',    label: 'Backlog',  className: 'bg-bg text-textMedium border-border' },
  { key: 'onProgress', label: 'Progress', className: 'bg-yellowLight text-yellow border-yellow/30' },
  { key: 'onHold',     label: 'Hold',     className: 'bg-redLight text-red border-red/30' },
  { key: 'done',       label: 'Done',     className: 'bg-greenLight text-green border-green/30' },
];

export default function EditTaskModal({ open, task, onClose, onSaved }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('backlog');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open && task) {
      setTitle(task.title ?? '');
      setDescription(task.description ?? '');
      setStatus(task.status ?? 'backlog');
      setError('');
      setConfirmDelete(false);
    }
  }, [open, task]);

  async function handleSave() {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await tasksRepository.updateTaskStatus(task.id, status);
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await tasksRepository.deleteTask(task.id);
      onSaved?.();
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
      title="Edit Task"
      subtitle={task?.assigneeName ? `Assigned to ${task.assigneeName}` : ''}
      maxWidth="max-w-xl"
    >
      <div className="space-y-5">
        <Field icon={Type} label="TITLE">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm font-medium text-textDark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
          />
        </Field>

        <Field icon={AlignLeft} label="DESCRIPTION">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm font-medium text-textDark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition resize-none"
          />
        </Field>

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
          <div className="p-3 rounded-xl bg-redLight text-red text-sm border border-red/20">
            {error}
          </div>
        )}

        <div className="flex justify-between gap-2 pt-3 border-t border-border -mx-6 px-6 -mb-5 pb-5 bg-gradient-to-r from-white via-white to-primary-light/15">
          <div>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold text-red hover:bg-redLight transition disabled:opacity-50"
              >
                <Trash2 size={14} />
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-red">Sure?</span>
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="px-4 py-2 rounded-full text-xs font-semibold bg-gradient-to-br from-red to-red/80 text-white shadow-md shadow-red/25 hover:shadow-red/40 transition disabled:opacity-50"
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-4 py-2 rounded-full text-xs font-semibold text-textMedium hover:bg-bg transition"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button icon={Save} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
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