// admin-panel/src/features/payroll/domain/payrollRules.js
//
// Philippine pay rules used by payrollCalc.js.
// References: Labor Code of the Philippines, Book III (Hours of Work,
// Overtime, Premium Pay) and the holiday pay matrix issued by the
// Office of the President.
//
//   Situation                              | Pay
//   ---------------------------------------|---------
//   Regular holiday — did not work         | 100% of daily rate*
//   Regular holiday — worked               | 200% of daily rate
//   Special non-working day — did not work | No pay ("no work, no pay")
//   Special non-working day — worked       | 130% of daily rate
//   Overtime on an ordinary day            | +25% of hourly rate
//
//   * 100% unworked regular holiday pay is owed when the employee reported
//     for work on the day immediately preceding the holiday.
//
// Rest-day premium (+30%) is intentionally not applied: it requires knowing
// each employee's designated rest days, which this app does not track yet.

/** PH Labor Code normal working day — hourly rate = daily rate ÷ 8. */
export const HOURS_PER_DAY = 8;

/** Overtime premium on an ordinary day: hourly × 1.25. */
export const OT_MULTIPLIER = 1.25;

/** Regular holiday multiplier when the employee worked. */
export const REGULAR_HOLIDAY_WORKED = 2.0;

/** Regular holiday pay when unworked (subject to the day-before rule). */
export const REGULAR_HOLIDAY_UNWORKED = 1.0;

/** Special non-working day multiplier when the employee worked. */
export const SPECIAL_HOLIDAY_WORKED = 1.3;

/** Special non-working day pay when unworked. */
export const SPECIAL_HOLIDAY_UNWORKED = 0;

/** Multiplier for a worked holiday, by holiday kind. */
export function holidayWorkedMultiplier(kind) {
  return kind === 'regular' ? REGULAR_HOLIDAY_WORKED : SPECIAL_HOLIDAY_WORKED;
}

/** Peso formatter used across the payroll UI. */
const PESO = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
});

export function peso(amount) {
  return PESO.format(Number(amount) || 0);
}

/** Peso amount without the symbol, e.g. "1,234.50" — for tables/PDF. */
const NUM = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function pesoValue(amount) {
  return NUM.format(Number(amount) || 0);
}
