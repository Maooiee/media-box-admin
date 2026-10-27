import { useEffect, useMemo, useState } from 'react';
import { X, CalendarDays, Plus, Trash2, Pencil, Check, Star } from 'lucide-react';
import { holidaysRepository } from '../../data/holidaysRepository';
import DatePicker from '../../../../shared/components/DatePicker';
import { toManilaDate } from '../../../../core/utils/formatters';
import { SkeletonList } from '../../../../shared/components/Skeleton';

// Admin UI for the Philippine holiday calendar (public.holidays).
//   regular → 200% worked / 100% unworked
//   special → 130% worked / no pay unworked
export default function HolidaysManagerModal({ open, onClose, onSaved }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [year, setYear] = useState(String(toManilaDate().slice(0, 4)));

  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState('regular');
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await holidaysRepository.fetchAll();
      setItems(data);
      const thisYear = String(toManilaDate().slice(0, 4));
      if (!data.some((h) => h.date.startsWith(year)) && !data.some((h) => h.date.startsWith(thisYear))) {
        setYear(thisYear);
      }
    } catch (e) {
      setError(
        e.message?.includes('holidays')
          ? 'Holiday table not found — run supabase/migrations/20261024120000_payroll_foundation.sql first'
          : e.message || 'Failed to load holidays'
      );
    } finally {
      setLoading(false);
    }
  }

  const years = useMemo(() => {
    const set = new Set(items.map((h) => h.date.slice(0, 4)));
    set.add(String(toManilaDate().slice(0, 4)));
    return [...set].sort();
  }, [items]);

  const visible = useMemo(
    () => items.filter((h) => h.date.startsWith(year)).sort((a, b) => a.date.localeCompare(b.date)),
    [items, year]
  );

  function resetForm() {
    setDate('');
    setName('');
    setKind('regular');
    setEditingId(null);
    setError('');
  }

  async function handleSubmit(e) {
    e?.preventDefault();
    setError('');
    if (!date || !name.trim()) {
      setError('Date and holiday name are required');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await holidaysRepository.update(editingId, { date, name, kind });
      } else {
        await holidaysRepository.create({ date, name, kind });
      }
      resetForm();
      await load();
      onSaved?.();
    } catch (err) {
      setError(
        err.code === '23505' || /duplicate/i.test(err.message ?? '')
          ? 'A holiday already exists on that date'
          : err.message || 'Failed to save holiday'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(h) {
    if (!window.confirm(`Delete "${h.name}" (${h.date})?`)) return;
    setError('');
    try {
      await holidaysRepository.remove(h.id);
      if (editingId === h.id) resetForm();
      await load();
      onSaved?.();
    } catch (err) {
      setError(err.message || 'Failed to delete holiday');
    }
  }

  function startEdit(h) {
    setEditingId(h.id);
    setDate(h.date);
    setName(h.name);
    setKind(h.kind);
    setError('');
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4 animate-[fadeIn_150ms_ease-out]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/60 bg-white shadow-float animate-[slideUp_220ms_ease-out]"
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-5 border-b border-border/60">
          <div
            className="absolute -top-20 -right-20 w-64 h-64 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(242,106,27,0.15) 0%, rgba(242,106,27,0) 70%)',
            }}
          />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-primary rounded-2xl blur-md opacity-30" />
                <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white shadow-lg shadow-primary/25">
                  <CalendarDays size={20} strokeWidth={2.4} />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-textDark tracking-tight">
                  Philippine Holidays
                </h3>
                <p className="text-[11.5px] text-textLight mt-0.5">
                  Drives holiday pay premiums in payroll
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-bg flex items-center justify-center text-textLight hover:text-textDark transition"
            >
              <X size={16} />
            </button>
          </div>

          {/* Pay rule legend */}
          <div className="relative flex flex-wrap gap-2 mt-4">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/25">
              <Star size={10} /> REGULAR · 200% worked / 100% unworked
            </span>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              SPECIAL · 130% worked / no pay unworked
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {/* Add / edit form */}
          <form onSubmit={handleSubmit} className="space-y-3 pb-4 border-b border-border/60">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold tracking-wider text-textLight uppercase mb-1.5">
                  Date
                </label>
                <DatePicker
                  value={date}
                  onChange={setDate}
                  placeholder="Pick a date"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold tracking-wider text-textLight uppercase mb-1.5">
                  Type
                </label>
                <div className="flex gap-1.5">
                  {[
                    { k: 'regular', label: 'Regular' },
                    { k: 'special', label: 'Special' },
                  ].map((o) => (
                    <button
                      key={o.k}
                      type="button"
                      onClick={() => setKind(o.k)}
                      className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-bold border transition ${
                        kind === o.k
                          ? 'bg-primary text-white border-primary shadow-sm shadow-primary/25'
                          : 'bg-bg text-textMedium border-border hover:border-primary/40'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold tracking-wider text-textLight uppercase mb-1.5">
                Holiday name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Founding Anniversary"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-bg text-sm text-textDark placeholder:text-textLight focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-textMedium hover:bg-bg transition"
                >
                  Cancel edit
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-br from-primary to-primary/90 text-white text-sm font-bold shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-50"
              >
                {editingId ? <Check size={14} /> : <Plus size={14} />}
                {saving ? 'Saving…' : editingId ? 'Update Holiday' : 'Add Holiday'}
              </button>
            </div>
          </form>

          {/* Year filter + list */}
          <div className="flex items-center justify-between gap-3 pt-4 pb-2">
            <p className="text-[10px] font-bold tracking-[0.15em] text-textLight uppercase">
              Holidays
            </p>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border bg-bg text-xs font-bold text-textDark outline-none cursor-pointer focus:border-primary"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <SkeletonList rows={3} />
          ) : visible.length === 0 ? (
            <p className="text-xs text-textLight py-6 text-center">
              No holidays in {year} yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {visible.map((h) => (
                <li
                  key={h.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition ${
                    editingId === h.id
                      ? 'bg-primary/5 border-primary/40'
                      : 'bg-bg border-border/70 hover:border-primary/30'
                  }`}
                >
                  <span className="text-[10px] font-bold text-textLight w-[74px] shrink-0 font-mono">
                    {h.date}
                  </span>
                  <span className="flex-1 min-w-0 text-sm font-semibold text-textDark truncate">
                    {h.name}
                  </span>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${
                      h.kind === 'regular'
                        ? 'bg-primary/10 text-primary border border-primary/25'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}
                  >
                    {h.kind}
                  </span>
                  <button
                    onClick={() => startEdit(h)}
                    title="Edit"
                    className="text-textLight hover:text-primary transition shrink-0"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(h)}
                    title="Delete"
                    className="text-textLight hover:text-red-600 transition shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-bg/60 border-t border-border/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-full bg-white border border-border text-sm font-semibold text-textMedium hover:border-primary hover:text-primary transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
