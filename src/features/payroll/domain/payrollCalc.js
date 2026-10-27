// admin-panel/src/features/payroll/domain/payrollCalc.js
//
// Payroll math. Everything here is pure — no Supabase calls — so the same
// numbers drive the payroll table, the employee drawer, and the payslip PDF.
//
// The payroll summary is rebuilt here from the raw tables (profiles +
// attendance_records + payroll_adjustments) instead of the payroll_summary
// view, because the view's cutoffs are fixed to semi-monthly periods while
// payroll here runs weekly.

import {
  HOURS_PER_DAY,
  OT_MULTIPLIER,
  REGULAR_HOLIDAY_UNWORKED,
  THIRTEENTH_MONTH_DIVISOR,
  holidayWorkedMultiplier,
  computeContributions,
  mergePayrollSettings,
} from './payrollRules';

// ─────────────────────────────────────────────────────
//  Date helpers — all dates are 'YYYY-MM-DD' strings,
//  which compare correctly as plain strings.
// ─────────────────────────────────────────────────────
function toDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function isoOf(dt) {
  return dt.toISOString().slice(0, 10);
}

export function addDaysISO(iso, n) {
  const dt = toDate(iso);
  dt.setUTCDate(dt.getUTCDate() + n);
  return isoOf(dt);
}

function eachDate(from, to) {
  const out = [];
  let cur = from;
  while (cur <= to && out.length < 400) {
    out.push(cur);
    cur = addDaysISO(cur, 1);
  }
  return out;
}

/** 0 = Sunday … 6 = Saturday, from a 'YYYY-MM-DD' string. */
export function weekdayOf(iso) {
  return toDate(iso).getUTCDay();
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function hoursBetween(a, b) {
  if (!a || !b) return 0;
  const ms = new Date(b) - new Date(a);
  return ms > 0 ? ms / 3600000 : 0;
}

// Actual hours that count toward basic pay for one attendance record.
// A day never pays more than one regular shift — anything beyond that must be
// entered as an overtime adjustment. A missing time-out cannot be prorated,
// so it keeps the full-day assumption until the record is corrected.
function paidHoursFor(rec) {
  if (!rec?.time_in) return 0;
  if (!rec.time_out) return HOURS_PER_DAY;
  return Math.min(hoursBetween(rec.time_in, rec.time_out), HOURS_PER_DAY);
}

// ─────────────────────────────────────────────────────
//  Night differential — overlap of a shift with 22:00–06:00 Manila.
//  Asia/Manila has no DST, so a fixed +08:00 offset is exact.
// ─────────────────────────────────────────────────────
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export function nightHoursFor(rec) {
  if (!rec?.time_in || !rec?.time_out) return 0;
  const start = new Date(rec.time_in).getTime() + MANILA_OFFSET_MS;
  const end = new Date(rec.time_out).getTime() + MANILA_OFFSET_MS;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0;
  }

  let total = 0;
  const firstDay = Math.floor(start / DAY_MS) * DAY_MS - DAY_MS;
  for (let day = firstDay; day <= end; day += DAY_MS) {
    const windowStart = day + 22 * HOUR_MS;
    const windowEnd = day + 30 * HOUR_MS; // next day 06:00
    const overlapStart = Math.max(start, windowStart);
    const overlapEnd = Math.min(end, windowEnd);
    if (overlapEnd > overlapStart) {
      total += (overlapEnd - overlapStart) / HOUR_MS;
    }
  }

  // Never claim more night hours than the shift itself.
  return Math.min(total, (end - start) / HOUR_MS);
}

// ─────────────────────────────────────────────────────
//  Summary — one row per employee for an arbitrary period
// ─────────────────────────────────────────────────────
export function aggregatePayrollRows({
  profiles,
  attendance,
  adjustments,
  from,
  to,
}) {
  const rows = new Map();

  function ensure(userId, profile) {
    if (!rows.has(userId)) {
      rows.set(userId, {
        user_id: userId,
        full_name: profile?.full_name ?? 'Unknown',
        employee_id: profile?.employee_id ?? '',
        position: profile?.position ?? '',
        department: profile?.department ?? '',
        daily_rate: profile?.daily_rate ?? null,
        rest_day: profile?.rest_day ?? null,
        bank_name: profile?.bank_name ?? '',
        bank_account_name: profile?.bank_account_name ?? '',
        bank_account_number: profile?.bank_account_number ?? '',
        payroll_role: profile?.payroll_role ?? null,
        email: profile?.email ?? '',
        days_present: 0,
        days_late: 0,
        days_absent: 0,
        days_on_leave: 0,
        days_paid_leave: 0,
        days_unpaid_leave: 0,
        days_missing_timeout: 0,
        total_hours_worked: 0,
        overtime_hours: 0,
        undertime_hours: 0,
        overtime_minutes: 0,
        undertime_minutes: 0,
        night_diff_hours: 0,
        rest_day_hours: 0,
        allowance_amount: 0,
        bonus_amount: 0,
        other_deduction_amount: 0,
        pending_adjustments: 0,
        rejected_adjustments: 0,
        approved_adjustments: 0,
        cutoff_start: from,
        cutoff_end: to,
      });
    }
    return rows.get(userId);
  }

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  // Everyone still active gets a row (weekly payroll should list the whole
  // team even on a zero week), plus anyone with activity in the period.
  for (const p of profiles ?? []) {
    if (p.is_active) ensure(p.id, p);
  }

  for (const a of attendance ?? []) {
    if (a.date < from || a.date > to) continue; // the range includes the day
    const row = ensure(a.user_id, byId.get(a.user_id)); // before `from` for
    if (a.status === 'present') row.days_present += 1; // holiday pay — skip it
    else if (a.status === 'late') row.days_late += 1;
    else if (a.status === 'absent') row.days_absent += 1;
    else if (a.status === 'on_leave') {
      const factor = a.half_day ? 0.5 : 1;
      row.days_on_leave += factor;
      if (a.is_paid) row.days_paid_leave += factor;
      else row.days_unpaid_leave += factor;
    }

    if (a.time_in && !a.time_out) row.days_missing_timeout += 1;
    row.total_hours_worked += hoursBetween(a.time_in, a.time_out);
  }

  for (const adj of adjustments ?? []) {
    if (adj.work_date < from || adj.work_date > to) continue;
    const row = ensure(adj.user_id, byId.get(adj.user_id));

    const status = adj.status ?? 'approved';
    if (status === 'pending') {
      row.pending_adjustments += 1;
      continue;
    }
    if (status === 'rejected') {
      row.rejected_adjustments += 1;
      continue;
    }
    row.approved_adjustments += 1;

    const minutes = Number(adj.minutes) || 0;
    const amount = Number(adj.amount) || 0;

    if (adj.kind === 'overtime') {
      row.overtime_minutes += minutes;
      row.overtime_hours += minutes / 60;
    } else if (adj.kind === 'undertime') {
      row.undertime_minutes += minutes;
      row.undertime_hours += minutes / 60;
    } else if (adj.kind === 'night_diff') {
      row.night_diff_hours += minutes / 60;
    } else if (adj.kind === 'rest_day') {
      row.rest_day_hours += minutes / 60;
    } else if (adj.kind === 'allowance') {
      row.allowance_amount += amount;
    } else if (adj.kind === 'bonus') {
      row.bonus_amount += amount;
    } else if (
      adj.kind === 'loan' ||
      adj.kind === 'cash_advance' ||
      adj.kind === 'other_deduction'
    ) {
      row.other_deduction_amount += amount;
    }
  }

  const out = [...rows.values()];
  for (const r of out) {
    r.total_hours_worked = round2(r.total_hours_worked);
    r.overtime_hours = round2(r.overtime_hours);
    r.undertime_hours = round2(r.undertime_hours);
    r.night_diff_hours = round2(r.night_diff_hours);
    r.rest_day_hours = round2(r.rest_day_hours);
    r.allowance_amount = round2(r.allowance_amount);
    r.bonus_amount = round2(r.bonus_amount);
    r.other_deduction_amount = round2(r.other_deduction_amount);
  }
  return out.sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
}

// ─────────────────────────────────────────────────────
//  Pay — pesos for one employee over one period
// ─────────────────────────────────────────────────────
//
//  dailyRate   ₱ per regular working day (null/0 → nothing is computed)
//              hourlyRate = dailyRate ÷ 8; basic pay is actual paid hours ×
//              hourlyRate, so a partial day pays only the hours worked
//  records     attendance rows covering (periodStart − 1 day) … periodEnd;
//              the extra day is needed for the unworked-regular-holiday rule
//  holidaysByDate  Map<'YYYY-MM-DD', { kind: 'regular'|'special', name }>
//  otHours / utHours  approved overtime / undertime adjustments
//  settings    payroll settings (contributions, night diff, rest day, …)
//  restDay     0–6, the employee's fixed rest day (null = none)
//
export function computeEmployeePay({
  dailyRate,
  records,
  holidaysByDate,
  otHours = 0,
  utHours = 0,
  allowanceAmount = 0,
  bonusAmount = 0,
  otherDeductionAmount = 0,
  nightDiffAdjustmentHours = 0,
  restDayAdjustmentHours = 0,
  recurringDeductions = [],
  restDay = null,
  settings = null,
  periodStart,
  periodEnd,
}) {
  const rate = Number(dailyRate) || 0;
  const hourly = rate / HOURS_PER_DAY;
  const periodDays = Math.max(eachDate(periodStart, periodEnd).length, 1);
  const cfg = settings ? mergePayrollSettings(settings) : null;
  const nightRate = cfg ? Number(cfg.nightDiffRate) || 0 : 0;
  const restPremium = cfg ? Number(cfg.restDayPremium) || 0 : 0;

  const pay = {
    rate,
    hourly,
    periodDays,
    basicHours: 0,       // paid regular hours (max 8 per day)
    basicDays: 0,        // basicHours ÷ 8, kept for day-rate displays/tests
    paidLeaveDays: 0,    // approved leave days treated as paid
    unpaidLeaveDays: 0,  // approved leave days — excluded from pay
    holidayPayDays: 0,   // unworked regular holidays paid at 100%
    workedHolidayDays: 0,
    basicPay: 0,
    holidayPay: 0,       // unworked regular holiday pay
    holidayPremium: 0,   // extra 100% / 30% earned by working a holiday
    paidLeavePay: 0,
    nightDiffHours: 0,
    nightDiffPay: 0,
    restDayHours: 0,
    restDayPay: 0,
    allowanceAmount: round2(allowanceAmount),
    bonusAmount: round2(bonusAmount),
    otHours: round2(otHours),
    otPay: 0,
    utHours: round2(utHours),
    utDeduction: 0,
    otherDeductionAmount: round2(otherDeductionAmount),
    recurringDeductions: [],
    contributions: [],
    employerContributions: [],
    totalContributions: 0,
    totalRecurringDeductions: 0,
    totalDeductions: 0,
    gross: 0,
    net: 0,
    thirteenthMonthAccrual: 0,
    hasRate: rate > 0,
    lines: [],
    deductions: [],
  };

  if (rate <= 0) return pay;

  const byDate = new Map((records ?? []).map((r) => [r.date, r]));
  const workedOn = (iso) => {
    const rec = byDate.get(iso);
    return !!(rec && rec.time_in);
  };

  const restDayNum =
    restDay === null || restDay === undefined || restDay === ''
      ? null
      : Number(restDay);

  for (const date of eachDate(periodStart, periodEnd)) {
    const holiday = holidaysByDate.get(date);
    const rec = byDate.get(date);
    const isRestDay =
      restDayNum !== null &&
      Number.isFinite(restDayNum) &&
      weekdayOf(date) === restDayNum;

    if (holiday) {
      // Leave takes precedence over holiday pay. Paid leave pays the daily
      // rate; unpaid leave is excluded.
      if (rec?.status === 'on_leave') {
        if (rec.is_paid) {
          const factor = rec.half_day ? 0.5 : 1;
          pay.paidLeaveDays += factor;
          pay.paidLeavePay += rate * factor;
        } else {
          pay.unpaidLeaveDays += 1;
        }
        continue;
      }
      if (workedOn(date)) {
        const mult = holidayWorkedMultiplier(holiday.kind);
        const workedHours = paidHoursFor(rec);
        pay.workedHolidayDays += 1;
        pay.basicHours += workedHours; // the first 100% counts as regular pay
        pay.holidayPremium += workedHours * hourly * (mult - 1);
        pay.nightDiffHours += nightHoursFor(rec);
      } else if (
        holiday.kind === 'regular' &&
        REGULAR_HOLIDAY_UNWORKED > 0 &&
        workedOn(addDaysISO(date, -1))
      ) {
        pay.holidayPayDays += 1;
        pay.holidayPay += rate * REGULAR_HOLIDAY_UNWORKED;
      }
      continue;
    }

    if (!rec) continue;               // no record → scheduled off / no shift
    if (rec.status === 'absent') continue; // no work, no pay
    // Approved leave never adds an attendance day. Paid leave adds a separate
    // earnings line; unpaid leave is excluded from pay.
    if (rec.status === 'on_leave') {
      if (rec.is_paid) {
        const factor = rec.half_day ? 0.5 : 1;
        pay.paidLeaveDays += factor;
        pay.paidLeavePay += rate * factor;
      } else {
        pay.unpaidLeaveDays += 1;
      }
      continue;
    }
    if (rec.time_in) {
      const hours = paidHoursFor(rec);
      pay.basicHours += hours;
      pay.nightDiffHours += nightHoursFor(rec);
      if (isRestDay) pay.restDayHours += hours;
    }
  }

  pay.basicHours = round2(pay.basicHours);
  pay.basicDays = round2(pay.basicHours / HOURS_PER_DAY);
  pay.paidLeaveDays = round2(pay.paidLeaveDays);
  pay.paidLeavePay = round2(pay.paidLeavePay);
  pay.nightDiffHours = round2(pay.nightDiffHours + (Number(nightDiffAdjustmentHours) || 0));
  pay.restDayHours = round2(pay.restDayHours + (Number(restDayAdjustmentHours) || 0));
  pay.basicPay = round2(pay.basicHours * hourly);
  pay.otPay = round2(pay.otHours * hourly * OT_MULTIPLIER);
  pay.utDeduction = round2(pay.utHours * hourly);
  pay.nightDiffPay = round2(pay.nightDiffHours * hourly * nightRate);
  pay.restDayPay = round2(pay.restDayHours * hourly * restPremium);

  pay.gross = round2(
    pay.basicPay +
      pay.holidayPay +
      pay.holidayPremium +
      pay.paidLeavePay +
      pay.otPay +
      pay.allowanceAmount +
      pay.bonusAmount +
      pay.nightDiffPay +
      pay.restDayPay -
      pay.utDeduction
  );

  // ─── Recurring deductions (loans / cash advances) ───
  const recurring = Array.isArray(recurringDeductions) ? recurringDeductions : [];
  for (const d of recurring) {
    const amount = round2(d.amount);
    if (amount <= 0) continue;
    pay.recurringDeductions.push({
      key: `recurring-${d.id ?? d.label}`,
      label: d.label || 'Recurring deduction',
      amount,
    });
  }
  pay.totalRecurringDeductions = round2(
    pay.recurringDeductions.reduce((s, d) => s + d.amount, 0)
  );

  // ─── Government contributions ───
  if (cfg) {
    const contributions = computeContributions({
      gross: pay.gross,
      periodDays: pay.periodDays,
      settings: cfg,
    });
    pay.contributions = contributions.employee;
    pay.employerContributions = contributions.employer;
    pay.totalContributions = contributions.totalEmployee;
    pay.employerContributionTotal = contributions.totalEmployer;
  }

  // ─── Deductions ───
  for (const c of pay.contributions) {
    pay.deductions.push({
      key: c.key,
      label: c.label,
      amount: c.amount,
    });
  }
  for (const d of pay.recurringDeductions) {
    pay.deductions.push({
      key: d.key,
      label: d.label,
      amount: d.amount,
    });
  }
  if (pay.otherDeductionAmount > 0) {
    pay.deductions.push({
      key: 'other_deduction',
      label: 'Other deduction',
      amount: pay.otherDeductionAmount,
    });
  }

  pay.totalDeductions = round2(
    pay.deductions.reduce((s, d) => s + d.amount, 0)
  );
  pay.net = round2(pay.gross - pay.totalDeductions);

  pay.thirteenthMonthAccrual =
    cfg && cfg.thirteenthMonth === false
      ? 0
      : round2(
          (pay.basicPay + pay.holidayPay + pay.paidLeavePay) /
            THIRTEENTH_MONTH_DIVISOR
        );

  // ─── Human-readable earnings breakdown ───
  if (pay.basicHours > 0) {
    pay.lines.push({
      key: 'basic',
      label: `Basic pay — ${pay.basicHours}h × ${hourly.toFixed(2)}/h`,
      amount: pay.basicPay,
    });
  }
  // Undertime is already subtracted from gross, so it belongs in the earnings
  // breakdown as a negative line. Keeping it out of `deductions` prevents net
  // pay from deducting the same hours twice.
  if (pay.utHours > 0) {
    pay.lines.push({
      key: 'undertime',
      label: `Undertime — ${pay.utHours}h × ${hourly.toFixed(2)}`,
      amount: -pay.utDeduction,
    });
  }
  if (pay.paidLeaveDays > 0) {
    pay.lines.push({
      key: 'paid_leave',
      label: `Paid leave — ${pay.paidLeaveDays} day${pay.paidLeaveDays === 1 ? '' : 's'}`,
      amount: pay.paidLeavePay,
    });
  }
  if (pay.holidayPayDays > 0) {
    pay.lines.push({
      key: 'holiday_unworked',
      label: `Holiday pay — ${pay.holidayPayDays} regular holiday${pay.holidayPayDays === 1 ? '' : 's'} (unworked)`,
      amount: pay.holidayPay,
    });
  }
  if (pay.workedHolidayDays > 0) {
    pay.lines.push({
      key: 'holiday_premium',
      label: `Holiday premium — ${pay.workedHolidayDays} holiday${pay.workedHolidayDays === 1 ? '' : 's'} worked`,
      amount: pay.holidayPremium,
    });
  }
  if (pay.nightDiffHours > 0) {
    pay.lines.push({
      key: 'night_diff',
      label: `Night differential — ${pay.nightDiffHours}h × ${(nightRate * 100).toFixed(0)}%`,
      amount: pay.nightDiffPay,
    });
  }
  if (pay.restDayHours > 0) {
    pay.lines.push({
      key: 'rest_day',
      label: `Rest-day premium — ${pay.restDayHours}h × ${(restPremium * 100).toFixed(0)}%`,
      amount: pay.restDayPay,
    });
  }
  if (pay.otHours > 0) {
    pay.lines.push({
      key: 'overtime',
      label: `Overtime — ${pay.otHours}h × ${hourly.toFixed(2)} × ${OT_MULTIPLIER}`,
      amount: pay.otPay,
    });
  }
  if (pay.allowanceAmount > 0) {
    pay.lines.push({
      key: 'allowance',
      label: 'Allowances',
      amount: pay.allowanceAmount,
    });
  }
  if (pay.bonusAmount > 0) {
    pay.lines.push({
      key: 'bonus',
      label: 'Bonus',
      amount: pay.bonusAmount,
    });
  }

  return pay;
}

export default { aggregatePayrollRows, computeEmployeePay, addDaysISO };
