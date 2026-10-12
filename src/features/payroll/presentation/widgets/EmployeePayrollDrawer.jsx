// admin-panel/src/features/payroll/presentation/widgets/EmployeePayrollDrawer.jsx
import { useEffect, useState } from 'react';
import { X, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { payrollRepository } from '../../data/payrollRepository';

function fmtTime(iso) {
  if (!iso) return '--';
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

export default function EmployeePayrollDrawer({
  open,
  summary,
  cutoff,
  onClose,
  onAddAdjustment,
  onToast,
}) {
  const [daily, setDaily] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && summary && cutoff) load();
  }, [open, summary, cutoff]);

  async function load() {
    setLoading(true);
    try {
      const [d, a] = await Promise.all([
        payrollRepository.fetchDailyAttendance({
          userId: summary.user_id,
          from: cutoff.start,
          to: cutoff.end,
        }),
        payrollRepository.fetchAdjustments({
          userId: summary.user_id,
          from: cutoff.start,
          to: cutoff.end,
        }),
      ]);
      setDaily(d);
      setAdjustments(a);
    } catch (e) {
      onToast?.(e.message || 'Failed to load', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    try {
      await payrollRepository.deleteAdjustment(id);
      onToast?.('Adjustment removed', 'success');
      load();
    } catch (e) {
      onToast?.(e.message || 'Failed to delete', 'error');
    }
  }

  if (!open || !summary) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl"
      >
        <div className="sticky top-0 z-10 bg-white border-b border-border px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-wider text-textLight uppercase">
              Payroll Detail
            </p>
            <h2 className="text-xl font-bold text-textDark mt-1">
              {summary.full_name}
            </h2>
            <p className="text-xs text-textLight mt-0.5">
              {summary.employee_id}
              {summary.position ? ` · ${summary.position}` : ''}
            </p>
            <p className="text-xs text-primary font-semibold mt-1">
              {cutoff.label}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-bg flex items-center justify-center text-textLight hover:text-textDark transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 p-5">
          <Stat label="Present" value={summary.days_present} tone="green" />
          <Stat label="Late" value={summary.days_late} tone="amber" />
          <Stat label="Absent" value={summary.days_absent} tone="red" />
          <Stat label="On Leave" value={summary.days_on_leave} tone="blue" />
          <Stat
            label="Missing Timeout"
            value={summary.days_missing_timeout}
            tone="amber"
          />
          <Stat
            label="Total Hours"
            value={Number(summary.total_hours_worked).toFixed(2)}
            tone="neutral"
          />
        </div>

        <div className="px-5 pb-4 flex items-center gap-2">
          <button
            onClick={onAddAdjustment}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-primary text-white text-xs font-bold hover:bg-primary-dark transition"
          >
            <Plus size={14} /> Add OT / UT
          </button>
          <span className="text-xs text-textLight">
            {summary.overtime_minutes} OT min · {summary.undertime_minutes} UT min
          </span>
        </div>

        <div className="px-5 pb-4">
          <h3 className="text-sm font-bold text-textDark mb-2">Adjustments</h3>
          {adjustments.length === 0 ? (
            <p className="text-xs text-textLight py-3">No adjustments yet.</p>
          ) : (
            <div className="space-y-2">
              {adjustments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 bg-bg rounded-xl px-3 py-2.5"
                >
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      a.kind === 'overtime'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {a.kind === 'overtime' ? 'OT' : 'UT'}
                  </span>
                  <span className="text-xs font-semibold text-textDark">
                    {a.work_date}
                  </span>
                  <span className="text-xs text-textMedium">
                    {a.minutes} min
                  </span>
                  {a.reason && (
                    <span className="text-xs text-textLight italic truncate">
                      {a.reason}
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="ml-auto text-textLight hover:text-red-600 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 pb-8">
          <h3 className="text-sm font-bold text-textDark mb-2">
            Daily Records
          </h3>
          {loading ? (
            <p className="text-xs text-textLight py-3">Loading...</p>
          ) : daily.length === 0 ? (
            <p className="text-xs text-textLight py-3">
              No attendance records in this cutoff.
            </p>
          ) : (
            <div className="bg-white rounded-2xl border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-bg text-textLight text-[10px] uppercase">
                  <tr>
                    <th className="text-left px-3 py-2 font-bold">Date</th>
                    <th className="text-left px-3 py-2 font-bold">In</th>
                    <th className="text-left px-3 py-2 font-bold">Out</th>
                    <th className="text-left px-3 py-2 font-bold">Hours</th>
                    <th className="text-left px-3 py-2 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.map((d) => {
                    const missing = d.time_in && !d.time_out;
                    return (
                      <tr key={d.id} className="border-t border-border">
                        <td className="px-3 py-2 font-semibold text-textDark">
                          {d.date}
                        </td>
                        <td className="px-3 py-2">{fmtTime(d.time_in)}</td>
                        <td className="px-3 py-2">
                          {missing ? (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                              <AlertTriangle size={11} /> Missing
                            </span>
                          ) : (
                            fmtTime(d.time_out)
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {hoursBetween(d.time_in, d.time_out) ?? '--'}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              d.status === 'present'
                                ? 'bg-emerald-50 text-emerald-700'
                                : d.status === 'late'
                                  ? 'bg-amber-50 text-amber-700'
                                  : d.status === 'absent'
                                    ? 'bg-red-50 text-red-700'
                                    : d.status === 'on_leave'
                                      ? 'bg-blue-50 text-blue-700'
                                      : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {d.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
    neutral: 'bg-white text-textDark',
  };
  return (
    <div
      className={`rounded-2xl border border-border/60 px-3 py-2.5 ${tones[tone]}`}
    >
      <p className="text-[10px] font-bold tracking-wider uppercase opacity-70">
        {label}
      </p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}