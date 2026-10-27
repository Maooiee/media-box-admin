// admin-panel/src/features/payroll/presentation/widgets/AttendanceDrilldownModal.jsx
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Edit3, CalendarX2 } from 'lucide-react';
import Modal from '../../../../shared/components/Modal';
import FilterChips from '../../../../shared/components/FilterChips';
import { SkeletonList } from '../../../../shared/components/Skeleton';
import EditAttendanceModal from '../../../attendance/presentation/widgets/EditAttendanceModal';
import { payrollRepository } from '../../data/payrollRepository';

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function hoursBetween(a, b) {
  if (!a || !b) return null;
  const ms = new Date(b) - new Date(a);
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'present', label: 'Present' },
  { key: 'late', label: 'Late' },
  { key: 'absent', label: 'Absent' },
  { key: 'leave', label: 'Leave' },
  { key: 'missing', label: 'Missing time-out' },
];

export default function AttendanceDrilldownModal({
  open,
  onClose,
  row,
  cutoff,
  initialFilter = 'all',
  onChanged,
  onToast,
  readOnly = false,
}) {
  const [daily, setDaily] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(initialFilter);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (open && row && cutoff) {
      setFilter(initialFilter || 'all');
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, row, cutoff, initialFilter]);

  async function load() {
    setLoading(true);
    try {
      const rows = await payrollRepository.fetchDailyAttendance({
        userId: row.user_id,
        from: cutoff.start,
        to: cutoff.end,
      });
      setDaily(rows);
    } catch (e) {
      onToast?.(e.message || 'Failed to load attendance', 'error');
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (filter === 'all') return daily;
    if (filter === 'missing') {
      return daily.filter((d) => d.time_in && !d.time_out);
    }
    if (filter === 'leave') {
      return daily.filter((d) => d.status === 'on_leave');
    }
    return daily.filter((d) => d.status === filter);
  }, [daily, filter]);

  const counts = useMemo(() => {
    const acc = { all: daily.length, present: 0, late: 0, absent: 0, leave: 0, missing: 0 };
    for (const d of daily) {
      if (d.status === 'present') acc.present += 1;
      else if (d.status === 'late') acc.late += 1;
      else if (d.status === 'absent') acc.absent += 1;
      else if (d.status === 'on_leave') acc.leave += 1;
      if (d.time_in && !d.time_out) acc.missing += 1;
    }
    return acc;
  }, [daily]);

  if (!open || !row) return null;

  return (
    <>
      <Modal
        open={open && !editing}
        onClose={onClose}
        title={row.full_name}
        subtitle={`${cutoff?.label} · ${row.employee_id || ''}`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-3">
          <FilterChips
            options={FILTERS.map((f) => ({ ...f, count: counts[f.key] }))}
            value={filter}
            onChange={setFilter}
          />

          {loading ? (
            <SkeletonList rows={5} />
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-border bg-bg/40 px-4 py-8 text-center">
              <CalendarX2 size={22} className="mx-auto text-textLight" />
              <p className="mt-2 text-sm font-bold text-textDark">
                Nothing matches this filter
              </p>
              <p className="mt-0.5 text-xs text-textLight">
                Try “All” to see every day in the cutoff.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-xs">
                <thead className="bg-bg text-[9px] uppercase tracking-wider text-textLight">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold">Date</th>
                    <th className="px-3 py-2 text-left font-bold">In</th>
                    <th className="px-3 py-2 text-left font-bold">Out</th>
                    <th className="px-3 py-2 text-left font-bold">Hours</th>
                    <th className="px-3 py-2 text-left font-bold">Status</th>
                    <th className="px-3 py-2 text-right font-bold">Fix</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => {
                    const missing = d.time_in && !d.time_out;
                    const synthetic = String(d.id ?? '').startsWith('leave-');
                    return (
                      <tr key={d.id ?? d.date} className="border-t border-border">
                        <td className="px-3 py-2 font-semibold text-textDark">
                          {d.date}
                        </td>
                        <td className="px-3 py-2">{fmtTime(d.time_in)}</td>
                        <td className="px-3 py-2">
                          {missing ? (
                            <span className="inline-flex items-center gap-1 font-bold text-yellow">
                              <AlertTriangle size={11} /> Missing
                            </span>
                          ) : (
                            fmtTime(d.time_out)
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {hoursBetween(d.time_in, d.time_out) ?? '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                              d.status === 'present'
                                ? 'bg-greenLight text-green'
                                : d.status === 'late'
                                  ? 'bg-yellowLight text-yellow'
                                  : d.status === 'absent'
                                    ? 'bg-redLight text-red'
                                    : d.status === 'on_leave'
                                      ? 'bg-blueLight text-blue'
                                      : 'bg-bg text-textMedium'
                            }`}
                          >
                            {d.status === 'on_leave' && d.is_paid
                              ? 'paid leave'
                              : d.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => setEditing(d)}
                            disabled={synthetic || readOnly}
                            title={
                              synthetic
                                ? 'Leave day — edit the leave request instead'
                                : 'Correct this attendance record'
                            }
                            className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] font-bold text-textMedium hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Edit3 size={10} /> Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[10px] text-textLight">
            Corrections here update the payroll calculation immediately.
          </p>
        </div>
      </Modal>

      <EditAttendanceModal
        open={!!editing}
        record={
          editing
            ? {
                id: editing.id,
                date: editing.date,
                timeIn: editing.time_in,
                timeOut: editing.time_out,
                status: editing.status,
                notes: editing.notes,
                employeeName: row.full_name,
              }
            : null
        }
        onClose={() => setEditing(null)}
        onSaved={async () => {
          await load();
          onChanged?.();
          onToast?.('Attendance corrected', 'success');
        }}
      />
    </>
  );
}
