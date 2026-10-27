// admin-panel/src/core/utils/csv.js
//
// CSV exports. All downloads share the same escaping + filename stamp so the
// output opens cleanly in Excel (UTF-8 BOM included).

function escapeCSV(value) {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function stamp() {
  const now = new Date();
  return (
    now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    '_' +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0')
  );
}

function downloadCSV(filenamePrefix, headers, rows) {
  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCSV).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], {
    type: 'text/csv;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}_${stamp()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function num(value) {
  return (Number(value) || 0).toFixed(2);
}

export function exportAttendanceCSV(records, filenamePrefix = 'attendance') {
  if (!records || records.length === 0) {
    return false;
  }

  const headers = [
    'Employee',
    'Employee ID',
    'Position',
    'Date',
    'Time In',
    'Time Out',
    'Hours',
    'Status',
    'Notes',
  ];

  function fmtTime(iso) {
    if (!iso) return '--';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-PH', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  function hoursWorked(r) {
    if (!r.timeIn || !r.timeOut) return '';
    const ms = new Date(r.timeOut) - new Date(r.timeIn);
    if (ms <= 0) return '';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  }

  const rows = records.map((r) => [
    r.employeeName ?? '',
    r.employeeId ?? '',
    r.position ?? '',
    r.date ?? '',
    fmtTime(r.timeIn),
    fmtTime(r.timeOut),
    hoursWorked(r),
    r.status ?? '',
    r.notes ?? '',
  ]);

  downloadCSV(filenamePrefix, headers, rows);
  return true;
}

/**
 * Full payroll register for accounting.
 * `rows` are aggregatePayrollRows; `payMap` is the computeEmployeePay output.
 */
export function exportPayrollCSV(
  rows,
  payMap = {},
  { periodLabel = '', periodStart = '', periodEnd = '' } = {}
) {
  if (!rows || rows.length === 0) return 0;

  const headers = [
    'Employee',
    'Employee ID',
    'Department',
    'Position',
    'Period',
    'Daily Rate',
    'Present',
    'Late',
    'Absent',
    'Paid Leave Days',
    'Unpaid Leave Days',
    'Missing Time-out',
    'Hours Worked',
    'OT Hours',
    'UT Hours',
    'Night Diff Hours',
    'Rest Day Hours',
    'Gross Pay',
    'Deductions',
    'Net Pay',
    '13th Month Accrual',
    'Employer Contributions',
    'Bank',
    'Account Name',
    'Account Number',
  ];

  const body = rows.map((r) => {
    const pay = payMap?.[r.user_id] ?? {};
    return [
      r.full_name ?? '',
      r.employee_id ?? '',
      r.department ?? '',
      r.position ?? '',
      periodLabel,
      r.daily_rate == null ? '' : num(r.daily_rate),
      r.days_present ?? 0,
      r.days_late ?? 0,
      r.days_absent ?? 0,
      r.days_paid_leave ?? 0,
      r.days_unpaid_leave ?? 0,
      r.days_missing_timeout ?? 0,
      num(r.total_hours_worked),
      num(r.overtime_hours),
      num(r.undertime_hours),
      num(r.night_diff_hours),
      num(r.rest_day_hours),
      num(pay.gross),
      num(pay.totalDeductions),
      num(pay.net),
      num(pay.thirteenthMonthAccrual),
      num(pay.employerContributionTotal),
      r.bank_name ?? '',
      r.bank_account_name ?? '',
      r.bank_account_number ?? '',
    ];
  });

  downloadCSV(
    `payroll${periodStart ? `_${periodStart}_${periodEnd}` : ''}`,
    headers,
    body
  );
  return rows.length;
}

// Why an employee with bank details was left out of the bank file. Keeping the
// cause specific lets the toast say "no attendance" instead of a vague
// "net pay is zero" that sends people hunting through three screens.
function zeroNetReason(row, pay) {
  if (pay.hasRate === false) return 'no daily rate';

  const gross = Number(pay.gross) || 0;
  const net = Number(pay.net) || 0;
  if (gross > 0 && net <= 0) return 'deductions exceed gross pay';

  const days = Number(row.days_present) || 0;
  const paidLeave = Number(row.days_paid_leave) || 0;
  const hours = Number(row.total_hours_worked) || 0;
  if (days === 0 && paidLeave === 0 && hours === 0) {
    return 'no attendance recorded in this cutoff';
  }

  return 'net pay is 0.00';
}

/**
 * Shared eligibility pass for the bank file. The export and the Reports modal
 * both call this so the number on screen always matches the file.
 *
 * Returns:
 *   { count, total, withBank, missingBank, zeroNet, noPayRecord, blocked,
 *     missingBankPayable, eligible }
 *
 * `blocked` lists employees that had bank details but were skipped, and
 * `missingBankPayable` lists employees who *do* have pay but no account
 * number — usually the fastest thing to fix.
 */
export function summarizeBankEligibility(rows, payMap = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const summary = {
    count: 0,
    total: list.length,
    withBank: 0,
    missingBank: 0,
    zeroNet: 0,
    noPayRecord: 0,
    blocked: [],
    missingBankPayable: [],
    eligible: [],
  };

  for (const r of list) {
    const accountNumber = String(r.bank_account_number ?? '').trim();
    if (!accountNumber) {
      summary.missingBank += 1;
      const missingPay = payMap?.[r.user_id];
      if (Number(missingPay?.net) > 0) {
        summary.missingBankPayable.push({
          user_id: r.user_id,
          name: r.full_name || r.employee_id || 'Employee',
          net: Number(missingPay.net) || 0,
        });
      }
      continue;
    }

    summary.withBank += 1;
    const pay = payMap?.[r.user_id];

    if (!pay) {
      summary.noPayRecord += 1;
      summary.blocked.push({
        user_id: r.user_id,
        name: r.full_name || r.employee_id || 'Employee',
        reason: 'no pay record for this period',
      });
      continue;
    }

    if (!(Number(pay.net) > 0)) {
      summary.zeroNet += 1;
      summary.blocked.push({
        user_id: r.user_id,
        name: r.full_name || r.employee_id || 'Employee',
        net: Number(pay.net) || 0,
        gross: Number(pay.gross) || 0,
        deductions: Number(pay.totalDeductions) || 0,
        hasRate: pay.hasRate !== false,
        daysPresent: Number(r.days_present) || 0,
        hours: Number(r.total_hours_worked) || 0,
        reason: zeroNetReason(r, pay),
      });
      continue;
    }

    summary.eligible.push(r);
  }

  summary.count = summary.eligible.length;
  return summary;
}

/**
 * Bank transfer file. Only employees with a bank account number and a positive
 * net pay are included. Returns the summary from `summarizeBankEligibility`.
 */
export function exportBankCSV(
  rows,
  payMap = {},
  { periodLabel = '', periodStart = '', periodEnd = '' } = {}
) {
  const summary = summarizeBankEligibility(rows, payMap);
  const { eligible } = summary;

  if (eligible.length === 0) return summary;

  const headers = [
    'Bank',
    'Account Name',
    'Account Number',
    'Employee',
    'Employee ID',
    'Net Pay',
    'Period',
  ];

  const body = eligible.map((r) => {
    const pay = payMap?.[r.user_id] ?? {};
    return [
      r.bank_name ?? '',
      r.bank_account_name || r.full_name || '',
      r.bank_account_number ?? '',
      r.full_name ?? '',
      r.employee_id ?? '',
      num(pay.net),
      periodLabel,
    ];
  });

  downloadCSV(
    `bank-transfer${periodStart ? `_${periodStart}_${periodEnd}` : ''}`,
    headers,
    body
  );
  return summary;
}
