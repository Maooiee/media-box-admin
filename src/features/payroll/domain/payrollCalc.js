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
  holidayWorkedMultiplier,
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

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function hoursBetween(a, b) {
  if (!a || !b) return 0;
  const ms = new Date(b) - new Date(a);
  return ms > 0 ? ms / 3600000 : 0;
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
        daily_rate: profile?.daily_rate ?? null,
        days_present: 0,
        days_late: 0,
        days_absent: 0,
        days_on_leave: 0,
        days_missing_timeout: 0,
        total_hours_worked: 0,
        overtime_hours: 0,
        undertime_hours: 0,
        overtime_minutes: 0,
        undertime_minutes: 0,
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
    else if (a.status === 'on_leave') row.days_on_leave += 1;

    if (a.time_in && !a.time_out) row.days_missing_timeout += 1;
    row.total_hours_worked += hoursBetween(a.time_in, a.time_out);
  }

  for (const adj of adjustments ?? []) {
    if (adj.work_date < from || adj.work_date > to) continue;
    const row = ensure(adj.user_id, byId.get(adj.user_id));
    const minutes = Number(adj.minutes) || 0;
    if (adj.kind === 'overtime') {
      row.overtime_minutes += minutes;
      row.overtime_hours += minutes / 60;
    } else if (adj.kind === 'undertime') {
      row.undertime_minutes += minutes;
      row.undertime_hours += minutes / 60;
    }
  }

  const out = [...rows.values()];
  for (const r of out) {
    r.total_hours_worked = round2(r.total_hours_worked);
    r.overtime_hours = round2(r.overtime_hours);
    r.undertime_hours = round2(r.undertime_hours);
  }
  return out.sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
}

// ─────────────────────────────────────────────────────
//  Pay — pesos for one employee over one period
// ─────────────────────────────────────────────────────
//
//  dailyRate   ₱ per regular working day (null/0 → nothing is computed)
//  records     attendance rows covering (periodStart − 1 day) … periodEnd;
//              the extra day is needed for the unworked-regular-holiday rule
//  holidaysByDate  Map<'YYYY-MM-DD', { kind: 'regular'|'special', name }>
//  otHours / utHours  from payroll_adjustments
//
export function computeEmployeePay({
  dailyRate,
  records,
  holidaysByDate,
  otHours = 0,
  utHours = 0,
  periodStart,
  periodEnd,
}) {
  const rate = Number(dailyRate) || 0;
  const hourly = rate / HOURS_PER_DAY;

  const pay = {
    rate,
    hourly,
    basicDays: 0,
    holidayPayDays: 0,   // unworked regular holidays paid at 100%
    workedHolidayDays: 0,
    basicPay: 0,
    holidayPay: 0,       // unworked regular holiday pay
    holidayPremium: 0,   // extra 100% / 30% earned by working a holiday
    otHours: round2(otHours),
    otPay: 0,
    utHours: round2(utHours),
    utDeduction: 0,
    gross: 0,
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

  for (const date of eachDate(periodStart, periodEnd)) {
    const holiday = holidaysByDate.get(date);
    const rec = byDate.get(date);

    if (holiday) {
      if (workedOn(date)) {
        const mult = holidayWorkedMultiplier(holiday.kind);
        pay.workedHolidayDays += 1;
        pay.basicDays += 1; // the first 100% counts as a normal paid day
        pay.holidayPremium += rate * (mult - 1);
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
    if (rec.status === 'on_leave' || rec.time_in) {
      pay.basicDays += 1;
    }
  }

  pay.basicPay = pay.basicDays * rate;
  pay.otPay = pay.otHours * hourly * OT_MULTIPLIER;
  pay.utDeduction = pay.utHours * hourly;

  pay.basicPay = round2(pay.basicPay);
  pay.holidayPay = round2(pay.holidayPay);
  pay.holidayPremium = round2(pay.holidayPremium);
  pay.otPay = round2(pay.otPay);
  pay.utDeduction = round2(pay.utDeduction);
  pay.gross = round2(
    pay.basicPay + pay.holidayPay + pay.holidayPremium + pay.otPay - pay.utDeduction
  );

  // Human-readable breakdown for the drawer and the payslip PDF.
  if (pay.basicDays > 0) {
    pay.lines.push({
      key: 'basic',
      label: `Basic pay — ${pay.basicDays} day${pay.basicDays === 1 ? '' : 's'} × ${pay.rate.toFixed(2)}`,
      amount: pay.basicPay,
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
  if (pay.otHours > 0) {
    pay.lines.push({
      key: 'overtime',
      label: `Overtime — ${pay.otHours}h × ${hourly.toFixed(2)} × ${OT_MULTIPLIER}`,
      amount: pay.otPay,
    });
  }
  if (pay.utHours > 0) {
    pay.deductions.push({
      key: 'undertime',
      label: `Undertime — ${pay.utHours}h × ${hourly.toFixed(2)}`,
      amount: pay.utDeduction,
    });
  }

  return pay;
}
