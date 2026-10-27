// admin-panel/src/features/payroll/domain/payrollRules.js
//
// Philippine pay rules used by payrollCalc.js.
// References: Labor Code of the Philippines, Book III (Hours of Work,
// Overtime, Premium Pay), the holiday pay matrix issued by the
// Office of the President, and the SSS / PhilHealth / Pag-IBIG / BIR
// contribution schedules.
//
//   Situation                              | Pay
//   ---------------------------------------|---------
//   Regular holiday — did not work         | 100% of daily rate*
//   Regular holiday — worked               | 200% of daily rate
//   Special non-working day — did not work | No pay ("no work, no pay")
//   Special non-working day — worked       | 130% of daily rate
//   Overtime on an ordinary day            | +25% of hourly rate
//   Night shift (22:00–06:00)              | +10% of hourly rate
//   Rest day worked                        | +30% of hourly rate
//
//   * 100% unworked regular holiday pay is owed when the employee reported
//     for work on the day immediately preceding the holiday.
//
// Basic pay is prorated from the hours actually worked: the daily rate covers
// a normal 8-hour day, and a shorter day earns only the hours rendered.

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

/** Night differential premium (22:00–06:00). */
export const NIGHT_DIFF_RATE = 0.1;

/** Rest-day premium for hours worked on the employee's rest day. */
export const REST_DAY_PREMIUM = 0.3;

/** 13th-month pay divisor. */
export const THIRTEENTH_MONTH_DIVISOR = 12;

/** Multiplier for a worked holiday, by holiday kind. */
export function holidayWorkedMultiplier(kind) {
  return kind === 'regular' ? REGULAR_HOLIDAY_WORKED : SPECIAL_HOLIDAY_WORKED;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Default payroll settings
// ─────────────────────────────────────────────────────────────────────────────
//
// Contribution bases are expressed as MONTHLY amounts. payrollCalc prorates
// them to the length of the cutoff (7 days for weekly, 15/16 for semi-monthly)
// so the deduction stays proportional. Admins can edit every number from
// Payroll → Settings.
//
export const DEFAULT_TAX_BRACKETS = [
  { upTo: 20833, base: 0, rate: 0 },
  { upTo: 33333, base: 0, rate: 0.15 },
  { upTo: 66667, base: 2500, rate: 0.2 },
  { upTo: 166667, base: 10833.33, rate: 0.25 },
  { upTo: 666667, base: 40833.33, rate: 0.3 },
  { upTo: null, base: 200833.33, rate: 0.35 },
];

export const DEFAULT_PAYROLL_SETTINGS = {
  contributions: {
    sss: {
      enabled: true,
      rate: 0.045,
      employerRate: 0.095,
      minBase: 0,
      maxBase: 20250,
    },
    philhealth: {
      enabled: true,
      rate: 0.02,
      employerRate: 0.02,
      minBase: 10000,
      maxBase: 100000,
    },
    pagibig: {
      enabled: true,
      rate: 0.02,
      employerRate: 0.02,
      minBase: 0,
      maxBase: 10000,
    },
    tax: { enabled: true },
  },
  taxBrackets: DEFAULT_TAX_BRACKETS,
  nightDiffRate: NIGHT_DIFF_RATE,
  restDayPremium: REST_DAY_PREMIUM,
  thirteenthMonth: true,
  autoApproveAdjustments: false,
};

/** Deep-merge stored settings over the defaults (safe for partial JSON). */
export function mergePayrollSettings(stored) {
  const base = DEFAULT_PAYROLL_SETTINGS;
  if (!stored || typeof stored !== 'object') return { ...base };

  const contributions = { ...base.contributions };
  for (const key of Object.keys(base.contributions)) {
    contributions[key] = {
      ...base.contributions[key],
      ...(stored.contributions?.[key] ?? {}),
    };
  }

  return {
    ...base,
    ...stored,
    contributions,
    taxBrackets:
      Array.isArray(stored.taxBrackets) && stored.taxBrackets.length > 0
        ? stored.taxBrackets
        : base.taxBrackets,
  };
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function clamp(n, min, max) {
  let v = Number(n) || 0;
  if (min != null) v = Math.max(v, Number(min) || 0);
  if (max != null) v = Math.min(v, Number(max) || 0);
  return v;
}

/**
 * Progressive withholding tax on a period's taxable pay.
 * Monthly brackets are prorated to the cutoff length.
 */
export function computeWithholdingTax({
  taxable = 0,
  periodDays = 30,
  brackets = DEFAULT_TAX_BRACKETS,
} = {}) {
  const scale = Math.max(Number(periodDays) || 30, 1) / 30;
  const pay = Math.max(Number(taxable) || 0, 0);
  if (pay <= 0) return 0;

  let previous = 0;
  for (const bracket of brackets) {
    const ceiling = bracket.upTo == null ? null : Number(bracket.upTo) * scale;
    if (ceiling == null || pay <= ceiling) {
      const base = (Number(bracket.base) || 0) * scale;
      const excess = Math.max(pay - previous, 0);
      return round2(base + excess * (Number(bracket.rate) || 0));
    }
    previous = ceiling;
  }
  return 0;
}

/**
 * Employee + employer contributions for one cutoff.
 *
 * Returns:
 *   employee: [{ key, label, amount }]
 *   employer: [{ key, label, amount }]
 *   totalEmployee / totalEmployer
 */
export function computeContributions({
  gross = 0,
  periodDays = 30,
  settings = DEFAULT_PAYROLL_SETTINGS,
} = {}) {
  const cfg = mergePayrollSettings(settings);
  const scale = Math.max(Number(periodDays) || 30, 1) / 30;
  const pay = Math.max(Number(gross) || 0, 0);

  const employee = [];
  const employer = [];

  // No pay for the cutoff → no contributions. Without this, the monthly
  // minimum base would still charge PhilHealth on a zero-pay week.
  if (pay <= 0) {
    return { employee, employer, totalEmployee: 0, totalEmployer: 0 };
  }

  const labels = {
    sss: 'SSS contribution',
    philhealth: 'PhilHealth contribution',
    pagibig: 'Pag-IBIG contribution',
  };

  for (const key of ['sss', 'philhealth', 'pagibig']) {
    const c = cfg.contributions[key];
    if (!c?.enabled) continue;

    const minBase = (Number(c.minBase) || 0) * scale;
    const maxBase =
      c.maxBase == null ? Number.POSITIVE_INFINITY : Number(c.maxBase) * scale;
    const base = clamp(pay, minBase, maxBase);
    const employeeAmount = round2(base * (Number(c.rate) || 0));
    const employerAmount = round2(base * (Number(c.employerRate) || 0));

    if (employeeAmount > 0) {
      employee.push({ key, label: labels[key], amount: employeeAmount });
    }
    if (employerAmount > 0) {
      employer.push({
        key,
        label: `${labels[key]} (employer)`,
        amount: employerAmount,
      });
    }
  }

  if (cfg.contributions.tax?.enabled) {
    const tax = computeWithholdingTax({
      taxable: pay,
      periodDays,
      brackets: cfg.taxBrackets,
    });
    if (tax > 0) {
      employee.push({
        key: 'tax',
        label: 'Withholding tax',
        amount: tax,
      });
    }
  }

  return {
    employee,
    employer,
    totalEmployee: round2(employee.reduce((s, c) => s + c.amount, 0)),
    totalEmployer: round2(employer.reduce((s, c) => s + c.amount, 0)),
  };
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
