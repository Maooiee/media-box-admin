// admin-panel/src/features/payroll/presentation/widgets/PayrollReportsModal.jsx
import { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Building2,
  Download,
  Landmark,
  Moon,
  Sun,
  CalendarClock,
} from 'lucide-react';
import Modal from '../../../../shared/components/Modal';
import Button from '../../../../shared/components/Button';
import { SkeletonList } from '../../../../shared/components/Skeleton';
import { payrollRepository } from '../../data/payrollRepository';
import { holidaysRepository } from '../../data/holidaysRepository';
import { computeEmployeePay, addDaysISO } from '../../domain/payrollCalc';
import { peso } from '../../domain/payrollRules';
import { summarizeBankEligibility } from '../../../../core/utils/csv';

function daysBetween(start, end) {
  return Math.max(
    Math.round((new Date(end) - new Date(start)) / 86400000) + 1,
    1
  );
}

function sumPay(rows, payMap) {
  const out = {
    employees: rows.length,
    gross: 0,
    deductions: 0,
    net: 0,
    ot: 0,
    nightDiff: 0,
    restDay: 0,
    thirteenth: 0,
    absenceCost: 0,
  };
  for (const r of rows) {
    const p = payMap[r.user_id];
    if (!p) continue;
    out.gross += Number(p.gross) || 0;
    out.deductions += Number(p.totalDeductions) || 0;
    out.net += Number(p.net) || 0;
    out.ot += Number(p.otPay) || 0;
    out.nightDiff += Number(p.nightDiffPay) || 0;
    out.restDay += Number(p.restDayPay) || 0;
    out.thirteenth += Number(p.thirteenthMonthAccrual) || 0;
    out.absenceCost += (Number(r.days_absent) || 0) * (Number(r.daily_rate) || 0);
  }
  return out;
}

export default function PayrollReportsModal({
  open,
  onClose,
  cutoff,
  rows = [],
  payMap = {},
  settings,
  onExportCSV,
  onExportBank,
  onToast,
}) {
  const [previous, setPrevious] = useState(null);
  const [loading, setLoading] = useState(false);

  const current = useMemo(() => sumPay(rows, payMap), [rows, payMap]);

  // Same eligibility pass the export uses, so the count here always matches
  // the file that would be written.
  const bankSummary = useMemo(
    () => summarizeBankEligibility(rows, payMap),
    [rows, payMap]
  );

  const departments = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = r.department || r.position || 'Unassigned';
      if (!map.has(key)) {
        map.set(key, { key, employees: 0, gross: 0, net: 0, ot: 0 });
      }
      const bucket = map.get(key);
      const p = payMap[r.user_id];
      bucket.employees += 1;
      bucket.gross += Number(p?.gross) || 0;
      bucket.net += Number(p?.net) || 0;
      bucket.ot += Number(p?.otPay) || 0;
    }
    return [...map.values()].sort((a, b) => b.gross - a.gross);
  }, [rows, payMap]);

  const maxDeptGross = Math.max(...departments.map((d) => d.gross), 1);

  useEffect(() => {
    if (!open || !cutoff) return;
    let cancelled = false;
    setLoading(true);
    setPrevious(null);

    (async () => {
      try {
        const periodDays = daysBetween(cutoff.start, cutoff.end);
        const prevEnd = addDaysISO(cutoff.start, -1);
        const prevStart = addDaysISO(prevEnd, -(periodDays - 1));

        const data = await payrollRepository.fetchPayrollRows({
          from: prevStart,
          to: prevEnd,
        });
        let holidays = [];
        try {
          holidays = await holidaysRepository.fetchRange(prevStart, prevEnd);
        } catch {
          holidays = [];
        }
        const holidaysByDate = holidaysRepository.toMap(holidays);
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

        const prevPayMap = {};
        for (const r of data.rows) {
          prevPayMap[r.user_id] = computeEmployeePay({
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
            periodStart: prevStart,
            periodEnd: prevEnd,
            restDay: r.rest_day,
            settings: data.settings ?? settings,
          });
        }

        if (!cancelled) {
          setPrevious({
            start: prevStart,
            end: prevEnd,
            label: `${prevStart} → ${prevEnd}`,
            totals: sumPay(data.rows, prevPayMap),
          });
        }
      } catch {
        if (!cancelled) {
          onToast?.('Could not load the previous cutoff', 'error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cutoff]);

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Payroll reports"
      subtitle={cutoff?.label}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-5">
        {/* ─── Cost trend ─── */}
        <section>
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-textDark">
            <CalendarClock size={14} className="text-primary" /> Cost trend
          </h3>
          <p className="mt-0.5 text-[11px] text-textLight">
            {previous ? `Compared with ${previous.label}` : 'Loading previous cutoff…'}
          </p>

          {loading ? (
            <div className="mt-3">
              <SkeletonList rows={2} />
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              <TrendCard
                label="Gross pay"
                current={current.gross}
                previous={previous?.totals.gross}
              />
              <TrendCard
                label="Net pay"
                current={current.net}
                previous={previous?.totals.net}
              />
              <TrendCard
                label="Overtime cost"
                current={current.ot}
                previous={previous?.totals.ot}
              />
              <TrendCard
                label="Absence cost"
                current={current.absenceCost}
                previous={previous?.totals.absenceCost}
                inverse
              />
            </div>
          )}
        </section>

        {/* ─── Premiums / accruals ─── */}
        <section>
          <h3 className="text-sm font-bold text-textDark">Earnings mix</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            <MiniStat
              icon={TrendingUp}
              label="Overtime"
              value={peso(current.ot)}
            />
            <MiniStat
              icon={Moon}
              label="Night differential"
              value={peso(current.nightDiff)}
            />
            <MiniStat
              icon={Sun}
              label="Rest-day premium"
              value={peso(current.restDay)}
            />
            <MiniStat
              icon={Landmark}
              label="13th month accrual"
              value={peso(current.thirteenth)}
            />
          </div>
        </section>

        {/* ─── Department breakdown ─── */}
        <section>
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-textDark">
            <Building2 size={14} className="text-primary" /> Department / role breakdown
          </h3>
          {departments.length === 0 ? (
            <p className="mt-2 text-xs text-textLight">
              No department or position data yet.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {departments.map((d) => (
                <div key={d.key} className="rounded-xl border border-border bg-white p-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-textDark">{d.key}</span>
                    <span className="text-textLight">
                      {d.employees} employee{d.employees === 1 ? '' : 's'}
                    </span>
                    <span className="ml-auto font-bold text-textDark">
                      {peso(d.gross)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-primary-dark"
                      style={{ width: `${(d.gross / maxDeptGross) * 100}%` }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-textLight">
                    <span>Net {peso(d.net)}</span>
                    <span>OT {peso(d.ot)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── Exports ─── */}
        <section>
          <h3 className="text-sm font-bold text-textDark">Accounting exports</h3>
          <p className="mt-0.5 text-[11px] text-textLight">
            CSV opens in Excel. The bank file contains only employees with bank
            details and a positive net pay.
          </p>
          <p
            className={`mt-1 text-[11px] font-semibold ${
              bankSummary.count > 0 ? 'text-textLight' : 'text-red'
            }`}
          >
            {bankSummary.withBank === 0
              ? bankSummary.missingBankPayable.length
                ? `No employee in this view has a bank account number yet. ${bankSummary.missingBankPayable
                    .slice(0, 3)
                    .map((b) => `${b.name} (${peso(b.net)})`)
                    .join(', ')} ${
                    bankSummary.missingBankPayable.length === 1 ? 'has' : 'have'
                  } net pay waiting for bank details.`
                : 'No employee in this view has a bank account number yet.'
              : bankSummary.count === 0
                ? `${bankSummary.withBank} with bank details, but none have a positive net pay${
                    bankSummary.blocked.length
                      ? `: ${bankSummary.blocked
                          .slice(0, 3)
                          .map((b) => `${b.name} (${b.reason})`)
                          .join(', ')}`
                      : ''
                  }.${
                    bankSummary.missingBankPayable.length
                      ? ` ${bankSummary.missingBankPayable
                          .slice(0, 3)
                          .map((b) => `${b.name} (${peso(b.net)})`)
                          .join(', ')} ${
                          bankSummary.missingBankPayable.length === 1
                            ? 'has'
                            : 'have'
                        } net pay but no bank account number.`
                      : ''
                  }`
                : `${bankSummary.count} of ${rows.length} employee${
                    rows.length === 1 ? '' : 's'
                  } ready for bank transfer.`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={Download}
              onClick={() => onExportCSV?.()}
            >
              Payroll CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={Landmark}
              onClick={() => onExportBank?.()}
            >
              Bank transfer file
            </Button>
          </div>
        </section>

        <div className="flex justify-end border-t border-border pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function TrendCard({ label, current, previous, inverse = false }) {
  const hasPrevious = previous !== undefined && previous !== null;
  const diff = hasPrevious ? current - previous : 0;
  const pct = hasPrevious && previous !== 0 ? (diff / previous) * 100 : 0;
  const up = diff > 0.005;
  const down = diff < -0.005;
  const good = inverse ? down : up;
  const bad = inverse ? up : down;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  const tone = good ? 'text-green' : bad ? 'text-red' : 'text-textLight';

  return (
    <div className="rounded-xl border border-border bg-white p-2.5">
      <p className="text-[9px] font-bold uppercase tracking-wider text-textLight">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-bold text-textDark">{peso(current)}</p>
      <p className={`mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold ${tone}`}>
        <Icon size={11} />
        {hasPrevious
          ? `${diff >= 0 ? '+' : ''}${peso(diff)} (${pct.toFixed(1)}%)`
          : 'No prior data'}
      </p>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-border bg-white p-2.5">
      <div className="flex items-center gap-1.5">
        <Icon size={12} className="text-primary" />
        <p className="text-[9px] font-bold uppercase tracking-wider text-textLight">
          {label}
        </p>
      </div>
      <p className="mt-0.5 text-sm font-bold text-textDark">{value}</p>
    </div>
  );
}
