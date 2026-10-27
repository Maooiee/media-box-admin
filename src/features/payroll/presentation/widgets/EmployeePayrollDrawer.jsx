// admin-panel/src/features/payroll/presentation/widgets/EmployeePayrollDrawer.jsx
import { useEffect, useState } from 'react';
import {
  X, Plus, Trash2, AlertTriangle, Download, FileText, CalendarDays,
  Check, XCircle,
} from 'lucide-react';
import { payrollRepository } from '../../data/payrollRepository';
import { exportPayslipPDF } from '../../../../core/utils/payslipPdf';
import { peso } from '../../domain/payrollRules';
import { SkeletonList } from '../../../../shared/components/Skeleton';

const KIND_LABEL = {
  overtime: 'Overtime',
  undertime: 'Undertime',
  night_diff: 'Night diff',
  rest_day: 'Rest day',
  allowance: 'Allowance',
  bonus: 'Bonus',
  loan: 'Loan',
  cash_advance: 'Cash advance',
  other_deduction: 'Other deduction',
};

const DEDUCTION_KINDS = new Set([
  'undertime',
  'loan',
  'cash_advance',
  'other_deduction',
]);

const STATUS_STYLE = {
  pending: 'bg-yellowLight text-yellow border-yellow/25',
  approved: 'bg-greenLight text-green border-green/25',
  rejected: 'bg-redLight text-red border-red/25',
};

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
  pay = null,
  onClose,
  onAddAdjustment,
  onDetailed,
  onDrilldown,
  onToast,
  adminId = null,
  readOnly = false,
  onChanged,
}) {
  const [daily, setDaily] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (open && summary && cutoff) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setBusyId(id);
    try {
      await payrollRepository.deleteAdjustment(id, adminId);
      onToast?.('Adjustment removed', 'success');
      await load();
      onChanged?.();
    } catch (e) {
      onToast?.(e.message || 'Failed to delete', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDecision(row, status) {
    setBusyId(row.id);
    try {
      await payrollRepository.setAdjustmentStatus({
        id: row.id,
        status,
        adminId,
      });
      onToast?.(
        status === 'approved' ? 'Adjustment approved' : 'Adjustment rejected',
        'success'
      );
      await load();
      onChanged?.();
    } catch (e) {
      onToast?.(e.message || 'Failed to update adjustment', 'error');
    } finally {
      setBusyId(null);
    }
  }

  function handlePayslip() {
    try {
      exportPayslipPDF({
        summary,
        pay,
        periodLabel: cutoff.label,
        periodStart: cutoff.start,
        periodEnd: cutoff.end,
      });
      onToast?.('Payslip downloaded', 'success');
    } catch (e) {
      onToast?.(e.message || 'Failed to generate payslip', 'error');
    }
  }

  if (!open || !summary) return null;

  const pendingCount = adjustments.filter(
    (a) => (a.status ?? 'approved') === 'pending'
  ).length;

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-2xl overflow-y-auto border-l border-border bg-white shadow-float"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-white px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-textLight">
              Payroll Detail
            </p>
            <h2 className="mt-1 text-xl font-bold text-textDark">
              {summary.full_name}
            </h2>
            <p className="mt-0.5 text-xs text-textLight">
              {summary.employee_id}
              {summary.position ? ` · ${summary.position}` : ''}
              {summary.department ? ` · ${summary.department}` : ''}
            </p>
            <p className="mt-1 text-xs font-semibold text-primary">
              {cutoff.label}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-textLight transition hover:bg-bg hover:text-textDark"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 p-5">
          <Stat label="Present" value={summary.days_present} tone="green" />
          <Stat label="Late" value={summary.days_late} tone="amber" />
          <Stat label="Absent" value={summary.days_absent} tone="red" />
          <Stat
            label="Paid leave"
            value={summary.days_paid_leave ?? 0}
            tone="green"
          />
          <Stat
            label="Unpaid leave"
            value={summary.days_unpaid_leave ?? summary.days_on_leave ?? 0}
            tone="blue"
          />
          <Stat
            label="Missing timeout"
            value={summary.days_missing_timeout}
            tone="amber"
          />
          <Stat
            label="Total hours"
            value={Number(summary.total_hours_worked).toFixed(2)}
            tone="neutral"
          />
          <Stat
            label="Pending adj."
            value={pendingCount}
            tone={pendingCount > 0 ? 'amber' : 'neutral'}
          />
          <Stat
            label="13th month"
            value={pay?.thirteenthMonthAccrual ? peso(pay.thirteenthMonthAccrual) : '—'}
            tone="neutral"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
          {!readOnly && (
            <button
              onClick={onAddAdjustment}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-white transition hover:bg-primary-dark"
            >
              <Plus size={14} /> Add adjustment
            </button>
          )}
          <button
            onClick={() => onDrilldown?.()}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-2.5 text-xs font-bold text-textMedium transition hover:border-primary/40 hover:text-primary"
          >
            <CalendarDays size={13} /> Attendance
          </button>
          <span className="text-xs text-textLight">
            {summary.overtime_minutes} OT min · {summary.undertime_minutes} UT min
          </span>
        </div>

        <div className="px-5 pb-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-textDark">Pay breakdown</h3>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onDetailed?.()}
                title={`Detailed report for ${summary.full_name}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-bold text-textMedium transition hover:border-primary/40 hover:text-primary"
              >
                <FileText size={13} /> Detailed
              </button>
              {pay?.hasRate && (
                <button
                  onClick={handlePayslip}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-white px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary-light/30"
                >
                  <Download size={13} /> Payslip PDF
                </button>
              )}
            </div>
          </div>

          {!pay || !pay.hasRate ? (
            <div className="flex items-start gap-2 rounded-xl border border-yellow/30 bg-yellowLight px-3 py-2.5">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-yellow" />
              <p className="text-xs text-textMedium">
                No daily rate set for this employee. Add one in{' '}
                <span className="font-bold text-textDark">Employees → Edit</span>{' '}
                to compute pay.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-white">
              <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
                <RateCell label="Daily rate" value={peso(pay.rate)} />
                <RateCell label="Hourly" value={peso(pay.hourly)} />
                <RateCell label="Gross pay" value={peso(pay.gross)} accent />
              </div>

              <ul className="space-y-1.5 px-4 py-3">
                {pay.lines.length === 0 && (
                  <li className="text-xs text-textLight">
                    No earnings this period.
                  </li>
                )}
                {pay.lines.map((l) => (
                  <li
                    key={l.key}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="text-textMedium">{l.label}</span>
                    <span className="shrink-0 font-bold text-textDark">
                      {peso(l.amount)}
                    </span>
                  </li>
                ))}
              </ul>

              {pay.deductions.length > 0 && (
                <ul className="space-y-1.5 border-t border-border bg-red/5 px-4 py-3">
                  {pay.deductions.map((d) => (
                    <li
                      key={d.key}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="text-textMedium">{d.label}</span>
                      <span className="shrink-0 font-bold text-red">
                        − {peso(d.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="grid grid-cols-3 divide-x divide-border border-t border-border bg-gradient-to-r from-primary-light/40 to-transparent">
                <RateCell label="Gross" value={peso(pay.gross)} />
                <RateCell
                  label="Deductions"
                  value={`− ${peso(pay.totalDeductions)}`}
                  danger
                />
                <RateCell label="Net pay" value={peso(pay.net)} accent />
              </div>

              {Number(pay.gross) > 0 && Number(pay.net) <= 0 && (
                <p className="mt-2 rounded-xl border border-red/30 bg-redLight/60 px-3 py-2 text-[11px] font-semibold leading-snug text-red">
                  Deductions are{' '}
                  {peso(Number(pay.totalDeductions) - Number(pay.gross))} more
                  than gross pay, so nothing is payable for this cutoff. Review
                  the deduction lines above — this employee is skipped by the
                  bank export.
                </p>
              )}
            </div>
          )}

          {pay?.hasRate && (
            <div className="mt-2 space-y-1 text-[11px] text-textLight">
              {pay.paidLeaveDays > 0 && (
                <p>
                  {pay.paidLeaveDays} paid leave day
                  {pay.paidLeaveDays === 1 ? '' : 's'} included at the daily rate.
                </p>
              )}
              {pay.unpaidLeaveDays > 0 && (
                <p>
                  {pay.unpaidLeaveDays} unpaid leave day
                  {pay.unpaidLeaveDays === 1 ? '' : 's'} excluded from pay.
                </p>
              )}
              {pay.thirteenthMonthAccrual > 0 && (
                <p>
                  13th month accrual for this period:{' '}
                  <span className="font-semibold text-textDark">
                    {peso(pay.thirteenthMonthAccrual)}
                  </span>
                </p>
              )}
              {pay.employerContributionTotal > 0 && (
                <p>
                  Employer contributions (company share):{' '}
                  <span className="font-semibold text-textDark">
                    {peso(pay.employerContributionTotal)}
                  </span>
                </p>
              )}
              {pendingCount > 0 && (
                <p className="font-semibold text-yellow">
                  {pendingCount} pending adjustment
                  {pendingCount === 1 ? '' : 's'} excluded from pay until approved.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="px-5 pb-4">
          <h3 className="mb-2 text-sm font-bold text-textDark">Adjustments</h3>
          {adjustments.length === 0 ? (
            <p className="py-3 text-xs text-textLight">No adjustments yet.</p>
          ) : (
            <div className="space-y-2">
              {adjustments.map((a) => {
                const status = a.status ?? 'approved';
                const isDeduction = DEDUCTION_KINDS.has(a.kind);
                return (
                  <div
                    key={a.id}
                    className="rounded-xl border border-border bg-bg px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isDeduction
                            ? 'bg-redLight text-red'
                            : 'bg-greenLight text-green'
                        }`}
                      >
                        {KIND_LABEL[a.kind] ?? a.kind}
                      </span>
                      <span className="text-xs font-semibold text-textDark">
                        {a.work_date}
                      </span>
                      <span className="text-xs text-textMedium">
                        {a.amount != null && Number(a.amount) > 0
                          ? peso(a.amount)
                          : `${a.minutes} min`}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${
                          STATUS_STYLE[status] ?? STATUS_STYLE.approved
                        }`}
                      >
                        {status}
                      </span>
                      {a.reason && (
                        <span className="truncate text-xs italic text-textLight">
                          {a.reason}
                        </span>
                      )}

                      <div className="ml-auto flex items-center gap-1.5">
                        {!readOnly && status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleDecision(a, 'approved')}
                              disabled={busyId === a.id}
                              title="Approve"
                              className="inline-flex items-center gap-1 rounded-full border border-green/30 bg-greenLight/60 px-2 py-1 text-[10px] font-bold text-green transition hover:bg-greenLight disabled:opacity-50"
                            >
                              <Check size={10} /> Approve
                            </button>
                            <button
                              onClick={() => handleDecision(a, 'rejected')}
                              disabled={busyId === a.id}
                              title="Reject"
                              className="inline-flex items-center gap-1 rounded-full border border-red/30 bg-redLight/60 px-2 py-1 text-[10px] font-bold text-red transition hover:bg-redLight disabled:opacity-50"
                            >
                              <XCircle size={10} /> Reject
                            </button>
                          </>
                        )}
                        {!readOnly && (
                          <button
                            onClick={() => handleDelete(a.id)}
                            disabled={busyId === a.id}
                            title="Delete adjustment"
                            className="text-textLight transition hover:text-red disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-5 pb-8">
          <h3 className="mb-2 text-sm font-bold text-textDark">Daily records</h3>
          {loading ? (
            <SkeletonList rows={3} />
          ) : daily.length === 0 ? (
            <p className="py-3 text-xs text-textLight">
              No attendance records in this cutoff.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-white">
              <table className="w-full text-xs">
                <thead className="bg-bg text-[10px] uppercase text-textLight">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold">Date</th>
                    <th className="px-3 py-2 text-left font-bold">In</th>
                    <th className="px-3 py-2 text-left font-bold">Out</th>
                    <th className="px-3 py-2 text-left font-bold">Hours</th>
                    <th className="px-3 py-2 text-left font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.map((d) => {
                    const missing = d.time_in && !d.time_out;
                    const label =
                      d.status === 'on_leave'
                        ? d.is_paid
                          ? 'Paid leave'
                          : 'Unpaid leave'
                        : d.status;
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
                          {hoursBetween(d.time_in, d.time_out) ?? '--'}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              d.status === 'present'
                                ? 'bg-greenLight text-green'
                                : d.status === 'late'
                                  ? 'bg-yellowLight text-yellow'
                                  : d.status === 'absent'
                                    ? 'bg-redLight text-red'
                                    : d.status === 'on_leave'
                                      ? d.is_paid
                                        ? 'bg-greenLight text-green'
                                        : 'bg-blueLight text-blue'
                                      : 'bg-bg text-textMedium'
                            }`}
                          >
                            {label}
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

function RateCell({ label, value, accent = false, danger = false }) {
  return (
    <div className="px-4 py-2.5">
      <p className="text-[9px] font-bold uppercase tracking-wider text-textLight opacity-80">
        {label}
      </p>
      <p
        className={`mt-0.5 text-sm font-bold ${
          accent ? 'text-primary' : danger ? 'text-red' : 'text-textDark'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Stat({ label, value, tone }) {
  const tones = {
    green: 'bg-greenLight text-green',
    amber: 'bg-yellowLight text-yellow',
    red: 'bg-redLight text-red',
    blue: 'bg-blueLight text-blue',
    neutral: 'bg-white text-textDark',
  };
  return (
    <div
      className={`rounded-2xl border border-border/60 px-3 py-2.5 ${tones[tone]}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold">{value}</p>
    </div>
  );
}
