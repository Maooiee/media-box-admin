import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  FileText,
  RefreshCw,
  Calendar,
  CalendarDays,
  AlertTriangle,
  UserCheck,
  UserX,
  Clock,
  Briefcase,
  TrendingUp,
  Plus,
  Wallet,
  ChevronDown,
  Check,
  Settings2,
  History,
  BarChart3,
  ShieldCheck,
  Lock,
  ClipboardCheck,
  CalendarRange,
  X,
  Landmark,
} from 'lucide-react';
import { supabase } from '../../../core/config/supabase';
import {
  payrollRepository,
  recentCutoffs,
  recentWeeklyCutoffs,
} from '../data/payrollRepository';
import { holidaysRepository } from '../data/holidaysRepository';
import { computeEmployeePay } from '../domain/payrollCalc';
import { peso } from '../domain/payrollRules';
import { toManilaDate } from '../../../core/utils/formatters';
import { exportPayrollPDF } from '../../../core/utils/payrollPdf';
import { exportPayrollCSV, exportBankCSV } from '../../../core/utils/csv';
import AddAdjustmentModal from './widgets/AddAdjustmentModal';
import EmployeePayrollDrawer from './widgets/EmployeePayrollDrawer';
import HolidaysManagerModal from './widgets/HolidaysManagerModal';
import PayrollSettingsModal from './widgets/PayrollSettingsModal';
import FinalizeRunModal from './widgets/FinalizeRunModal';
import PayrollHistoryModal from './widgets/PayrollHistoryModal';
import AttendanceDrilldownModal from './widgets/AttendanceDrilldownModal';
import AdjustmentApprovalModal from './widgets/AdjustmentApprovalModal';
import PayrollReportsModal from './widgets/PayrollReportsModal';
import PayrollAuditModal from './widgets/PayrollAuditModal';
import PageHeader from '../../../shared/components/PageHeader';
import StatTile from '../../../shared/components/StatTile';
import EmptyState from '../../../shared/components/EmptyState';
import SegmentedTabs from '../../../shared/components/SegmentedTabs';
import SearchField from '../../../shared/components/SearchField';
import FilterChips from '../../../shared/components/FilterChips';
import SectionCard from '../../../shared/components/SectionCard';
import DatePicker from '../../../shared/components/DatePicker';
import Toast from '../../../shared/components/Toast';
import { SkeletonTable } from '../../../shared/components/Skeleton';

const PERIOD_STORAGE_KEY = 'payroll_period_mode';
const WARNING_FLAGS = ['no_rate', 'negative', 'missing', 'pending', 'no_bank'];

function rangeLabel(start, end) {
  const fmt = (iso, opts) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-PH', {
      timeZone: 'UTC',
      ...opts,
    });
  return `${fmt(start, { month: 'short', day: 'numeric' })} – ${fmt(end, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
}

function rowHasFlag(row, flag, payMap) {
  if (flag === 'no_rate') return !payMap[row.user_id]?.hasRate;
  if (flag === 'negative') {
    const p = payMap[row.user_id];
    return !!p?.hasRate && Number(p.gross) > 0 && Number(p.net) <= 0;
  }
  if (flag === 'missing') return (Number(row.days_missing_timeout) || 0) > 0;
  if (flag === 'pending') return (Number(row.pending_adjustments) || 0) > 0;
  if (flag === 'no_bank')
    return !String(row.bank_account_number ?? '').trim();
  return true;
}

export default function PayrollAdminPage() {
  // 'weekly' (Mon–Sun, how the company pays) or 'semi-monthly' (legacy cutoffs)
  const [periodMode, setPeriodMode] = useState(
    () => localStorage.getItem(PERIOD_STORAGE_KEY) ?? 'weekly'
  );

  const cutoffs = useMemo(
    () =>
      periodMode === 'weekly'
        ? recentWeeklyCutoffs(16)
        : recentCutoffs(12),
    [periodMode]
  );

  const defaultIdx = useMemo(() => {
    const iso = toManilaDate();
    const idx = cutoffs.findIndex((c) => iso >= c.start && iso <= c.end);
    return idx >= 0 ? idx : 0;
  }, [cutoffs]);

  const [cutoffIdx, setCutoffIdx] = useState(defaultIdx);
  const [customRange, setCustomRange] = useState(null);
  const [cutoffOpen, setCutoffOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [customError, setCustomError] = useState('');

  const cutoff = customRange ?? cutoffs[cutoffIdx] ?? cutoffs[0];

  const [rows, setRows] = useState([]);
  const [payMap, setPayMap] = useState({});
  const [settings, setSettings] = useState(null);
  const [settingsAvailable, setSettingsAvailable] = useState(true);
  const [run, setRun] = useState(null);
  const [role, setRole] = useState({ role: 'admin', isAdmin: true });
  const [setupMissing, setSetupMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [drawerRow, setDrawerRow] = useState(null);
  const [adjustRow, setAdjustRow] = useState(null);
  const [drillRow, setDrillRow] = useState(null);
  const [drillFilter, setDrillFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const [adminId, setAdminId] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(() => new Set());
  const [showHolidays, setShowHolidays] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showApprovals, setShowApprovals] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showFinalize, setShowFinalize] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const cutoffRef = useRef(null);
  const toolsRef = useRef(null);

  const readOnly = role.role === 'viewer';
  const locked = run?.status === 'finalized' || run?.status === 'paid';
  const canEdit = !readOnly && !locked;

  // Close the cutoff / tools dropdowns when clicking anywhere outside them.
  useEffect(() => {
    if (!cutoffOpen && !toolsOpen) return;
    function onClick(e) {
      if (cutoffRef.current && !cutoffRef.current.contains(e.target)) {
        setCutoffOpen(false);
      }
      if (toolsRef.current && !toolsRef.current.contains(e.target)) {
        setToolsOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [cutoffOpen, toolsOpen]);

  useEffect(() => {
    setCutoffIdx(defaultIdx);
  }, [defaultIdx]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAdminId(data?.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!adminId) return;
    let cancelled = false;
    payrollRepository.fetchPayrollRole(adminId).then((result) => {
      if (!cancelled) setRole(result);
    });
    return () => {
      cancelled = true;
    };
  }, [adminId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutoff.start, cutoff.end]);

  useEffect(() => {
    setSelected(new Set());
  }, [cutoff.start, cutoff.end]);

  function changePeriodMode(mode) {
    setPeriodMode(mode);
    localStorage.setItem(PERIOD_STORAGE_KEY, mode);
    setCustomRange(null);
    setCustomOpen(false);
    setCustomError('');
  }

  function showToast(message, type) {
    setToast({ message, type });
    // Long diagnostics need longer on screen; a fixed 2.8s hides the reason
    // before it can be read.
    const ms = (message?.length ?? 0) > 120 ? 7000 : 2800;
    setTimeout(() => setToast(null), ms);
  }

  async function load() {
    if (!cutoff?.start) return;
    setLoading(true);
    try {
      const data = await payrollRepository.fetchPayrollRows({
        from: cutoff.start,
        to: cutoff.end,
      });

      // Holidays drive the premiums — but keep payroll usable even if the
      // migration creating the table has not been run yet.
      let holidays = [];
      let holidaysAvailable = true;
      try {
        holidays = await holidaysRepository.fetchRange(cutoff.start, cutoff.end);
      } catch {
        holidaysAvailable = false;
      }
      setSetupMissing(
        !data.ratesAvailable ||
          !holidaysAvailable ||
          !data.settingsAvailable ||
          !data.adjustmentsAvailable
      );

      const recordsByUser = new Map();
      for (const a of data.attendance) {
        if (!recordsByUser.has(a.user_id)) recordsByUser.set(a.user_id, []);
        recordsByUser.get(a.user_id).push(a);
      }
      const recurringByUser = new Map();
      for (const d of data.recurringDeductions ?? []) {
        if (!recurringByUser.has(d.user_id)) recurringByUser.set(d.user_id, []);
        recurringByUser.get(d.user_id).push(d);
      }
      const holidaysByDate = holidaysRepository.toMap(holidays);

      const map = {};
      for (const r of data.rows) {
        map[r.user_id] = computeEmployeePay({
          dailyRate: r.daily_rate,
          records: recordsByUser.get(r.user_id) ?? [],
          holidaysByDate,
          otHours: r.overtime_hours,
          utHours: r.undertime_hours,
          allowanceAmount: r.allowance_amount,
          bonusAmount: r.bonus_amount,
          otherDeductionAmount: r.other_deduction_amount,
          nightDiffAdjustmentHours: r.night_diff_hours,
          restDayAdjustmentHours: r.rest_day_hours,
          recurringDeductions: recurringByUser.get(r.user_id) ?? [],
          restDay: r.rest_day,
          settings: data.settings,
          periodStart: cutoff.start,
          periodEnd: cutoff.end,
        });
      }

      setPayMap(map);
      setRows(data.rows);
      setSettings(data.settings);
      setSettingsAvailable(data.settingsAvailable);

      const runRow = await payrollRepository.fetchRunForPeriod({
        from: cutoff.start,
        to: cutoff.end,
      });
      setRun(runRow);
    } catch (e) {
      console.error(e);
      showToast('Failed to load payroll', 'error');
    } finally {
      setLoading(false);
    }
  }

  const totals = useMemo(() => {
    const t = {
      present: 0,
      late: 0,
      absent: 0,
      leave: 0,
      paidLeave: 0,
      unpaidLeave: 0,
      hours: 0,
      ot: 0,
      ut: 0,
      missing: 0,
      gross: 0,
      deductions: 0,
      net: 0,
      thirteenth: 0,
      employer: 0,
      pending: 0,
    };
    for (const r of rows) {
      t.present += Number(r.days_present) || 0;
      t.late += Number(r.days_late) || 0;
      t.absent += Number(r.days_absent) || 0;
      t.leave += Number(r.days_on_leave) || 0;
      t.paidLeave += Number(r.days_paid_leave) || 0;
      t.unpaidLeave += Number(r.days_unpaid_leave) || 0;
      t.hours += Number(r.total_hours_worked) || 0;
      t.ot += Number(r.overtime_hours) || 0;
      t.ut += Number(r.undertime_hours) || 0;
      t.missing += Number(r.days_missing_timeout) || 0;
      t.pending += Number(r.pending_adjustments) || 0;
      const p = payMap[r.user_id];
      t.gross += Number(p?.gross) || 0;
      t.deductions += Number(p?.totalDeductions) || 0;
      t.net += Number(p?.net) || 0;
      t.thirteenth += Number(p?.thirteenthMonthAccrual) || 0;
      t.employer += Number(p?.employerContributionTotal) || 0;
    }
    return t;
  }, [rows, payMap]);

  const warningCounts = useMemo(() => {
    const counts = { no_rate: 0, negative: 0, missing: 0, pending: 0, no_bank: 0 };
    for (const r of rows) {
      for (const flag of WARNING_FLAGS) {
        if (rowHasFlag(r, flag, payMap)) counts[flag] += 1;
      }
    }
    return counts;
  }, [rows, payMap]);

  const warningsRowCount = useMemo(
    () =>
      rows.filter((r) =>
        WARNING_FLAGS.some((flag) => rowHasFlag(r, flag, payMap))
      ).length,
    [rows, payMap]
  );

  const filteredRows = useMemo(() => {
    let list = rows;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [r.full_name, r.employee_id, r.department, r.position].some((value) =>
          String(value ?? '').toLowerCase().includes(q)
        )
      );
    }
    if (statusFilter === 'warnings') {
      list = list.filter((r) =>
        WARNING_FLAGS.some((flag) => rowHasFlag(r, flag, payMap))
      );
    } else if (statusFilter !== 'all') {
      list = list.filter((r) => rowHasFlag(r, statusFilter, payMap));
    }
    return list;
  }, [rows, search, statusFilter, payMap]);

  const filteredTotals = useMemo(() => {
    const t = { gross: 0, deductions: 0, net: 0, thirteenth: 0 };
    for (const r of filteredRows) {
      const p = payMap[r.user_id];
      t.gross += Number(p?.gross) || 0;
      t.deductions += Number(p?.totalDeductions) || 0;
      t.net += Number(p?.net) || 0;
      t.thirteenth += Number(p?.thirteenthMonthAccrual) || 0;
    }
    return t;
  }, [filteredRows, payMap]);

  const selectedRows = useMemo(
    () => rows.filter((r) => selected.has(r.user_id)),
    [rows, selected]
  );

  const allSelected =
    filteredRows.length > 0 &&
    filteredRows.every((r) => selected.has(r.user_id));

  function toggleSelect(userId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        filteredRows.forEach((r) => next.delete(r.user_id));
      } else {
        filteredRows.forEach((r) => next.add(r.user_id));
      }
      return next;
    });
  }

  function applyCustomRange() {
    if (!customStart || !customEnd) {
      setCustomError('Pick both a start and an end date.');
      return;
    }
    if (customStart > customEnd) {
      setCustomError('Start date must be on or before the end date.');
      return;
    }
    setCustomRange({
      start: customStart,
      end: customEnd,
      label: rangeLabel(customStart, customEnd),
    });
    setCutoffOpen(false);
    setCustomOpen(false);
    setCustomError('');
  }

  function clearCustomRange() {
    setCustomRange(null);
    setCustomOpen(false);
    setCustomStart('');
    setCustomEnd('');
    setCustomError('');
  }

  async function handleExport(mode, onlyRow = null, explicitRows = null) {
    const exportRows = onlyRow
      ? [onlyRow]
      : explicitRows ?? filteredRows;
    if (exportRows.length === 0) {
      showToast('Nothing to export', 'error');
      return;
    }
    setExporting(true);
    try {
      const detailed = mode === 'detailed';
      await exportPayrollPDF(exportRows, {
        cutoffLabel: cutoff.label,
        cutoffStart: cutoff.start,
        cutoffEnd: cutoff.end,
        detailed,
        payMap,
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
      showToast(
        detailed && onlyRow
          ? `Detailed report exported for ${onlyRow.full_name}`
          : 'PDF exported',
        'success'
      );
    } catch (e) {
      console.error(e);
      showToast('PDF export failed', 'error');
    } finally {
      setExporting(false);
    }
  }

  function handleExportCSV(list = filteredRows) {
    const count = exportPayrollCSV(list, payMap, {
      periodLabel: cutoff.label,
      periodStart: cutoff.start,
      periodEnd: cutoff.end,
    });
    showToast(
      count > 0
        ? `Payroll CSV exported (${count} employee${count === 1 ? '' : 's'})`
        : 'Nothing to export',
      count > 0 ? 'success' : 'error'
    );
  }

  function handleExportBank(list = filteredRows) {
    const result = exportBankCSV(list, payMap, {
      periodLabel: cutoff.label,
      periodStart: cutoff.start,
      periodEnd: cutoff.end,
    });

    if (result.count > 0) {
      const skipped = result.total - result.count;
      showToast(
        `Bank transfer file exported (${result.count} employee${
          result.count === 1 ? '' : 's'
        }${skipped > 0 ? `, ${skipped} skipped` : ''})`,
        'success'
      );
      return;
    }

    if (result.total === 0) {
      showToast('No employees to export for this period', 'error');
      return;
    }

    // The export follows the current view. If the view is filtered (for
    // example the "No bank" queue), eligible employees may simply be hidden.
    const hiddenEligible = rows.filter(
      (r) =>
        String(r.bank_account_number ?? '').trim() &&
        Number(payMap?.[r.user_id]?.net) > 0
    ).length;

    if (hiddenEligible > 0) {
      showToast(
        `${hiddenEligible} employee${
          hiddenEligible === 1 ? ' is' : 's are'
        } ready for bank transfer but hidden by the current filter or search. Clear it and export again.`,
        'error'
      );
      return;
    }

    if (result.withBank === 0) {
      showToast(
        'No employees have a bank account number for this period. Add one in Employees → Edit → Bank details.',
        'error'
      );
      return;
    }

    // Bank details exist, but the bank file only includes positive net pay.
    const blocked = result.blocked ?? [];
    const detail = blocked
      .slice(0, 3)
      .map((b) =>
        b.reason === 'deductions exceed gross pay' && b.gross > 0
          ? `${b.name} — deductions ${peso(b.deductions)} exceed gross pay ${peso(
              b.gross
            )}`
          : `${b.name} — ${b.reason}`
      )
      .join('; ');

    // If someone else is actually payable but has no account number, say so:
    // that is nearly always the real fix.
    const needsBank = (result.missingBankPayable ?? []).slice(0, 3);
    const bankHint = needsBank.length
      ? ` ${needsBank
          .map((b) => `${b.name} (${peso(b.net)})`)
          .join(', ')} ${
          needsBank.length === 1 ? 'has' : 'have'
        } net pay but no bank account number — add it in Employees → Edit → Bank details.`
      : '';

    showToast(
      detail
        ? `Bank details found for ${result.withBank} employee${
            result.withBank === 1 ? '' : 's'
          }, but none have a positive net pay: ${detail}.${bankHint}`
        : `Bank details found for ${result.withBank} employee${
            result.withBank === 1 ? '' : 's'
          }, but none have a positive net pay for this period.${bankHint}`,
      'error'
    );
  }

  async function handleReprint({ run: historyRun, rows: snapshotRows }) {
    try {
      const snapshotPay = {};
      for (const r of snapshotRows) {
        snapshotPay[r.user_id] = r.pay ?? {};
      }
      await exportPayrollPDF(snapshotRows, {
        cutoffLabel:
          historyRun.period_label ||
          rangeLabel(historyRun.period_start, historyRun.period_end),
        cutoffStart: historyRun.period_start,
        cutoffEnd: historyRun.period_end,
        detailed: false,
        payMap: snapshotPay,
      });
      showToast('Payroll run reprinted', 'success');
    } catch (e) {
      showToast(e.message || 'Failed to reprint payroll', 'error');
    }
  }

  const filterOptions = [
    { key: 'all', label: 'All', count: rows.length },
    { key: 'warnings', label: 'Warnings', count: warningsRowCount },
    { key: 'pending', label: 'Pending', count: warningCounts.pending },
    { key: 'no_rate', label: 'No rate', count: warningCounts.no_rate },
    { key: 'negative', label: 'Over-deducted', count: warningCounts.negative },
    { key: 'missing', label: 'Missing out', count: warningCounts.missing },
    { key: 'no_bank', label: 'No bank', count: warningCounts.no_bank },
  ];

  return (
    <div className="space-y-3 md:space-y-4">
      {/* ─── Header ─── */}
      <PageHeader
        section="Payroll"
        title="Payroll"
        subtitle={`${periodMode === 'weekly' ? 'Weekly pay · Mon–Sun' : 'Semi-monthly cutoff'} · printable reports`}
        icon={Wallet}
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-2">
          {/* Cutoff picker — full width on mobile */}
          <div
            ref={cutoffRef}
            className="relative flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 shadow-sm transition duration-200 focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/10 md:min-w-[220px]"
          >
            <Calendar size={14} className="shrink-0 text-primary" />
            <button
              type="button"
              onClick={() => setCutoffOpen((o) => !o)}
              className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 text-left"
            >
              <span className="truncate text-xs font-semibold text-textDark md:text-sm">
                {cutoff?.label}
              </span>
              <ChevronDown
                size={14}
                className={`shrink-0 text-textLight transition-transform ${cutoffOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {cutoffOpen && (
              <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-border bg-white shadow-2xl animate-[slideUp_180ms_ease-out]">
                <div className="hide-scrollbar max-h-64 overflow-y-auto p-2">
                  {cutoffs.map((c, i) => {
                    const selectedCutoff =
                      !customRange && i === cutoffIdx;
                    return (
                      <button
                        key={c.start}
                        type="button"
                        onClick={() => {
                          setCustomRange(null);
                          setCutoffIdx(i);
                          setCutoffOpen(false);
                        }}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition ${
                          selectedCutoff ? 'bg-primary-light/60' : 'hover:bg-bg'
                        }`}
                      >
                        <span
                          className={`text-xs font-semibold md:text-sm ${
                            selectedCutoff ? 'text-primary' : 'text-textDark'
                          }`}
                        >
                          {c.label}
                        </span>
                        {selectedCutoff && (
                          <Check size={14} className="shrink-0 text-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="border-t border-border p-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!customOpen) {
                        setCustomStart(cutoff?.start ?? '');
                        setCustomEnd(cutoff?.end ?? '');
                        setCustomError('');
                      }
                      setCustomOpen((v) => !v);
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${
                      customRange
                        ? 'bg-primary-light/60 text-primary'
                        : 'text-textMedium hover:bg-bg'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarRange size={13} />
                      Custom range
                    </span>
                    <ChevronDown
                      size={13}
                      className={`transition-transform ${customOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {customOpen && (
                    <div className="mt-2 space-y-2 rounded-xl border border-border bg-bg/50 p-2">
                      <DatePicker
                        value={customStart}
                        onChange={setCustomStart}
                        placeholder="Start date"
                      />
                      <DatePicker
                        value={customEnd}
                        onChange={setCustomEnd}
                        placeholder="End date"
                      />
                      {customError && (
                        <p className="text-[10px] font-semibold text-red">
                          {customError}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={applyCustomRange}
                          className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-primary-dark"
                        >
                          Apply range
                        </button>
                        {customRange && (
                          <button
                            type="button"
                            onClick={clearCustomRange}
                            className="rounded-lg border border-border bg-white px-3 py-1.5 text-[11px] font-bold text-textMedium transition hover:border-red/40 hover:text-red"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Period length toggle */}
          <SegmentedTabs
            value={periodMode}
            onChange={changePeriodMode}
            items={[
              { key: 'weekly', label: 'Weekly' },
              { key: 'semi', label: 'Semi-monthly' },
            ]}
          />

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-1.5 md:ml-auto md:gap-2">
            <button
              onClick={load}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-white px-2.5 py-2 text-[11px] font-semibold text-textMedium shadow-sm transition hover:border-primary hover:text-primary md:px-4 md:text-sm"
            >
              <RefreshCw size={13} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={() => setShowHolidays(true)}
              disabled={readOnly}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-white px-2.5 py-2 text-[11px] font-semibold text-textMedium shadow-sm transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 md:px-4 md:text-sm"
            >
              <CalendarDays size={13} />
              <span>Holidays</span>
            </button>

            <button
              onClick={() => setShowApprovals(true)}
              disabled={readOnly}
              className="relative inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-white px-2.5 py-2 text-[11px] font-semibold text-textMedium shadow-sm transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 md:px-4 md:text-sm"
            >
              <ClipboardCheck size={13} />
              <span>Approvals</span>
              {totals.pending > 0 && (
                <span className="inline-flex min-w-[16px] items-center justify-center rounded-full bg-yellow px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
                  {totals.pending}
                </span>
              )}
            </button>

            <div ref={toolsRef} className="relative">
              <button
                onClick={() => setToolsOpen((o) => !o)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-white px-2.5 py-2 text-[11px] font-semibold text-textMedium shadow-sm transition hover:border-primary hover:text-primary md:px-4 md:text-sm"
              >
                <Settings2 size={13} />
                <span>Tools</span>
                <ChevronDown
                  size={12}
                  className={`transition-transform ${toolsOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {toolsOpen && (
                <div className="absolute right-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-2xl border border-border bg-white p-1.5 shadow-2xl animate-[slideUp_160ms_ease-out]">
                  {[
                    { key: 'settings', label: 'Payroll settings', icon: Settings2, onClick: () => setShowSettings(true) },
                    { key: 'history', label: 'Payroll history', icon: History, onClick: () => setShowHistory(true) },
                    { key: 'reports', label: 'Reports & exports', icon: BarChart3, onClick: () => setShowReports(true) },
                    { key: 'audit', label: 'Audit log', icon: ShieldCheck, onClick: () => setShowAudit(true) },
                  ].map((item) => (
                    <button
                      key={item.key}
                      onClick={() => {
                        item.onClick();
                        setToolsOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-textMedium transition hover:bg-bg hover:text-textDark"
                    >
                      <item.icon size={14} className="text-primary" />
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => handleExport('summary')}
              disabled={exporting || filteredRows.length === 0}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-primary to-primary-dark px-2.5 py-2 text-[11px] font-semibold text-white shadow-sm shadow-primary/20 transition hover:shadow-lg hover:shadow-primary/30 disabled:opacity-50 md:px-4 md:text-sm"
            >
              <Download size={13} />
              <span>Summary</span>
            </button>

            <button
              onClick={() => setShowFinalize(true)}
              disabled={readOnly || (locked && run?.status !== 'paid')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-[11px] font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 md:px-4 md:text-sm ${
                locked
                  ? 'border-green/30 bg-greenLight/60 text-green'
                  : 'border-primary/30 bg-white text-primary hover:bg-primary-light/30'
              }`}
            >
              {locked ? <Lock size={13} /> : <ClipboardCheck size={13} />}
              <span>
                {run?.status === 'paid'
                  ? 'Paid'
                  : locked
                    ? 'Locked'
                    : 'Finalize'}
              </span>
            </button>
          </div>
        </div>
      </PageHeader>

      {/* ─── Setup warning — shown until the SQL migration has run ─── */}
      {setupMissing && !loading && (
        <div className="flex items-start gap-3 rounded-2xl border border-yellow/40 bg-yellowLight/70 px-4 py-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-yellow" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-yellow">
              Payroll setup incomplete
            </p>
            <p className="mt-0.5 text-[11px] text-textMedium">
              Run{' '}
              <span className="font-mono font-semibold text-textDark">
                20261024120000_payroll_foundation.sql
              </span>{' '}
              and{' '}
              <span className="font-mono font-semibold text-textDark">
                20261027120000_payroll_suite.sql
              </span>{' '}
              in the Supabase SQL Editor to enable rates, holidays, deductions,
              and payroll history.
            </p>
          </div>
        </div>
      )}

      {readOnly && (
        <div className="flex items-start gap-3 rounded-2xl border border-blue/25 bg-blueLight/50 px-4 py-3">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-blue" />
          <p className="text-xs text-textMedium">
            <span className="font-bold text-blue">View-only payroll access.</span>{' '}
            You can review pay, attendance, and history, but adjustments,
            settings, and finalization are disabled.
          </p>
        </div>
      )}

      {locked && (
        <div className="flex items-start gap-3 rounded-2xl border border-green/25 bg-greenLight/50 px-4 py-3">
          <Lock size={16} className="mt-0.5 shrink-0 text-green" />
          <p className="text-xs text-textMedium">
            <span className="font-bold text-green">
              This period is {run.status}.
            </span>{' '}
            The payroll snapshot is locked. Mark it paid from{' '}
            <button
              onClick={() => setShowHistory(true)}
              className="font-bold text-green underline decoration-green/40 underline-offset-2"
            >
              Payroll history
            </button>
            .
          </p>
        </div>
      )}

      {/* ─── Warnings ─── */}
      {!loading && warningsRowCount > 0 && (
        <SectionCard
          tone="warn"
          icon={AlertTriangle}
          title="Payroll warnings"
          subtitle={`${warningsRowCount} employee${warningsRowCount === 1 ? '' : 's'} need attention`}
          action={
            statusFilter === 'warnings' ? (
              <button
                onClick={() => setStatusFilter('all')}
                className="inline-flex items-center gap-1 rounded-full border border-yellow/40 bg-white px-2.5 py-1 text-[10px] font-bold text-yellow transition hover:bg-yellowLight"
              >
                <X size={10} /> Clear filter
              </button>
            ) : (
              <button
                onClick={() => setStatusFilter('warnings')}
                className="inline-flex items-center gap-1 rounded-full border border-yellow/40 bg-white px-2.5 py-1 text-[10px] font-bold text-yellow transition hover:bg-yellowLight"
              >
                Review
              </button>
            )
          }
          bodyClassName="p-3"
        >
          <div className="flex flex-wrap gap-2">
            <WarningChip
              icon={Wallet}
              label="No daily rate"
              count={warningCounts.no_rate}
              active={statusFilter === 'no_rate'}
              onClick={() => setStatusFilter('no_rate')}
            />
            <WarningChip
              icon={AlertTriangle}
              label="Deductions > gross"
              count={warningCounts.negative}
              active={statusFilter === 'negative'}
              onClick={() => setStatusFilter('negative')}
            />
            <WarningChip
              icon={Clock}
              label="Missing time-out"
              count={warningCounts.missing}
              active={statusFilter === 'missing'}
              onClick={() => setStatusFilter('missing')}
            />
            <WarningChip
              icon={ClipboardCheck}
              label="Pending adjustments"
              count={warningCounts.pending}
              active={statusFilter === 'pending'}
              onClick={() => setStatusFilter('pending')}
            />
            <WarningChip
              icon={Landmark}
              label="No bank details"
              count={warningCounts.no_bank}
              active={statusFilter === 'no_bank'}
              onClick={() => setStatusFilter('no_bank')}
            />
          </div>
        </SectionCard>
      )}

      {/* ─── Stat tiles ─── */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <StatTile label="Present" value={totals.present} icon={UserCheck} tone="good" />
        <StatTile label="Late" value={totals.late} icon={Clock} tone="warn" />
        <StatTile label="Absent" value={totals.absent} icon={UserX} tone="bad" />
        <StatTile
          label="Paid leave"
          value={totals.paidLeave}
          icon={Briefcase}
          tone="info"
        />
        <StatTile
          label="Unpaid leave"
          value={totals.unpaidLeave}
          icon={Briefcase}
          tone="muted"
        />
        <StatTile
          label="Hours"
          value={totals.hours.toFixed(2)}
          icon={TrendingUp}
          tone="brand"
          valueClassName="text-[15px] md:text-lg"
        />
        <StatTile
          label="Gross pay"
          value={peso(totals.gross)}
          icon={Wallet}
          tone="brand"
          valueClassName="text-[15px] md:text-lg"
        />
        <StatTile
          label="Net pay"
          value={peso(totals.net)}
          icon={Wallet}
          tone="good"
          valueClassName="text-[15px] md:text-lg"
        />
      </div>

      {/* ─── Search + filters ─── */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search employee, ID, department…"
          className="md:w-72"
        />
        <FilterChips
          options={filterOptions}
          value={statusFilter}
          onChange={setStatusFilter}
          className="md:ml-auto"
        />
        <span className="hidden shrink-0 text-[10px] font-semibold text-textLight md:inline">
          {filteredRows.length} of {rows.length} shown
        </span>
      </div>

      {/* ─── Content ─── */}
      {loading ? (
        <SkeletonTable rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No data for this cutoff"
          description="Pick a different cutoff, or wait for attendance records."
        />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No employees match"
          description="Try a different search term or clear the filters."
          action={
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
              }}
              className="rounded-full border border-border bg-white px-4 py-2 text-xs font-bold text-textMedium transition hover:border-primary/40 hover:text-primary"
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-white shadow-card md:block md:rounded-3xl">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gradient-to-r from-primary-light/40 via-primary-light/20 to-primary-light/10 text-left text-[9px] font-bold uppercase tracking-wider text-textMedium">
                    <th className="px-3 py-3.5">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        aria-label="Select all visible employees"
                        className="h-4 w-4 accent-primary"
                      />
                    </th>
                    <th className="px-3 py-3.5">Employee</th>
                    <th className="px-2 py-3.5 text-center">Present</th>
                    <th className="px-2 py-3.5 text-center">Late</th>
                    <th className="px-2 py-3.5 text-center">Absent</th>
                    <th className="px-2 py-3.5 text-center">Leave</th>
                    <th className="px-2 py-3.5 text-center">Missing</th>
                    <th className="px-2 py-3.5 text-right">Hours</th>
                    <th className="px-2 py-3.5 text-right">OT</th>
                    <th className="px-2 py-3.5 text-right">UT</th>
                    <th className="px-2 py-3.5 text-right">Gross</th>
                    <th className="px-2 py-3.5 text-right">Deductions</th>
                    <th className="px-2 py-3.5 text-right">Net</th>
                    <th className="px-3 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => {
                    const p = payMap[r.user_id];
                    const pending = Number(r.pending_adjustments) || 0;
                    const missing = Number(r.days_missing_timeout) || 0;
                    const checked = selected.has(r.user_id);
                    return (
                      <tr
                        key={r.user_id}
                        className={`border-t border-border transition hover:bg-primary-light/10 ${
                          checked ? 'bg-primary-light/20' : ''
                        }`}
                      >
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelect(r.user_id)}
                            aria-label={`Select ${r.full_name}`}
                            className="h-4 w-4 accent-primary"
                          />
                        </td>
                        <td
                          className="cursor-pointer px-3 py-3"
                          onClick={() => setDrawerRow(r)}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-light to-primary/30 text-[10px] font-bold text-primary">
                              {r.full_name?.[0]?.toUpperCase() ?? '?'}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-textDark">
                                {r.full_name}
                              </p>
                              <p className="truncate text-[9px] text-textLight">
                                {r.employee_id}
                                {r.department ? ` · ${r.department}` : ''}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              {!p?.hasRate && (
                                <span className="rounded-full border border-yellow/30 bg-yellowLight px-1.5 py-0.5 text-[9px] font-bold text-yellow">
                                  No rate
                                </span>
                              )}
                              {missing > 0 && (
                                <span
                                  title={`${missing} day(s) with no time-out`}
                                  className="inline-flex items-center gap-0.5 rounded-full border border-yellow/30 bg-yellowLight px-1.5 py-0.5 text-[9px] font-bold text-yellow"
                                >
                                  <AlertTriangle size={9} />
                                  {missing}
                                </span>
                              )}
                              {pending > 0 && (
                                <span
                                  title={`${pending} pending adjustment(s)`}
                                  className="inline-flex items-center gap-0.5 rounded-full border border-yellow/30 bg-yellowLight px-1.5 py-0.5 text-[9px] font-bold text-yellow"
                                >
                                  <ClipboardCheck size={9} />
                                  {pending}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <Pill value={r.days_present} tone="green" />
                        </td>
                        <td className="px-2 py-3 text-center">
                          <Pill value={r.days_late} tone="amber" />
                        </td>
                        <td className="px-2 py-3 text-center">
                          <Pill value={r.days_absent} tone="red" />
                        </td>
                        <td className="px-2 py-3 text-center">
                          <Pill value={r.days_on_leave} tone="blue" />
                          {Number(r.days_on_leave) > 0 && (
                            <p className="mt-0.5 text-[8px] font-semibold text-textLight">
                              {r.days_paid_leave ?? 0}p / {r.days_unpaid_leave ?? 0}u
                            </p>
                          )}
                        </td>
                        <td className="px-2 py-3 text-center font-semibold text-textLight">
                          {missing || '—'}
                        </td>
                        <td className="px-2 py-3 text-right font-bold text-textDark">
                          {Number(r.total_hours_worked).toFixed(2)}
                        </td>
                        <td className="px-2 py-3 text-right font-semibold text-green">
                          {Number(r.overtime_hours).toFixed(2)}
                        </td>
                        <td className="px-2 py-3 text-right font-semibold text-red">
                          {Number(r.undertime_hours).toFixed(2)}
                        </td>
                        <td className="px-2 py-3 text-right font-bold text-textDark">
                          {p?.hasRate ? peso(p.gross) : '—'}
                        </td>
                        <td className="px-2 py-3 text-right text-red">
                          {p?.hasRate && Number(p.totalDeductions) > 0
                            ? `− ${peso(p.totalDeductions)}`
                            : '—'}
                        </td>
                        <td
                          className={`px-2 py-3 text-right font-bold ${
                            p?.hasRate && Number(p.net) < 0
                              ? 'text-red'
                              : 'text-textDark'
                          }`}
                        >
                          {p?.hasRate ? peso(p.net) : '—'}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setDrillFilter('all');
                                setDrillRow(r);
                              }}
                              title={`Attendance drill-down for ${r.full_name}`}
                              className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] font-bold text-textMedium transition hover:border-primary/40 hover:text-primary"
                            >
                              <CalendarDays size={11} />
                            </button>
                            <button
                              onClick={() => handleExport('detailed', r)}
                              disabled={exporting}
                              title={`Detailed report for ${r.full_name}`}
                              className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] font-bold text-textMedium transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
                            >
                              <FileText size={11} /> Detail
                            </button>
                            <button
                              onClick={() => setAdjustRow(r)}
                              disabled={!canEdit}
                              title={
                                canEdit
                                  ? 'Add an OT/UT or pay adjustment'
                                  : 'This period is read-only'
                              }
                              className="inline-flex items-center gap-1 rounded-full border border-primary/30 px-2 py-1 text-[10px] font-bold text-primary transition hover:bg-primary-light/30 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Plus size={11} /> Adjust
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-gradient-to-r from-primary-light/20 to-transparent px-5 py-3.5 text-[11px] text-textMedium">
              <span className="font-semibold">
                {filteredRows.length} of {rows.length} employee
                {rows.length === 1 ? '' : 's'} · {cutoff?.label}
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  Gross{' '}
                  <span className="font-bold text-textDark">
                    {peso(filteredTotals.gross)}
                  </span>
                </span>
                <span>
                  Deductions{' '}
                  <span className="font-bold text-red">
                    {peso(filteredTotals.deductions)}
                  </span>
                </span>
                <span>
                  Net{' '}
                  <span className="font-bold text-green">
                    {peso(filteredTotals.net)}
                  </span>
                </span>
                <span>
                  13th month{' '}
                  <span className="font-bold text-textDark">
                    {peso(filteredTotals.thirteenth)}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Mobile: card list */}
          <div className="space-y-2 md:hidden">
            {filteredRows.map((r) => {
              const p = payMap[r.user_id];
              const pending = Number(r.pending_adjustments) || 0;
              const missing = Number(r.days_missing_timeout) || 0;
              const checked = selected.has(r.user_id);
              return (
                <div
                  key={r.user_id}
                  className={`overflow-hidden rounded-2xl border bg-white shadow-card ${
                    checked ? 'border-primary/40' : 'border-border'
                  }`}
                >
                  <div
                    className={`h-1 bg-gradient-to-r ${
                      r.days_absent > 0
                        ? 'from-red-400 to-red-300'
                        : r.days_late > 0
                          ? 'from-amber-400 to-amber-300'
                          : 'from-emerald-400 to-emerald-300'
                    }`}
                  />

                  <div className="flex items-start gap-2 p-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelect(r.user_id)}
                      aria-label={`Select ${r.full_name}`}
                      className="mt-2 h-4 w-4 shrink-0 accent-primary"
                    />
                    <button
                      onClick={() => setDrawerRow(r)}
                      className="min-w-0 flex-1 space-y-2.5 text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-light to-primary/30 text-xs font-bold text-primary ring-2 ring-white shadow-sm">
                          {r.full_name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-textDark">
                            {r.full_name}
                          </p>
                          <p className="truncate text-[10px] text-textLight">
                            {r.employee_id}
                            {r.department ? ` · ${r.department}` : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {!p?.hasRate && (
                            <span className="rounded-full border border-yellow/30 bg-yellowLight px-1.5 py-0.5 text-[9px] font-bold text-yellow">
                              No rate
                            </span>
                          )}
                          {pending > 0 && (
                            <span className="inline-flex items-center gap-0.5 rounded-full border border-yellow/30 bg-yellowLight px-1.5 py-0.5 text-[9px] font-bold text-yellow">
                              <ClipboardCheck size={9} />
                              {pending} pending
                            </span>
                          )}
                          {missing > 0 && (
                            <span className="inline-flex items-center gap-0.5 rounded-full border border-yellow/30 bg-yellowLight px-1.5 py-0.5 text-[9px] font-bold text-yellow">
                              <AlertTriangle size={9} />
                              {missing} missing
                            </span>
                          )}
                        </div>
                      </div>

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

                      {(Number(r.overtime_hours) > 0 ||
                        Number(r.undertime_hours) > 0) && (
                        <div className="flex items-center gap-2 text-[10px] font-semibold">
                          {Number(r.overtime_hours) > 0 && (
                            <span className="rounded-full border border-green/25 bg-greenLight px-2 py-0.5 text-green">
                              OT {Number(r.overtime_hours).toFixed(2)}
                            </span>
                          )}
                          {Number(r.undertime_hours) > 0 && (
                            <span className="rounded-full border border-red/25 bg-redLight px-2 py-0.5 text-red">
                              UT {Number(r.undertime_hours).toFixed(2)}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-2 border-t border-border/60 pt-2">
                        <div>
                          <p className="text-[8px] font-bold uppercase tracking-wider text-textLight">
                            Gross
                          </p>
                          <p className="text-[11px] font-bold text-textDark">
                            {p?.hasRate ? peso(p.gross) : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[8px] font-bold uppercase tracking-wider text-textLight">
                            Deductions
                          </p>
                          <p className="text-[11px] font-bold text-red">
                            {p?.hasRate && Number(p.totalDeductions) > 0
                              ? `− ${peso(p.totalDeductions)}`
                              : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[8px] font-bold uppercase tracking-wider text-textLight">
                            Net
                          </p>
                          <p
                            className={`text-[11px] font-bold ${
                              p?.hasRate && Number(p.net) < 0
                                ? 'text-red'
                                : 'text-green'
                            }`}
                          >
                            {p?.hasRate ? peso(p.net) : '—'}
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 px-3 pb-3">
                    <span className="text-[10px] font-bold text-primary">
                      Tap for details →
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setDrillFilter('all');
                          setDrillRow(r);
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-bold text-textMedium transition hover:border-primary/40 hover:text-primary"
                      >
                        <CalendarDays size={11} /> Days
                      </button>
                      <button
                        onClick={() => handleExport('detailed', r)}
                        disabled={exporting}
                        className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-bold text-textMedium transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
                      >
                        <FileText size={11} /> Detail
                      </button>
                      <button
                        onClick={() => setAdjustRow(r)}
                        disabled={!canEdit}
                        className="inline-flex items-center gap-1 rounded-full border border-primary/30 px-2.5 py-1 text-[11px] font-bold text-primary transition hover:bg-primary-light/30 disabled:opacity-40"
                      >
                        <Plus size={11} /> Adjust
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            <p className="pt-2 text-center text-[10px] text-textLight">
              {filteredRows.length} of {rows.length} employees · {cutoff?.label}
            </p>
          </div>
        </>
      )}

      {/* ─── Bulk selection bar ─── */}
      {selected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-[55] flex max-w-[95vw] -translate-x-1/2 flex-wrap items-center gap-2 rounded-2xl border border-white/20 bg-textDark px-3 py-2 text-xs text-white shadow-float">
          <span className="font-bold">
            {selected.size} selected
          </span>
          <button
            onClick={() => handleExportCSV(selectedRows)}
            className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 font-bold transition hover:bg-white/25"
          >
            <Download size={11} /> CSV
          </button>
          <button
            onClick={() => handleExportBank(selectedRows)}
            className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 font-bold transition hover:bg-white/25"
          >
            <Landmark size={11} /> Bank
          </button>
          <button
            onClick={() => handleExport('summary', null, selectedRows)}
            className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 font-bold transition hover:bg-white/25"
          >
            <FileText size={11} /> PDF
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 font-bold transition hover:bg-white/25"
          >
            <X size={11} /> Clear
          </button>
        </div>
      )}

      <EmployeePayrollDrawer
        open={!!drawerRow}
        summary={drawerRow}
        cutoff={cutoff}
        pay={drawerRow ? payMap[drawerRow.user_id] : null}
        adminId={adminId}
        readOnly={!canEdit}
        onClose={() => setDrawerRow(null)}
        onAddAdjustment={() => {
          const r = drawerRow;
          setDrawerRow(null);
          setAdjustRow(r);
        }}
        onDrilldown={() => {
          const r = drawerRow;
          setDrawerRow(null);
          setDrillFilter('all');
          setDrillRow(r);
        }}
        onDetailed={() => drawerRow && handleExport('detailed', drawerRow)}
        onChanged={load}
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

      <AttendanceDrilldownModal
        open={!!drillRow}
        onClose={() => setDrillRow(null)}
        row={drillRow}
        cutoff={cutoff}
        initialFilter={drillFilter}
        onChanged={load}
        onToast={showToast}
        readOnly={!canEdit}
      />

      <HolidaysManagerModal
        open={showHolidays}
        onClose={() => setShowHolidays(false)}
        onSaved={load}
      />

      <PayrollSettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        available={settingsAvailable}
        readOnly={!canEdit}
        onSaved={load}
        onToast={showToast}
      />

      <FinalizeRunModal
        open={showFinalize}
        onClose={() => setShowFinalize(false)}
        cutoff={cutoff}
        rows={rows}
        payMap={payMap}
        adminId={adminId}
        existingRun={run}
        onFinalized={load}
        onToast={showToast}
      />

      <PayrollHistoryModal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        adminId={adminId}
        readOnly={readOnly}
        onReprint={handleReprint}
        onChanged={load}
        onToast={showToast}
      />

      <AdjustmentApprovalModal
        open={showApprovals}
        onClose={() => setShowApprovals(false)}
        cutoff={cutoff}
        adminId={adminId}
        readOnly={!canEdit}
        onChanged={load}
        onToast={showToast}
      />

      <PayrollReportsModal
        open={showReports}
        onClose={() => setShowReports(false)}
        cutoff={cutoff}
        rows={filteredRows}
        payMap={payMap}
        settings={settings}
        onExportCSV={() => handleExportCSV()}
        onExportBank={() => handleExportBank()}
        onToast={showToast}
      />

      <PayrollAuditModal
        open={showAudit}
        onClose={() => setShowAudit(false)}
        onToast={showToast}
      />

      <Toast message={toast?.message} type={toast?.type} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Small presentational helpers
// ─────────────────────────────────────────────────────────────
function WarningChip({ icon: Icon, label, count, active, onClick }) {
  if (!count) return null;
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
        active
          ? 'border-yellow bg-yellow text-white'
          : 'border-yellow/30 bg-white text-yellow hover:bg-yellowLight'
      }`}
    >
      <Icon size={12} />
      {label}
      <span
        className={`rounded-full px-1.5 py-0.5 text-[9px] leading-none ${
          active ? 'bg-white/25 text-white' : 'bg-yellowLight text-yellow'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

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
      className={`inline-flex h-7 min-w-[28px] items-center justify-center rounded-full border px-2 text-xs font-bold ${
        isZero ? 'border-border bg-bg text-textFaint' : tones[tone]
      }`}
    >
      {value}
    </span>
  );
}

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
      className={`rounded-lg border py-1.5 text-center ${
        isZero ? 'border-border bg-bg text-textFaint' : tones[tone]
      }`}
    >
      <p className="truncate text-[8px] font-bold uppercase tracking-wider opacity-70">
        {label}
      </p>
      <p className="mt-0.5 truncate text-xs font-bold leading-tight">{value}</p>
    </div>
  );
}
