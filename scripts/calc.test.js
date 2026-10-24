// Verification harness for payrollCalc.js — run with:
//   npm run test:payroll
import {
  computeEmployeePay,
  aggregatePayrollRows,
  addDaysISO,
} from '../src/features/payroll/domain/payrollCalc.js';

let failures = 0;
function check(cond, label, actual) {
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label} → got ${JSON.stringify(actual)}`);
  }
}
function near(a, b) {
  return Math.abs((Number(a) || 0) - b) < 0.011;
}

const rec = (date, status = 'present', timeIn = `${date}T08:00:00+08:00`, timeOut = `${date}T17:00:00+08:00`) => ({
  user_id: 'u1',
  date,
  status,
  time_in: timeIn,
  time_out: timeOut,
});

// ── 1. Basic week: 5 days present, 2h OT, no holidays ──
console.log('\n[1] basic week Mon 2026-10-19 … Sun 2026-10-25');
let p = computeEmployeePay({
  dailyRate: 645,
  records: ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'].map((d) => rec(d)),
  holidaysByDate: new Map(),
  otHours: 2,
  utHours: 0,
  periodStart: '2026-10-19',
  periodEnd: '2026-10-25',
});
check(p.basicDays === 5, 'basicDays = 5', p.basicDays);
check(p.basicPay === 3225, 'basicPay = 3225', p.basicPay);
check(near(p.otPay, 201.56), 'otPay = 645/8*2*1.25 = 201.56', p.otPay);
check(near(p.gross, 3426.56), 'gross = 3426.56', p.gross);

// ── 2. Absent day is unpaid ──
console.log('\n[2] one absent day');
p = computeEmployeePay({
  dailyRate: 645,
  records: ['2026-10-19', '2026-10-20', '2026-10-22', '2026-10-23'].map((d) => rec(d)).concat([rec('2026-10-21', 'absent', null, null)]),
  holidaysByDate: new Map(),
  periodStart: '2026-10-19',
  periodEnd: '2026-10-25',
});
check(p.basicDays === 4, 'basicDays = 4 (absent unpaid)', p.basicDays);
check(near(p.gross, 2580), 'gross = 2580', p.gross);

// ── 3. Regular holiday WORKED → 200% ──
console.log('\n[3] regular holiday worked (200%)');
p = computeEmployeePay({
  dailyRate: 645,
  records: ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'].map((d) => rec(d)),
  holidaysByDate: new Map([['2026-10-21', { kind: 'regular', name: 'Test' }]]),
  periodStart: '2026-10-19',
  periodEnd: '2026-10-25',
});
check(p.basicDays === 5, 'basicDays = 5 (holiday worked counts as day)', p.basicDays);
check(p.holidayPremium === 645, 'holidayPremium = +645', p.holidayPremium);
check(near(p.gross, 3870), 'gross = 6×645 = 3870', p.gross);

// ── 4. Regular holiday UNWORKED, day before worked → 100% ──
console.log('\n[4] regular holiday unworked, worked day before (100%)');
p = computeEmployeePay({
  dailyRate: 645,
  records: ['2026-10-19', '2026-10-20', '2026-10-22', '2026-10-23'].map((d) => rec(d)),
  holidaysByDate: new Map([['2026-10-21', { kind: 'regular', name: 'Test' }]]),
  periodStart: '2026-10-19',
  periodEnd: '2026-10-25',
});
check(p.basicDays === 4, 'basicDays = 4', p.basicDays);
check(p.holidayPayDays === 1 && p.holidayPay === 645, 'holidayPay = 645 unworked', p.holidayPay);
check(near(p.gross, 3225), 'gross = 5×645 = 3225', p.gross);

// ── 5. Regular holiday unworked, day before NOT worked → nothing ──
console.log('\n[5] regular holiday unworked, day before also unworked (0%)');
p = computeEmployeePay({
  dailyRate: 645,
  records: ['2026-10-19', '2026-10-22', '2026-10-23'].map((d) => rec(d)),
  holidaysByDate: new Map([['2026-10-21', { kind: 'regular', name: 'Test' }]]),
  periodStart: '2026-10-19',
  periodEnd: '2026-10-25',
});
check(p.holidayPay === 0, 'no holiday pay (day before not worked)', p.holidayPay);
check(p.basicDays === 3, 'basicDays = 3', p.basicDays);

// ── 6. Special holiday WORKED → 130%; unworked → 0 ──
console.log('\n[6] special holiday worked (130%) / unworked (0%)');
p = computeEmployeePay({
  dailyRate: 645,
  records: ['2026-10-21'].map((d) => rec(d)),
  holidaysByDate: new Map([['2026-10-21', { kind: 'special', name: 'Test' }]]),
  periodStart: '2026-10-19',
  periodEnd: '2026-10-25',
});
check(near(p.holidayPremium, 193.5), 'premium = 645×0.3 = 193.50', p.holidayPremium);
check(near(p.gross, 838.5), 'gross = 838.50', p.gross);

p = computeEmployeePay({
  dailyRate: 645,
  records: [rec('2026-10-20')],
  holidaysByDate: new Map([['2026-10-21', { kind: 'special', name: 'Test' }]]),
  periodStart: '2026-10-19',
  periodEnd: '2026-10-25',
});
check(p.holidayPay === 0 && p.holidayPayDays === 0, 'special unworked = no pay', p.holidayPay);

// ── 7. Undertime deduction ──
console.log('\n[7] undertime deduction');
p = computeEmployeePay({
  dailyRate: 645,
  records: ['2026-10-19'].map((d) => rec(d)),
  holidaysByDate: new Map(),
  utHours: 1,
  periodStart: '2026-10-19',
  periodEnd: '2026-10-25',
});
check(near(p.utDeduction, 80.63), 'UT 1h = 80.63', p.utDeduction);
check(near(p.gross, 564.37), 'gross = 645 − 80.63 = 564.37', p.gross);

// ── 8. Holiday on the period boundary uses the day-before record ──
console.log('\n[8] holiday first day of period, worked day before period start');
p = computeEmployeePay({
  dailyRate: 645,
  // day-before record sits outside the period but inside the fetch range
  records: [rec('2026-10-18')],
  holidaysByDate: new Map([['2026-10-19', { kind: 'regular', name: 'Test' }]]),
  periodStart: '2026-10-19',
  periodEnd: '2026-10-25',
});
check(p.holidayPay === 645, 'boundary holiday paid', p.holidayPay);

// ── 9. No rate → hasRate false, gross 0 ──
console.log('\n[9] missing rate');
p = computeEmployeePay({
  dailyRate: null,
  records: ['2026-10-19'].map((d) => rec(d)),
  holidaysByDate: new Map(),
  periodStart: '2026-10-19',
  periodEnd: '2026-10-25',
});
check(p.hasRate === false && p.gross === 0, 'no rate → gross 0', p);

// ── 10. on_leave counts as paid ──
console.log('\n[10] on_leave paid');
p = computeEmployeePay({
  dailyRate: 645,
  records: [rec('2026-10-19', 'on_leave', null, null)],
  holidaysByDate: new Map(),
  periodStart: '2026-10-19',
  periodEnd: '2026-10-25',
});
check(p.basicDays === 1 && near(p.gross, 645), 'on_leave paid', p);

// ── 11. aggregatePayrollRows: counts + exclusion of day-before record ──
console.log('\n[11] aggregatePayrollRows');
const rows = aggregatePayrollRows({
  profiles: [
    { id: 'u1', full_name: 'Ana Cruz', employee_id: 'E1', position: 'Cashier', daily_rate: 645, is_active: true },
    { id: 'u2', full_name: 'Ben Santos', employee_id: 'E2', position: 'Crew', daily_rate: null, is_active: false },
    { id: 'u3', full_name: 'Cara Reyes', employee_id: 'E3', position: 'Crew', daily_rate: 500, is_active: true },
  ],
  attendance: [
    rec('2026-10-19'),
    rec('2026-10-20', 'late'),
    rec('2026-10-21', 'absent', null, null),
    rec('2026-10-18'), // day BEFORE period → must not be counted
    { ...rec('2026-10-22'), time_out: null }, // missing timeout
    { ...rec('2026-10-20'), user_id: 'u2' }, // inactive employee worked → included
  ],
  adjustments: [
    { user_id: 'u1', work_date: '2026-10-22', kind: 'overtime', minutes: 120 },
    { user_id: 'u1', work_date: '2026-10-20', kind: 'undertime', minutes: 30 },
    { user_id: 'u1', work_date: '2026-10-10', kind: 'overtime', minutes: 999 }, // outside → ignored
  ],
  from: '2026-10-19',
  to: '2026-10-25',
});
const r1 = rows.find((r) => r.user_id === 'u1');
const r2 = rows.find((r) => r.user_id === 'u2');
check(rows.length === 3, '3 rows (active + inactive-with-work)', rows.length);
check(r1.days_present === 2 && r1.days_late === 1 && r1.days_absent === 1, 'day statuses counted (2 present incl. missing-out day)', r1);
check(r1.days_missing_timeout === 1, 'missing timeout counted', r1.days_missing_timeout);
check(r1.overtime_hours === 2 && r1.undertime_hours === 0.5, 'OT 2h / UT 0.5h', { ot: r1.overtime_hours, ut: r1.undertime_hours });
check(near(r1.total_hours_worked, 18), 'hours = 18 (day-before excluded, missing-out contributes 0)', r1.total_hours_worked);
check(r2 && r2.days_present === 1, 'inactive employee with work included', r2?.days_present);
check(rows.every((r) => r.cutoff_start === '2026-10-19'), 'period stamped on rows', rows[0]?.cutoff_start);

// ── 12. addDaysISO across month boundary ──
console.log('\n[12] addDaysISO');
check(addDaysISO('2026-10-31', 1) === '2026-11-01', 'month rollover', addDaysISO('2026-10-31', 1));
check(addDaysISO('2027-01-01', -1) === '2026-12-31', 'year rollover back', addDaysISO('2027-01-01', -1));

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
