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
  Wallet,
} from 'lucide-react';
import { supabase } from '../../../core/config/supabase';
import { payrollRepository, recentCutoffs } from '../data/payrollRepository';
import { exportPayrollPDF } from '../../../core/utils/payrollPdf';
import AddAdjustmentModal from './widgets/AddAdjustmentModal';
import EmployeePayrollDrawer from './widgets/EmployeePayrollDrawer';

export default function PayrollAdminPage() {
  const cutoffs = useMemo(() => recentCutoffs(12), []);

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
    <div className="space-y-3 md:space-y-4">
      {/* ─── Header ─── */}
      <div className="bg-gradient-to-br from-primary-light/60 via-white to-white rounded-2xl border border-primary/15 shadow-card p-3 md:p-5">
        <div className="flex items-start gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white shadow-brand shrink-0">
            <Wallet size={18} className="md:hidden" />
            <Wallet size={22} className="hidden md:block" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 md:gap-2 mb-0.5 md:mb-1">
              <span className="text-[9px] md:text-[10px] font-bold tracking-[0.18em] text-primary uppercase">
                Reports
              </span>
              <span className="w-1 h-1 rounded-full bg-textFaint" />
              <span className="text-[9px] md:text-[10px] font-bold tracking-[0.18em] text-textLight uppercase">
                Payroll
              </span>
            </div>
            <h2 className="text-lg md:text-2xl font-bold text-textDark tracking-tight leading-tight truncate">
              Payroll
            </h2>
            <p className="text-[11px] md:text-xs text-textLight mt-0.5 truncate">
              Semi-monthly cutoff · printable reports
            </p>
          </div>
        </div>

        {/* Controls — stack under title on mobile, right on desktop */}
        <div className="mt-3 md:mt-4 flex flex-col md:flex-row md:items-center gap-2 md:gap-2">
          {/* Cutoff picker — full width on mobile */}
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-border shadow-sm md:min-w-[220px]">
            <Calendar size={14} className="text-primary shrink-0" />
            <select
              value={cutoffIdx}
              onChange={(e) => setCutoffIdx(Number(e.target.value))}
              className="flex-1 min-w-0 bg-transparent text-xs md:text-sm font-semibold text-textDark outline-none cursor-pointer"
            >
              {cutoffs.map((c, i) => (
                <option key={c.start} value={i}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Action buttons — 3-column grid on mobile */}
          <div className="grid grid-cols-3 md:flex md:items-center gap-1.5 md:gap-2 md:ml-auto">
            <button
              onClick={load}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 md:px-4 py-2 rounded-xl text-[11px] md:text-sm font-semibold bg-white border border-border text-textMedium hover:border-primary hover:text-primary transition shadow-sm"
            >
              <RefreshCw size={13} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={() => handleExport('summary')}
              disabled={exporting || rows.length === 0}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 md:px-4 py-2 rounded-xl text-[11px] md:text-sm font-semibold bg-gradient-to-br from-primary to-primary-dark text-white hover:shadow-lg hover:shadow-primary/30 transition disabled:opacity-50 shadow-sm shadow-primary/20"
            >
              <Download size={13} />
              <span>Summary</span>
            </button>

            <button
              onClick={() => handleExport('detailed')}
              disabled={exporting || rows.length === 0}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 md:px-4 py-2 rounded-xl text-[11px] md:text-sm font-semibold bg-white border border-primary text-primary hover:bg-primary-light/30 transition disabled:opacity-50 shadow-sm"
            >
              <FileText size={13} />
              <span className="hidden sm:inline">Detailed</span>
              <span className="sm:hidden">Detail</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Stat tiles — gradient, matches Tasks/Selfie ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
        <StatTile label="Present" value={totals.present} icon={UserCheck} tone="good" />
        <StatTile label="Late" value={totals.late} icon={Clock} tone="warn" />
        <StatTile label="Absent" value={totals.absent} icon={UserX} tone="bad" />
        <StatTile label="On Leave" value={totals.leave} icon={Briefcase} tone="info" />
        <StatTile label="Hours" value={totals.hours.toFixed(2)} icon={TrendingUp} tone="brand" />
        <StatTile
          label="OT / UT"
          value={`${totals.ot.toFixed(2)} / ${totals.ut.toFixed(2)}`}
          icon={TrendingDown}
          tone="muted"
        />
      </div>

      {/* ─── Content ─── */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <p className="text-sm text-textLight">Loading payroll...</p>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 md:py-20 px-4 md:px-6 bg-white rounded-2xl md:rounded-3xl border border-border shadow-card">
          <div className="w-16 h-16 md:w-24 md:h-24 mx-auto rounded-2xl md:rounded-3xl bg-gradient-to-br from-primary-light via-primary-light/70 to-primary/20 flex items-center justify-center mb-4 md:mb-5 shadow-lg shadow-primary/10">
            <FileText size={28} className="md:hidden text-primary" />
            <FileText size={40} className="hidden md:block text-primary" />
          </div>
          <h3 className="text-base md:text-lg font-bold text-textDark mb-1">
            No data for this cutoff
          </h3>
          <p className="text-xs md:text-sm text-textLight max-w-md mx-auto">
            Pick a different cutoff, or wait for attendance records.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden md:block bg-white rounded-2xl md:rounded-3xl border border-border shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-primary-light/40 via-primary-light/20 to-primary-light/10 text-left text-[10px] font-bold uppercase tracking-wider text-textMedium">
                    <th className="px-5 py-3.5">Employee</th>
                    <th className="text-center px-3 py-3.5">Present</th>
                    <th className="text-center px-3 py-3.5">Late</th>
                    <th className="text-center px-3 py-3.5">Absent</th>
                    <th className="text-center px-3 py-3.5">Leave</th>
                    <th className="text-center px-3 py-3.5">Missing</th>
                    <th className="text-right px-3 py-3.5">Hours</th>
                    <th className="text-right px-3 py-3.5">OT</th>
                    <th className="text-right px-3 py-3.5">UT</th>
                    <th className="text-right px-5 py-3.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.user_id}
                      className="border-t border-border hover:bg-primary-light/10 transition"
                    >
                      <td
                        className="px-5 py-4 cursor-pointer"
                        onClick={() => setDrawerRow(r)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-light to-primary/30 flex items-center justify-center text-primary text-xs font-bold shrink-0">
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
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-yellow bg-yellowLight border border-yellow/30 px-2 py-0.5 rounded-full shrink-0"
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
                      <td className="px-3 py-4 text-right font-semibold text-green">
                        {Number(r.overtime_hours).toFixed(2)}
                      </td>
                      <td className="px-3 py-4 text-right font-semibold text-red">
                        {Number(r.undertime_hours).toFixed(2)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => setAdjustRow(r)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-primary px-3 py-1.5 rounded-full border border-primary/30 hover:bg-primary-light/30 transition"
                        >
                          <Plus size={12} /> OT/UT
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3.5 bg-gradient-to-r from-primary-light/20 to-transparent border-t border-border text-xs text-textMedium font-semibold flex items-center justify-between">
              <span>
                {rows.length} employee{rows.length === 1 ? '' : 's'}
              </span>
              <span className="text-primary font-bold">{cutoff.label}</span>
            </div>
          </div>

          {/* Mobile: card list */}
          <div className="md:hidden space-y-2">
            {rows.map((r) => (
              <div
                key={r.user_id}
                className="bg-white rounded-2xl border border-border shadow-card overflow-hidden"
              >
                {/* Gradient top accent — color by status */}
                <div
                  className={`h-1 bg-gradient-to-r ${
                    r.days_absent > 0
                      ? 'from-red-400 to-red-300'
                      : r.days_late > 0
                      ? 'from-amber-400 to-amber-300'
                      : 'from-emerald-400 to-emerald-300'
                  }`}
                />

                <button
                  onClick={() => setDrawerRow(r)}
                  className="w-full text-left p-3 space-y-2.5"
                >
                  {/* Row 1: avatar + name + missing badge */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-light to-primary/30 flex items-center justify-center text-primary text-xs font-bold shrink-0 ring-2 ring-white shadow-sm">
                      {r.full_name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-textDark truncate">
                        {r.full_name}
                      </p>
                      <p className="text-[10px] text-textLight truncate">
                        {r.employee_id}
                      </p>
                    </div>
                    {r.days_missing_timeout > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-yellow bg-yellowLight border border-yellow/30 px-2 py-0.5 rounded-full shrink-0">
                        <AlertTriangle size={10} />
                        {r.days_missing_timeout}
                      </span>
                    )}
                  </div>

                  {/* Row 2: day pills + hours */}
                  <div className="grid grid-cols-5 gap-1.5">
                    <MiniTile label="Present" value={r.days_present} tone="green" />
                    <MiniTile label="Late" value={r.days_late} tone="amber" />
                    <MiniTile label="Absent" value={r.days_absent} tone="red" />
                    <MiniTile label="Leave" value={r.days_on_leave} tone="blue" />
                    <MiniTile
                      label="Hours"
                      value={Number(r.total_hours_worked).toFixed(1)}
                      tone="brand"
                    />
                  </div>

                  {/* Row 3: OT/UT */}
                  {(Number(r.overtime_hours) > 0 || Number(r.undertime_hours) > 0) && (
                    <div className="flex items-center gap-2 text-[10px] font-semibold">
                      {Number(r.overtime_hours) > 0 && (
                        <span className="text-green bg-greenLight border border-green/25 px-2 py-0.5 rounded-full">
                          OT {Number(r.overtime_hours).toFixed(2)}
                        </span>
                      )}
                      {Number(r.undertime_hours) > 0 && (
                        <span className="text-red bg-redLight border border-red/25 px-2 py-0.5 rounded-full">
                          UT {Number(r.undertime_hours).toFixed(2)}
                        </span>
                      )}
                    </div>
                  )}
                </button>

                {/* Footer action row */}
                <div className="px-3 pb-3 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-primary">
                    Tap for details →
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setAdjustRow(r);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary px-2.5 py-1 rounded-full border border-primary/30 hover:bg-primary-light/30 transition"
                  >
                    <Plus size={11} /> OT/UT
                  </button>
                </div>
              </div>
            ))}
            <p className="text-center text-[10px] text-textLight pt-2">
              {rows.length} employee{rows.length === 1 ? '' : 's'} · {cutoff.label}
            </p>
          </div>
        </>
      )}

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
          className={`fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-[80] px-4 py-2.5 rounded-2xl shadow-2xl text-xs md:text-sm font-semibold flex items-center gap-2 text-white ${
            toast.type === 'success'
              ? 'bg-gradient-to-br from-green to-green/85'
              : 'bg-gradient-to-br from-red to-red/85'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Stat tile — gradient, matches Tasks/Selfie
// ─────────────────────────────────────────────────────────────
function StatTile({ label, value, icon: Icon, tone }) {
  const tones = {
    good: 'bg-gradient-to-br from-greenLight to-greenLight/50 border-green/30 text-green',
    warn: 'bg-gradient-to-br from-yellowLight to-yellowLight/50 border-yellow/30 text-yellow',
    bad: 'bg-gradient-to-br from-redLight to-redLight/50 border-red/30 text-red',
    info: 'bg-gradient-to-br from-blueLight to-blueLight/50 border-blue/30 text-blue',
    brand: 'bg-gradient-to-br from-primary-light/70 to-primary-light/30 border-primary/25 text-textDark',
    muted: 'bg-gradient-to-br from-bg to-bg/50 border-border text-textMedium',
  };
  const iconTones = {
    good: 'bg-white/70 text-green',
    warn: 'bg-white/70 text-yellow',
    bad: 'bg-white/70 text-red',
    info: 'bg-white/70 text-blue',
    brand: 'bg-white/80 text-primary',
    muted: 'bg-white/80 text-textLight',
  };
  const t = tones[tone] ?? tones.brand;

  return (
    <div className={`rounded-xl md:rounded-2xl border shadow-card p-2.5 md:px-3.5 md:py-3 flex items-center gap-2 md:gap-3 ${t}`}>
      <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center shrink-0 ${iconTones[tone]}`}>
        <Icon size={13} className="md:hidden" />
        <Icon size={15} className="hidden md:block" />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] md:text-[10px] font-bold tracking-wider uppercase opacity-70 truncate">
          {label}
        </p>
        <p className="text-sm md:text-base font-bold leading-tight truncate">
          {value}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Pill — desktop table
// ─────────────────────────────────────────────────────────────
function Pill({ value, tone }) {
  const tones = {
    green: 'bg-greenLight text-green border-green/25',
    amber: 'bg-yellowLight text-yellow border-yellow/25',
    red: 'bg-redLight text-red border-red/25',
    blue: 'bg-blueLight text-blue border-blue/25',
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

// ─────────────────────────────────────────────────────────────
// Mini tile — mobile card grid
// ─────────────────────────────────────────────────────────────
function MiniTile({ label, value, tone }) {
  const tones = {
    green: 'bg-greenLight text-green border-green/25',
    amber: 'bg-yellowLight text-yellow border-yellow/25',
    red: 'bg-redLight text-red border-red/25',
    blue: 'bg-blueLight text-blue border-blue/25',
    brand: 'bg-primary-light text-primary border-primary/25',
  };
  const isZero = value === 0 || value === '0' || value === '0.0';
  return (
    <div
      className={`rounded-lg py-1.5 text-center border ${
        isZero ? 'bg-bg text-textFaint border-border' : tones[tone]
      }`}
    >
      <p className="text-[8px] font-bold uppercase tracking-wider opacity-70 truncate">
        {label}
      </p>
      <p className="text-xs font-bold leading-tight mt-0.5 truncate">{value}</p>
    </div>
  );
}