// admin-panel/src/features/payroll/data/payrollRepository.js
//
// Data layer for admin-side payroll summaries, adjustments, settings, runs,
// recurring deductions and the audit log.
//
// Every new table is queried defensively: if the payroll suite migration has
// not been applied yet, the page still loads with sensible defaults.

import { supabase } from '../../../core/config/supabase';
import { missingColumnName } from '../../../core/utils/dbErrors';
import { aggregatePayrollRows, addDaysISO } from '../domain/payrollCalc';
import { addDaysToDate, toManilaDate } from '../../../core/utils/formatters';
import {
  fetchLeaveDaysByUser,
  fetchLeaveDaysDetailedByUser,
  fetchLeaveTypeSettings,
} from '../../leave/data/leaveStatusRepository';
import { payrollSettingsRepository } from './payrollSettingsRepository';

// ─────────────────────────────────────────────────────────────────────────────
//  Small helpers
// ─────────────────────────────────────────────────────────────────────────────
function isoFromParts(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function labelDate(dateStr, opts) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-PH', {
    timeZone: 'UTC',
    ...opts,
  });
}

function periodLabel(start, end) {
  return `${labelDate(start, { month: 'short', day: 'numeric' })} – ${labelDate(end, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
}

function isMissingTable(error) {
  const message = String(error?.message ?? error ?? '');
  return /relation .* does not exist|could not find the table|schema cache/i.test(
    message
  );
}

function isMissingColumn(error) {
  const message = String(error?.message ?? error ?? '');
  return /column .* does not exist|could not find the '.*' column|schema cache/i.test(
    message
  );
}

// Adjustments that carry a peso amount instead of a duration. The payroll
// suite's legacy CHECK on `minutes` rejects 0 even for these rows, so they are
// stored with a harmless 1 minute (the calculator ignores minutes for them).
const AMOUNT_ONLY_KINDS = new Set([
  'allowance',
  'bonus',
  'loan',
  'cash_advance',
  'other_deduction',
]);

const MAX_ADJUSTMENT_MINUTES = 24 * 60;

function isMinutesCheckError(error) {
  return /payroll_adjustments_minutes_check/i.test(
    String(error?.message ?? error ?? '')
  );
}

/**
 * Approved leave days. The detailed map carries the leave type and whether it
 * is paid. Synthetic `on_leave` rows are added when an approval was never
 * materialised, without overwriting a real check-in or duplicating a row.
 */
function withLeaveDays(attendance, leaveDetailsByUser, from, to) {
  const out = (attendance ?? []).map((row) => {
    const info = leaveDetailsByUser?.get(row.user_id)?.get(row.date);
    if (!info) return row;

    // Approved leave supersedes an existing non-check-in row. Without this,
    // the day would count as both absent and on leave (and paid leave would
    // still add pay on top of the absent day).
    if (row.status === 'on_leave' || (!row.time_in && row.status === 'absent')) {
      return {
        ...row,
        status: 'on_leave',
        is_paid: info.isPaid,
        leave_type: info.type,
        half_day: info.halfDay,
      };
    }

    return row;
  });

  const covered = new Set();
  for (const row of out) {
    if (!row?.user_id || !row?.date) continue;
    if (row.date < from || row.date > to) continue;
    if (row.time_in || row.status === 'on_leave') {
      covered.add(`${row.user_id}|${row.date}`);
    }
  }

  for (const [userId, dates] of leaveDetailsByUser ?? []) {
    for (const [date, info] of dates) {
      if (date < from || date > to) continue;
      const key = `${userId}|${date}`;
      if (covered.has(key)) continue;
      covered.add(key);
      out.push({
        id: `leave-${userId}-${date}`,
        user_id: userId,
        date,
        time_in: null,
        time_out: null,
        status: 'on_leave',
        is_paid: info.isPaid,
        leave_type: info.type,
        half_day: info.halfDay,
      });
    }
  }

  return out;
}

/// Monday of the week containing a Manila business date (YYYY-MM-DD).
function mondayOfWeek(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sun
  return addDaysToDate(dateStr, -((weekday + 6) % 7));
}

/// Weekly pay periods — Monday to Sunday, most recent first.
export function recentWeeklyCutoffs(count = 12) {
  const currentMonday = mondayOfWeek(toManilaDate());
  const out = [];

  for (let i = 0; i < count; i++) {
    const start = addDaysToDate(currentMonday, -i * 7);
    const end = addDaysToDate(start, 6);
    out.push({ start, end, label: periodLabel(start, end) });
  }
  return out;
}

export function recentCutoffs(count = 12) {
  const [yearStr, monthStr] = toManilaDate().split('-');
  let y = Number(yearStr);
  let m = Number(monthStr) - 1; // 0-based, for the last-day calculation
  const out = [];

  while (out.length < count) {
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    out.push({ start: isoFromParts(y, m, 16), end: isoFromParts(y, m, lastDay) });
    if (out.length >= count) break;
    out.push({ start: isoFromParts(y, m, 1), end: isoFromParts(y, m, 15) });

    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }

  return out.map((c) => ({ ...c, label: periodLabel(c.start, c.end) }));
}

/** Quick ranges used by the custom cutoff menu. */
export function quickCutoffRanges() {
  const today = toManilaDate();
  const [y, m, d] = today.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const monday = addDaysToDate(today, -((dow + 6) % 7));
  const lastMonday = addDaysToDate(monday, -7);
  const monthStart = isoFromParts(y, m - 1, 1);
  const monthEnd = isoFromParts(
    y,
    m - 1,
    new Date(Date.UTC(y, m, 0)).getUTCDate()
  );
  const lastMonthEnd = addDaysToDate(monthStart, -1);
  const [ly, lm] = lastMonthEnd.split('-').map(Number);
  const lastMonthStart = isoFromParts(ly, lm - 1, 1);

  const mk = (start, end) => ({
    start,
    end,
    label: periodLabel(start, end),
  });

  return [
    { key: 'this_week', label: 'This week', ...mk(monday, addDaysToDate(monday, 6)) },
    { key: 'last_week', label: 'Last week', ...mk(lastMonday, addDaysToDate(lastMonday, 6)) },
    { key: 'this_month', label: 'This month', ...mk(monthStart, monthEnd) },
    { key: 'last_month', label: 'Last month', ...mk(lastMonthStart, lastMonthEnd) },
  ];
}

export async function fetchPayrollForCutoff({ from, to }) {
  const { data, error } = await supabase
    .from('payroll_summary')
    .select('*')
    .eq('cutoff_start', from)
    .eq('cutoff_end', to)
    .order('full_name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

const PROFILE_BASE_COLUMNS = [
  'id',
  'full_name',
  'employee_id',
  'email',
  'position',
  'is_active',
];
const PROFILE_RATE_COLUMNS = [...PROFILE_BASE_COLUMNS, 'daily_rate'];
const PROFILE_FULL_COLUMNS = [
  ...PROFILE_RATE_COLUMNS,
  'department',
  'rest_day',
  'bank_name',
  'bank_account_name',
  'bank_account_number',
  'payroll_role',
];

async function fetchProfiles() {
  let columns = [...PROFILE_FULL_COLUMNS];
  let ratesAvailable = true;
  let result;

  // Degrade one missing column at a time instead of dropping the whole payroll
  // profile. This keeps bank details available when only an unrelated column
  // (for example payroll_role) has not been migrated yet.
  for (let attempt = 0; attempt <= columns.length; attempt += 1) {
    result = await supabase
      .from('profiles')
      .select(columns.join(', '))
      .order('full_name', { ascending: true });

    if (!result.error) break;

    const missing = missingColumnName(result.error, columns);
    if (!missing) break;

    if (missing === 'daily_rate') ratesAvailable = false;
    columns = columns.filter((column) => column !== missing);
    if (columns.length === 0) break;
  }

  if (result.error) throw result.error;
  return { profiles: result.data ?? [], ratesAvailable };
}

async function fetchAdjustmentsForRange({ from, to }) {
  const dayBefore = addDaysISO(from, -1);
  let result = await supabase
    .from('payroll_adjustments')
    .select('user_id, work_date, kind, minutes, amount, status')
    .gte('work_date', dayBefore)
    .lte('work_date', to);

  if (result.error && (isMissingColumn(result.error) || isMissingTable(result.error))) {
    if (isMissingTable(result.error)) {
      return { adjustments: [], available: false };
    }
    result = await supabase
      .from('payroll_adjustments')
      .select('user_id, work_date, kind, minutes')
      .gte('work_date', dayBefore)
      .lte('work_date', to);
  }

  if (result.error) throw result.error;
  return { adjustments: result.data ?? [], available: true };
}

async function fetchRecurringDeductions({ userId = null } = {}) {
  try {
    let query = supabase
      .from('payroll_deductions')
      .select(
        'id, user_id, kind, label, amount, is_recurring, total_installments, installments_paid, start_date, end_date, is_active'
      )
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (userId) query = query.eq('user_id', userId);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    if (!isMissingTable(e)) {
      console.warn('Recurring deductions fetch failed:', e?.message ?? e);
    }
    return [];
  }
}

/// Builds the payroll summary for ANY period (weekly, semi-monthly, custom).
/// Returns rows plus the raw data needed by the UI (settings, leave types,
/// recurring deductions, and whether the payroll tables are available).
export async function fetchPayrollRows({ from, to }) {
  const dayBefore = addDaysISO(from, -1);

  const attendancePromise = supabase
    .from('attendance_records')
    .select('user_id, date, time_in, time_out, status')
    .gte('date', dayBefore)
    .lte('date', to);

  const [
    profilesResult,
    attendanceRes,
    adjustmentsResult,
    leaveTypes,
    settingsResult,
    recurringDeductions,
  ] = await Promise.all([
    fetchProfiles(),
    attendancePromise,
    fetchAdjustmentsForRange({ from, to }),
    fetchLeaveTypeSettings(),
    payrollSettingsRepository.fetchSettings(),
    fetchRecurringDeductions(),
  ]);

  const leaveDetails = await fetchLeaveDaysDetailedByUser(
    from,
    to,
    leaveTypes
  );

  if (attendanceRes.error) throw attendanceRes.error;

  const attendance = withLeaveDays(
    attendanceRes.data ?? [],
    leaveDetails,
    from,
    to
  );

  const { profiles, ratesAvailable } = profilesResult;

  return {
    rows: aggregatePayrollRows({
      profiles: profiles.map((p) => ({
        ...p,
        daily_rate: ratesAvailable ? p.daily_rate : null,
      })),
      attendance,
      adjustments: adjustmentsResult.adjustments,
      from,
      to,
    }),
    attendance,
    adjustments: adjustmentsResult.adjustments,
    ratesAvailable,
    adjustmentsAvailable: adjustmentsResult.available,
    settings: settingsResult.settings,
    settingsAvailable: settingsResult.available,
    leaveTypes,
    leaveDetails,
    recurringDeductions,
    profiles,
  };
}

export async function fetchAdjustments({ userId, from, to }) {
  let result = await supabase
    .from('payroll_adjustments')
    .select(
      'id, user_id, work_date, kind, minutes, amount, reason, status, approved_at, rejected_at, decision_note, created_at'
    )
    .eq('user_id', userId)
    .gte('work_date', from)
    .lte('work_date', to)
    .order('work_date', { ascending: false });

  if (result.error && isMissingColumn(result.error)) {
    result = await supabase
      .from('payroll_adjustments')
      .select('id, user_id, work_date, kind, minutes, reason, approved_at')
      .eq('user_id', userId)
      .gte('work_date', from)
      .lte('work_date', to)
      .order('work_date', { ascending: false });
  }

  if (result.error) {
    if (isMissingTable(result.error)) return [];
    throw result.error;
  }
  return result.data ?? [];
}

export async function fetchDailyAttendance({ userId, from, to }) {
  const [recordsRes, leaveTypes] = await Promise.all([
    supabase
      .from('attendance_records')
      .select('id, date, time_in, time_out, status, selfie_url, notes')
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true }),
    fetchLeaveTypeSettings(),
  ]);

  if (recordsRes.error) throw recordsRes.error;

  const leaveDetails = await fetchLeaveDaysDetailedByUser(from, to, leaveTypes);

  return withLeaveDays(recordsRes.data ?? [], leaveDetails, from, to)
    .filter((row) => row.user_id === userId)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export async function addAdjustment({
  userId,
  workDate,
  kind,
  minutes,
  amount = null,
  reason,
  adminId,
  status = 'pending',
}) {
  if (!userId) throw new Error('userId is required');
  if (!workDate) throw new Error('workDate is required');
  const allowed = [
    'overtime',
    'undertime',
    'night_diff',
    'rest_day',
    'allowance',
    'bonus',
    'loan',
    'cash_advance',
    'other_deduction',
  ];
  if (!allowed.includes(kind)) {
    throw new Error(`kind must be one of: ${allowed.join(', ')}`);
  }

  const amountOnly = AMOUNT_ONLY_KINDS.has(kind);
  const rawMinutes = Number(minutes) || 0;

  if (!amountOnly && rawMinutes <= 0) {
    throw new Error('minutes must be > 0');
  }
  if (!amountOnly && rawMinutes > MAX_ADJUSTMENT_MINUTES) {
    throw new Error('Duration cannot exceed 24 hours (1440 minutes)');
  }
  if (amountOnly && (!amount || Number(amount) <= 0)) {
    throw new Error('amount must be > 0');
  }

  // Amount-only rows carry no duration, but the payroll suite's legacy CHECK on
  // `minutes` rejected 0. A single minute satisfies it and is ignored by the
  // calculator for these kinds. The schema_hardening migration relaxes that
  // check; the stored value is ignored either way.
  const minutesValue = amountOnly ? 1 : Math.max(1, Math.round(rawMinutes));

  const payload = {
    user_id: userId,
    work_date: workDate,
    kind,
    minutes: minutesValue,
    amount: amount == null ? null : Number(amount),
    reason: reason || null,
    status,
    created_by: adminId || null,
  };

  // Approval metadata only exists once a row is approved. Sending
  // `approved_at: null` trips the legacy NOT NULL constraint, so the keys are
  // omitted entirely for pending rows and the column default decides.
  if (status === 'approved') {
    payload.approved_by = adminId || null;
    payload.approved_at = new Date().toISOString();
  }

  async function insertRow(row) {
    let res = await supabase
      .from('payroll_adjustments')
      .insert(row)
      .select('id')
      .maybeSingle();

    // If this deployment requires `minutes = 0` for amount-only rows instead,
    // retry with the opposite value.
    if (res.error && amountOnly && isMinutesCheckError(res.error)) {
      res = await supabase
        .from('payroll_adjustments')
        .insert({ ...row, minutes: row.minutes === 0 ? 1 : 0 })
        .select('id')
        .maybeSingle();
    }

    return res;
  }

  let result = await insertRow(payload);

  // Older schema: retry without the newer columns.
  if (result.error && isMissingColumn(result.error)) {
    result = await insertRow({
      user_id: userId,
      work_date: workDate,
      kind,
      minutes: minutesValue,
      reason: reason || null,
      approved_by: adminId || null,
    });
  }

  if (result.error) {
    if (isMinutesCheckError(result.error)) {
      throw new Error(
        amountOnly
          ? 'The database rejected this adjustment. Please try saving it again.'
          : 'The database rejected this duration. Try a shorter duration (max 24 hours) or split it into two entries.'
      );
    }
    throw result.error;
  }

  if (adminId) {
    logAudit({
      actorId: adminId,
      action: 'adjustment.created',
      entity: 'payroll_adjustment',
      entityId: result.data?.id ?? null,
      details: { kind, workDate, minutes, amount, status },
    });
  }

  return { success: true, id: result.data?.id ?? null };
}

export async function setAdjustmentStatus({
  id,
  status,
  adminId,
  note = null,
}) {
  if (!id) throw new Error('id is required');
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    throw new Error('Invalid adjustment status');
  }

  const now = new Date().toISOString();
  const payload = {
    status,
    decision_note: note || null,
  };
  if (status === 'approved') {
    payload.approved_by = adminId || null;
    payload.approved_at = now;
    payload.rejected_by = null;
    payload.rejected_at = null;
  } else if (status === 'rejected') {
    payload.rejected_by = adminId || null;
    payload.rejected_at = now;
    payload.approved_by = null;
    payload.approved_at = null;
  }

  let result = await supabase
    .from('payroll_adjustments')
    .update(payload)
    .eq('id', id);

  // Rejecting clears `approved_at`. On a schema where that column is still
  // NOT NULL the update is rejected, so retry without clearing it. The
  // payroll_adjustment_approval_nullable migration removes this case.
  if (
    result.error &&
    /null value in column "approved_at"/i.test(result.error.message ?? '')
  ) {
    const withoutApprovedAt = { ...payload };
    delete withoutApprovedAt.approved_at;
    result = await supabase
      .from('payroll_adjustments')
      .update(withoutApprovedAt)
      .eq('id', id);
  }

  if (result.error && isMissingColumn(result.error)) {
    result = await supabase
      .from('payroll_adjustments')
      .update({ status })
      .eq('id', id);
  }

  if (result.error) throw result.error;

  if (adminId) {
    logAudit({
      actorId: adminId,
      action:
        status === 'approved'
          ? 'adjustment.approved'
          : status === 'rejected'
            ? 'adjustment.rejected'
            : 'adjustment.pending',
      entity: 'payroll_adjustment',
      entityId: id,
      details: { note: note || null },
    });
  }

  return { success: true };
}

export async function fetchPendingAdjustments({ from, to }) {
  try {
    const { data, error } = await supabase
      .from('payroll_adjustments')
      .select(
        'id, user_id, work_date, kind, minutes, amount, reason, status, created_at'
      )
      .eq('status', 'pending')
      .gte('work_date', from)
      .lte('work_date', to)
      .order('work_date', { ascending: true });

    if (error) {
      if (isMissingTable(error) || isMissingColumn(error)) return [];
      throw error;
    }

    const rows = data ?? [];
    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
    let profileMap = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, employee_id')
        .in('id', userIds);
      profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
    }

    return rows.map((r) => ({
      ...r,
      employee_name: profileMap[r.user_id]?.full_name ?? 'Unknown',
      employee_id: profileMap[r.user_id]?.employee_id ?? '',
    }));
  } catch (e) {
    console.warn('Pending adjustments fetch failed:', e?.message ?? e);
    return [];
  }
}

export async function deleteAdjustment(id, actorId = null) {
  const { error } = await supabase
    .from('payroll_adjustments')
    .delete()
    .eq('id', id);
  if (error) throw error;
  if (actorId) {
    logAudit({
      actorId,
      action: 'adjustment.deleted',
      entity: 'payroll_adjustment',
      entityId: id,
    });
  }
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Recurring deductions
// ─────────────────────────────────────────────────────────────────────────────
export async function addRecurringDeduction({
  userId,
  kind = 'loan',
  label,
  amount,
  isRecurring = true,
  totalInstallments = null,
  startDate = null,
  endDate = null,
  adminId = null,
}) {
  if (!userId) throw new Error('userId is required');
  if (!label) throw new Error('label is required');
  if (!amount || Number(amount) <= 0) throw new Error('amount must be > 0');

  const { data, error } = await supabase
    .from('payroll_deductions')
    .insert({
      user_id: userId,
      kind,
      label,
      amount: Number(amount),
      is_recurring: !!isRecurring,
      total_installments: totalInstallments
        ? Number(totalInstallments)
        : null,
      start_date: startDate || null,
      end_date: endDate || null,
      created_by: adminId,
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function deleteRecurringDeduction(id, actorId = null) {
  const { error } = await supabase
    .from('payroll_deductions')
    .delete()
    .eq('id', id);
  if (error) throw error;
  if (actorId) {
    logAudit({
      actorId,
      action: 'deduction.deleted',
      entity: 'payroll_deduction',
      entityId: id,
    });
  }
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Payroll runs — finalize / lock / history
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchRunForPeriod({ from, to }) {
  try {
    const { data, error } = await supabase
      .from('payroll_runs')
      .select('*')
      .eq('period_start', from)
      .eq('period_end', to)
      .maybeSingle();

    if (error) {
      if (isMissingTable(error)) return null;
      throw error;
    }
    return data ?? null;
  } catch (e) {
    if (!isMissingTable(e)) {
      console.warn('Payroll run fetch failed:', e?.message ?? e);
    }
    return null;
  }
}

export async function fetchRuns({ limit = 40 } = {}) {
  try {
    const { data, error } = await supabase
      .from('payroll_runs')
      .select('*')
      .order('period_start', { ascending: false })
      .limit(limit);

    if (error) {
      if (isMissingTable(error)) return [];
      throw error;
    }
    return data ?? [];
  } catch (e) {
    if (!isMissingTable(e)) {
      console.warn('Payroll runs fetch failed:', e?.message ?? e);
    }
    return [];
  }
}

export async function fetchRun(id) {
  const [{ data: run, error: runErr }, { data: items, error: itemErr }] =
    await Promise.all([
      supabase.from('payroll_runs').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('payroll_run_items')
        .select('*')
        .eq('run_id', id)
        .order('employee_name', { ascending: true }),
    ]);

  if (runErr) throw runErr;
  if (itemErr) throw itemErr;
  return { run, items: items ?? [] };
}

export async function finalizeRun({
  periodStart,
  periodEnd,
  periodLabel: label,
  rows,
  payMap,
  totals,
  adminId = null,
  notes = null,
}) {
  if (!periodStart || !periodEnd) throw new Error('Period is required');

  const now = new Date().toISOString();
  const { data: run, error: runErr } = await supabase
    .from('payroll_runs')
    .upsert(
      {
        period_start: periodStart,
        period_end: periodEnd,
        period_label: label || periodLabel(periodStart, periodEnd),
        status: 'finalized',
        totals: totals ?? {},
        notes: notes || null,
        created_by: adminId,
        finalized_by: adminId,
        finalized_at: now,
        updated_at: now,
      },
      { onConflict: 'period_start,period_end' }
    )
    .select()
    .maybeSingle();

  if (runErr) throw runErr;
  if (!run) throw new Error('Could not save payroll run');

  // Replace any previous items for this period.
  const { error: delErr } = await supabase
    .from('payroll_run_items')
    .delete()
    .eq('run_id', run.id);
  if (delErr) throw delErr;

  const items = (rows ?? []).map((r) => {
    const pay = payMap?.[r.user_id] ?? {};
    return {
      run_id: run.id,
      user_id: r.user_id,
      employee_name: r.full_name,
      employee_id: r.employee_id,
      gross: Number(pay.gross) || 0,
      deductions: Number(pay.totalDeductions) || 0,
      net: Number(pay.net) || 0,
      snapshot: {
        ...r,
        pay: {
          rate: pay.rate ?? null,
          gross: pay.gross ?? 0,
          totalDeductions: pay.totalDeductions ?? 0,
          net: pay.net ?? 0,
          lines: pay.lines ?? [],
          deductions: pay.deductions ?? [],
          thirteenthMonthAccrual: pay.thirteenthMonthAccrual ?? 0,
        },
      },
    };
  });

  if (items.length > 0) {
    const { error: itemErr } = await supabase
      .from('payroll_run_items')
      .insert(items);
    if (itemErr) throw itemErr;
  }

  await logAudit({
    actorId: adminId,
    action: 'run.finalized',
    entity: 'payroll_run',
    entityId: run.id,
    details: { periodStart, periodEnd, totals },
  });

  return run;
}

export async function markRunPaid({ runId, adminId = null }) {
  if (!runId) throw new Error('runId is required');
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('payroll_runs')
    .update({
      status: 'paid',
      paid_at: now,
      updated_at: now,
    })
    .eq('id', runId)
    .select()
    .maybeSingle();

  if (error) throw error;
  await logAudit({
    actorId: adminId,
    action: 'run.paid',
    entity: 'payroll_run',
    entityId: runId,
  });
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Audit log
// ─────────────────────────────────────────────────────────────────────────────
export async function logAudit({
  actorId = null,
  action,
  entity,
  entityId = null,
  details = {},
}) {
  if (!action || !entity) return { success: false };
  try {
    const { error } = await supabase.from('payroll_audit_log').insert({
      actor_id: actorId,
      action,
      entity,
      entity_id: entityId,
      details,
    });
    if (error) throw error;
    return { success: true };
  } catch (e) {
    if (!isMissingTable(e)) {
      console.warn('Audit log write failed:', e?.message ?? e);
    }
    return { success: false };
  }
}

export async function fetchAuditLog({ limit = 80 } = {}) {
  try {
    const { data, error } = await supabase
      .from('payroll_audit_log')
      .select('id, actor_id, action, entity, entity_id, details, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (isMissingTable(error)) return [];
      throw error;
    }

    const rows = data ?? [];
    const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))];
    let actorMap = {};
    if (actorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', actorIds);
      actorMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
    }

    return rows.map((r) => ({
      ...r,
      actor_name: actorMap[r.actor_id]?.full_name ?? 'System',
    }));
  } catch (e) {
    if (!isMissingTable(e)) {
      console.warn('Audit log fetch failed:', e?.message ?? e);
    }
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Access role
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchPayrollRole(userId) {
  if (!userId) return { role: 'viewer', isAdmin: false, available: false };
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_admin, payroll_role')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      if (!isMissingColumn(error)) throw error;
      const fallback = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .maybeSingle();
      return {
        role: fallback.data?.is_admin ? 'admin' : 'viewer',
        isAdmin: !!fallback.data?.is_admin,
        available: false,
      };
    }

    const role =
      data?.payroll_role ?? (data?.is_admin ? 'admin' : 'viewer');
    return {
      role,
      isAdmin: !!data?.is_admin,
      available: true,
    };
  } catch (e) {
    console.warn('Payroll role fetch failed:', e?.message ?? e);
    return { role: 'viewer', isAdmin: false, available: false };
  }
}

export const payrollRepository = {
  recentCutoffs,
  recentWeeklyCutoffs,
  quickCutoffRanges,
  fetchPayrollForCutoff,
  fetchPayrollRows,
  fetchAdjustments,
  fetchDailyAttendance,
  addAdjustment,
  setAdjustmentStatus,
  fetchPendingAdjustments,
  deleteAdjustment,
  fetchRecurringDeductions,
  addRecurringDeduction,
  deleteRecurringDeduction,
  fetchRunForPeriod,
  fetchRuns,
  fetchRun,
  finalizeRun,
  markRunPaid,
  logAudit,
  fetchAuditLog,
  fetchPayrollRole,
  fetchLeaveDaysByUser,
};

export default payrollRepository;
