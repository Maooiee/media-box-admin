// admin-panel/src/features/leave/data/leaveStatusRepository.js
//
// Single source of truth for "is this employee on approved leave?".
//
// Approving a request both flips `leave_requests.status` to `approved` and
// materialises `attendance_records` rows with `status = 'on_leave'`. Older
// approvals (or a failed insert) may only have one of the two, so every
// consumer — dashboard, selfie review, attendance stats, workforce and
// payroll — asks this module instead of re-implementing the check.
//
// All helpers are defensive: a missing table / column degrades to "no leave"
// instead of breaking the page that asked.

import { supabase } from '../../../core/config/supabase';
import { addDaysToDate } from '../../../core/utils/formatters';

/**
 * Fallback leave-type configuration. Matches the seed in
 * supabase/migrations/20261027120000_payroll_suite.sql. Used when the table
 * has not been created yet, so payroll still knows which leave is paid.
 */
export const DEFAULT_LEAVE_TYPES = {
  vacation: { key: 'vacation', label: 'Vacation', isPaid: true, color: 'blue' },
  sick: { key: 'sick', label: 'Sick Leave', isPaid: true, color: 'red' },
  emergency: { key: 'emergency', label: 'Emergency', isPaid: false, color: 'amber' },
  maternity: { key: 'maternity', label: 'Maternity', isPaid: true, color: 'purple' },
  paternity: { key: 'paternity', label: 'Paternity', isPaid: true, color: 'teal' },
  bereavement: { key: 'bereavement', label: 'Bereavement', isPaid: true, color: 'gray' },
  others: { key: 'others', label: 'Others', isPaid: false, color: 'slate' },
};

/** Inclusive list of YYYY-MM-DD strings between two ISO dates. */
function eachDate(from, to) {
  const out = [];
  if (!from || !to || from > to) return out;
  let cur = from;
  while (cur <= to && out.length < 400) {
    out.push(cur);
    cur = addDaysToDate(cur, 1);
  }
  return out;
}

/**
 * Approved leave requests overlapping [from, to].
 * Returns raw rows: { user_id, start_date, end_date, half_day, leave_type }.
 */
export async function fetchApprovedLeaveRows(from, to) {
  if (!from || !to) return [];
  try {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('user_id, start_date, end_date, half_day, leave_type')
      .eq('status', 'approved')
      .lte('start_date', to)
      .gte('end_date', from);

    if (error) {
      console.warn('Approved leave fetch failed:', error.message ?? error);
      return [];
    }
    return data ?? [];
  } catch (e) {
    console.warn('Approved leave fetch failed:', e?.message ?? e);
    return [];
  }
}

/** `on_leave` attendance rows inside [from, to]. */
export async function fetchOnLeaveAttendanceRows(from, to) {
  if (!from || !to) return [];
  try {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('user_id, date')
      .eq('status', 'on_leave')
      .gte('date', from)
      .lte('date', to);

    if (error) {
      console.warn('On-leave attendance fetch failed:', error.message ?? error);
      return [];
    }
    return data ?? [];
  } catch (e) {
    console.warn('On-leave attendance fetch failed:', e?.message ?? e);
    return [];
  }
}

/**
 * All attendance rows in [from, to]. Used to tell a genuine leave day from a
 * day the employee actually checked in on (approval never overwrites a real
 * `time_in`, but the leave request still spans that date).
 */
async function fetchAttendanceRowsInRange(from, to) {
  if (!from || !to) return [];
  try {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('user_id, date, time_in, status')
      .gte('date', from)
      .lte('date', to);

    if (error) {
      console.warn('Attendance range fetch failed:', error.message ?? error);
      return [];
    }
    return data ?? [];
  } catch (e) {
    console.warn('Attendance range fetch failed:', e?.message ?? e);
    return [];
  }
}

/**
 * Set of user_ids on approved leave on a single business date.
 * Combines approved requests with materialised `on_leave` rows.
 */
export async function fetchOnLeaveUserIds(date) {
  return fetchOnLeaveUserIdsInRange(date, date);
}

/** Set of user_ids on approved leave at any point in [from, to]. */
export async function fetchOnLeaveUserIdsInRange(from, to) {
  const leaveDays = await fetchLeaveDaysByUser(from, to);
  return new Set(leaveDays.keys());
}

/**
 * Map<userId, Set<'YYYY-MM-DD'>> of approved leave days inside [from, to].
 * A day with a real check-in is never reported as leave. Used by payroll to
 * synthesise `on_leave` days when the attendance row was never materialised.
 */
export async function fetchLeaveDaysByUser(from, to) {
  const [leaveRows, attendanceRows] = await Promise.all([
    fetchApprovedLeaveRows(from, to),
    fetchAttendanceRowsInRange(from, to),
  ]);

  // Days the employee actually worked — leave must never mask a check-in.
  const worked = new Set();
  const materialisedLeave = [];
  for (const row of attendanceRows) {
    if (!row.user_id || !row.date) continue;
    if (row.time_in) {
      worked.add(`${row.user_id}|${row.date}`);
    } else if (row.status === 'on_leave') {
      materialisedLeave.push(row);
    }
  }

  const map = new Map();
  const add = (userId, date) => {
    if (!userId || date < from || date > to) return;
    if (worked.has(`${userId}|${date}`)) return;
    if (!map.has(userId)) map.set(userId, new Set());
    map.get(userId).add(date);
  };

  for (const row of leaveRows) {
    const start = row.start_date > from ? row.start_date : from;
    const end = row.end_date < to ? row.end_date : to;
    for (const date of eachDate(start, end)) add(row.user_id, date);
  }
  for (const row of materialisedLeave) add(row.user_id, row.date);

  return map;
}

/**
 * Paid/unpaid configuration for every leave type.
 * Falls back to DEFAULT_LEAVE_TYPES when the migration has not run.
 */
export async function fetchLeaveTypeSettings() {
  try {
    const { data, error } = await supabase
      .from('payroll_leave_types')
      .select('key, label, is_paid, max_days, color, is_active');

    if (error) {
      console.warn('Leave type settings fetch failed:', error.message ?? error);
      return { ...DEFAULT_LEAVE_TYPES };
    }

    const map = { ...DEFAULT_LEAVE_TYPES };
    for (const row of data ?? []) {
      map[row.key] = {
        key: row.key,
        label: row.label,
        isPaid: !!row.is_paid,
        maxDays: row.max_days,
        color: row.color,
        isActive: row.is_active !== false,
      };
    }
    return map;
  } catch (e) {
    console.warn('Leave type settings fetch failed:', e?.message ?? e);
    return { ...DEFAULT_LEAVE_TYPES };
  }
}

/**
 * Map<userId, Map<'YYYY-MM-DD', { type, label, isPaid, halfDay }>>.
 *
 * This is the leave-aware version of fetchLeaveDaysByUser. Payroll uses it to
 * pay approved leave when its type is configured as paid, while still never
 * treating leave as an attendance/selfie day.
 */
export async function fetchLeaveDaysDetailedByUser(
  from,
  to,
  typeSettings = null
) {
  const [leaveRows, attendanceRows, types] = await Promise.all([
    fetchApprovedLeaveRows(from, to),
    fetchAttendanceRowsInRange(from, to),
    typeSettings ? Promise.resolve(typeSettings) : fetchLeaveTypeSettings(),
  ]);

  const worked = new Set();
  const materialisedLeave = [];
  for (const row of attendanceRows) {
    if (!row.user_id || !row.date) continue;
    if (row.time_in) {
      worked.add(`${row.user_id}|${row.date}`);
    } else if (row.status === 'on_leave') {
      materialisedLeave.push(row);
    }
  }

  const map = new Map();
  const add = (userId, date, info) => {
    if (!userId || date < from || date > to) return;
    if (worked.has(`${userId}|${date}`)) return;
    if (!map.has(userId)) map.set(userId, new Map());
    map.get(userId).set(date, info);
  };

  for (const row of leaveRows) {
    const type = types[row.leave_type] ?? types.others ?? DEFAULT_LEAVE_TYPES.others;
    const start = row.start_date > from ? row.start_date : from;
    const end = row.end_date < to ? row.end_date : to;
    for (const date of eachDate(start, end)) {
      add(row.user_id, date, {
        type: row.leave_type,
        label: type.label,
        isPaid: !!type.isPaid,
        halfDay: row.half_day || null,
      });
    }
  }

  // Orphaned on_leave rows (approval materialised but request is gone).
  // A materialised row that also has an approved request must not replace the
  // request's type — otherwise paid leave would silently become "others".
  for (const row of materialisedLeave) {
    if (map.get(row.user_id)?.has(row.date)) continue;
    add(row.user_id, row.date, {
      type: 'others',
      label: types.others?.label ?? 'Leave',
      isPaid: !!types.others?.isPaid,
      halfDay: null,
    });
  }

  return map;
}

export const leaveStatusRepository = {
  fetchApprovedLeaveRows,
  fetchOnLeaveAttendanceRows,
  fetchOnLeaveUserIds,
  fetchOnLeaveUserIdsInRange,
  fetchLeaveDaysByUser,
  fetchLeaveTypeSettings,
  fetchLeaveDaysDetailedByUser,
};

export default leaveStatusRepository;
