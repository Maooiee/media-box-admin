// admin-panel/src/features/payroll/presentation/PayrollAdminPage.jsx
import { useEffect, useMemo, useState } from 'react';
import {
  Download,
  FileText,
  RefreshCw,
  Calendar,
  AlertTriangle,
  UserCheck,
  UserX,
  Clock,
  Briefcase,
  TrendingUp,
  TrendingDown,
  Plus,
} from 'lucide-react';
import { supabase } from '../../../core/config/supabase';
import { payrollRepository, recentCutoffs } from '../data/payrollRepository';
import { exportPayrollPDF } from '../../../core/utils/payrollPdf';
import AddAdjustmentModal from './widgets/AddAdjustmentModal';
import EmployeePayrollDrawer from './widgets/EmployeePayrollDrawer';

export default function PayrollAdminPage() {
  const cutoffs = useMemo(() => recentCutoffs(12), []);

  // Default to the cutoff containing today (falls back to newest).
  const defaultIdx = useMemo(() => {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const idx = cutoffs.findIndex((c) => iso >= c.start && iso <= c.end);
    return idx >= 0 ? idx : 0;
  }, [cutoffs]);

  const [cutoffIdx, setCutoffIdx] = useState(defaultIdx);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [drawerRow, setDrawerRow] = useState(null);
  const [adjustRow, setAdjustRow] = useState(null);
  const [toast, setToast] = useState(null);
  const [adminId, setAdminId] = useState(null);

  const cutoff = cutoffs[cutoffIdx];

  useEffect(() => {
    setCutoffIdx(defaultIdx);
  }, [defaultIdx]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAdminId(data?.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutoffIdx]);

  async function load() {
    setLoading(true);
    try {
      const data = await payrollRepository.fetchPayrollForCutoff({
        from: cutoff.start,
        to: cutoff.end,
      });
      setRows(data);
    } catch (e) {
      console.error(e);
      showToast('Failed to load payroll', 'error');
    } finally {
      setLoading(false);
    }
  }

  function showToast(message, type) {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2600);
  }

  const totals = useMemo(() => {
    const t = {
      present: 0, late: 0, absent: 0, leave: 0,
      hours: 0, ot: 0, ut: 0, missing: 0,
    };
    for (const r of rows) {
      t.present += r.days_present;
      t.late += r.days_late;
      t.absent += r.days_absent;
      t.leave += r.days_on_leave;
      t.hours += Number(r.total_hours_worked) || 0;
      t.ot += Number(r.overtime_hours) || 0;
      t.ut += Number(r.undertime_hours) || 0;
      t.missing += r.days_missing_timeout;
    }
    return t;
  }, [rows]);

  async function handleExport(mode) {
    if (rows.length === 0) {
      showToast('Nothing to export', 'error');
      return;
    }
    setExporting(true);
    try {
      const detailed = mode === 'detailed';
      await exportPayrollPDF(rows, {
        cutoffLabel: cutoff.label,
        cutoffStart: cutoff.start,
        cutoffEnd: cutoff.end,
        detailed,
        loadDaily: detailed
          ? (userId) =>
              payrollRepository.fetchDailyAttendance({
                userId,
                from: cutoff.start,
                to: cutoff.end,
              })
          : null,
        loadAdjustments: detailed
          ? (userId) =>
              payrollRepository.fetchAdjustments({
                userId,
                from: cutoff.start,
                to: cutoff.end,
              })
          : null,
      });
      showToast('PDF exported', 'success');
    } catch (e) {
      console.error(e);
      showToast('PDF export failed', 'error');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5 relative">
      <div
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full pointer-events-none opacity-40"
        style={{
          background:
            'radial-gradient(circle, rgba(242,106,27,0.15) 0%, rgba(242,106,27,0) 70%)',
        }}
      />
      <div className="relative space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-3xl font-bold text-textDark tracking-tight">
              Payroll
            </h2>
            <p className="text-sm text-textLight mt-1">
              Semi-monthly cutoff summary · printable reports
            </p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-border shadow-sm">
              <Calendar size={15} className="text-primary" />
              <select
                value={cutoffIdx}
                onChange={(e) => setCutoffIdx(Number(e.target.value))}
                className="bg-transparent text-sm font-semibold text-textDark outline-none pr-1 cursor-pointer"
              >
                {cutoffs.map((c, i) => (
                  <option key={c.start} value={i}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-semibold bg-white border border-border text-textMedium hover:border-primary hover:text-primary transition shadow-sm"
            >
              <RefreshCw size={14} /> Refresh
            </button>

            <button
              onClick={() => handleExport('summary')}
              disabled={exporting || rows.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-semibold bg-primary text-white hover:bg-primary-dark transition disabled:opacity-50 shadow-sm shadow-primary/20"
            >
              <Download size={14} /> Summary
            </button>

            <button
              onClick={() => handleExport('detailed')}
              disabled={exporting || rows.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-semibold bg-white border border-primary text-primary hover:bg-primary/5 transition disabled:opacity-50 shadow-sm"
            >
              <FileText size={14} /> Detailed
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            label="Present"
            value={totals.present}
            icon={UserCheck}
            tone="green"
          />
          <StatCard
            label="Late"
            value={totals.late}
            icon={Clock}
            tone="amber"
          />
          <StatCard
            label="Absent"
            value={totals.absent}
            icon={UserX}
            tone="red"
          />
          <StatCard
            label="On Leave"
            value={totals.leave}
            icon={Briefcase}
            tone="blue"
          />
          <StatCard
            label="Hours"
            value={totals.hours.toFixed(2)}
            icon={TrendingUp}
            tone="orange"
          />
          <StatCard
            label="OT / UT"
            value={`${totals.ot.toFixed(2)} / ${totals.ut.toFixed(2)}`}
            icon={TrendingDown}
            tone="purple"
          />
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-20 text-textLight">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-border shadow-sm">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-primary-light flex items-center justify-center mb-4">
              <FileText size={32} className="text-primary" />
            </div>
            <p className="text-base font-bold text-textDark">
              No data for this cutoff
            </p>
            <p className="text-sm text-textLight mt-1">
              Pick a different cutoff, or wait for attendance records.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-bg text-textLight text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-5 py-3.5 font-bold">Employee</th>
                    <th className="text-center px-3 py-3.5 font-bold">Present</th>
                    <th className="text-center px-3 py-3.5 font-bold">Late</th>
                    <th className="text-center px-3 py-3.5 font-bold">Absent</th>
                    <th className="text-center px-3 py-3.5 font-bold">Leave</th>
                    <th className="text-center px-3 py-3.5 font-bold">Missing</th>
                    <th className="text-right px-3 py-3.5 font-bold">Hours</th>
                    <th className="text-right px-3 py-3.5 font-bold">OT</th>
                    <th className="text-right px-3 py-3.5 font-bold">UT</th>
                    <th className="text-right px-5 py-3.5 font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.user_id}
                      className="border-t border-border hover:bg-bg/60 transition"
                    >
                      <td
                        className="px-5 py-4 cursor-pointer"
                        onClick={() => setDrawerRow(r)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/25 to-primary/5 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                            {r.full_name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-textDark truncate">
                              {r.full_name}
                            </p>
                            <p className="text-[10px] text-textLight truncate">
                              {r.employee_id}
                            </p>
                          </div>
                          {r.days_missing_timeout > 0 && (
                            <span
                              title={`${r.days_missing_timeout} day(s) with no time-out`}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0"
                            >
                              <AlertTriangle size={10} />
                              {r.days_missing_timeout}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <Pill value={r.days_present} tone="green" />
                      </td>
                      <td className="px-3 py-4 text-center">
                        <Pill value={r.days_late} tone="amber" />
                      </td>
                      <td className="px-3 py-4 text-center">
                        <Pill value={r.days_absent} tone="red" />
                      </td>
                      <td className="px-3 py-4 text-center">
                        <Pill value={r.days_on_leave} tone="blue" />
                      </td>
                      <td className="px-3 py-4 text-center text-textLight font-semibold">
                        {r.days_missing_timeout || '—'}
                      </td>
                      <td className="px-3 py-4 text-right font-bold text-textDark">
                        {Number(r.total_hours_worked).toFixed(2)}
                      </td>
                      <td className="px-3 py-4 text-right font-semibold text-emerald-600">
                        {Number(r.overtime_hours).toFixed(2)}
                      </td>
                      <td className="px-3 py-4 text-right font-semibold text-red-600">
                        {Number(r.undertime_hours).toFixed(2)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => setAdjustRow(r)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-primary px-3 py-1.5 rounded-full border border-primary/30 hover:bg-primary/5 transition"
                        >
                          <Plus size={12} /> OT/UT
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3.5 bg-bg border-t border-border text-xs text-textLight font-semibold flex items-center justify-between">
              <span>
                {rows.length} employee{rows.length === 1 ? '' : 's'}
              </span>
              <span className="text-primary font-bold">{cutoff.label}</span>
            </div>
          </div>
        )}
      </div>

      <EmployeePayrollDrawer
        open={!!drawerRow}
        summary={drawerRow}
        cutoff={cutoff}
        onClose={() => setDrawerRow(null)}
        onAddAdjustment={() => {
          const r = drawerRow;
          setDrawerRow(null);
          setAdjustRow(r);
        }}
        onToast={showToast}
      />

      <AddAdjustmentModal
        open={!!adjustRow}
        onClose={() => setAdjustRow(null)}
        userId={adjustRow?.user_id}
        employeeName={adjustRow?.full_name}
        cutoff={cutoff}
        adminId={adminId}
        onSaved={load}
        onToast={showToast}
      />

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }) {
  const tones = {
    green: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-700',
      valueColor: 'text-emerald-800',
    },
    amber: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-700',
      valueColor: 'text-amber-800',
    },
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-700',
      valueColor: 'text-red-800',
    },
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-700',
      valueColor: 'text-blue-800',
    },
    orange: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      iconBg: 'bg-orange-100',
      iconColor: 'text-primary',
      valueColor: 'text-primaryDark',
    },
    purple: {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-700',
      valueColor: 'text-purple-800',
    },
  };
  const t = tones[tone] ?? tones.orange;

  return (
    <div
      className={`${t.bg} ${t.border} border rounded-2xl p-4 flex items-center gap-3 shadow-sm`}
    >
      <div
        className={`w-10 h-10 rounded-xl ${t.iconBg} ${t.iconColor} flex items-center justify-center shrink-0`}
      >
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p
          className={`text-[10px] font-bold tracking-wider uppercase ${t.valueColor} opacity-70`}
        >
          {label}
        </p>
        <p
          className={`text-xl font-extrabold ${t.valueColor} leading-tight truncate`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function Pill({ value, tone }) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  const isZero = !value || value === 0;
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full text-xs font-bold border ${
        isZero ? 'bg-bg text-textFaint border-border' : tones[tone]
      }`}
    >
      {value}
    </span>
  );
}