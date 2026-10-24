// admin-panel/src/features/payroll/data/payrollRepository.js
//
// Data layer for admin-side payroll summaries + manual adjustments.

import { supabase } from '../../../core/config/supabase';
import { aggregatePayrollRows, addDaysISO } from '../domain/payrollCalc';

function fmtISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function periodLabel(start, end) {
  return `${start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

/// Weekly pay periods — Monday to Sunday, most recent first.
export function recentWeeklyCutoffs(count = 12) {
  const out = [];
  const now = new Date();
  // Monday of the current week (getDay(): 0 = Sun … 6 = Sat)
  const sinceMonday = (now.getDay() + 6) % 7;
  const currentMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - sinceMonday);

  for (let i = 0; i < count; i++) {
    const start = new Date(currentMonday);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    out.push({
      start: fmtISO(start),
      end: fmtISO(end),
      label: periodLabel(start, end),
    });
  }
  return out;
}

export function recentCutoffs(count = 12) {
  const out = [];
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth();

  while (out.length < count) {
    const lastDay = new Date(y, m + 1, 0).getDate();
    out.push({
      start: new Date(y, m, 16),
      end: new Date(y, m, lastDay),
    });
    if (out.length >= count) break;
    out.push({
      start: new Date(y, m, 1),
      end: new Date(y, m, 15),
    });

    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }

  return out.map((c) => ({
    start: fmtISO(c.start),
    end: fmtISO(c.end),
    label: `${c.start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – ${c.end.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`,
  }));
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

/// Builds the payroll summary for ANY period (weekly, semi-monthly, …)
/// from the raw tables — the payroll_summary view is locked to semi-monthly
/// cutoffs. Also pulls each employee's daily_rate in the same pass.
///
/// Attendance is fetched starting one day before `from` because the
/// unworked-regular-holiday rule needs to see the day before a holiday
/// (aggregatePayrollRows ignores that extra day when counting).
///
/// Returns { rows, attendance, ratesAvailable }. ratesAvailable is false
/// when the payroll migration adding profiles.daily_rate has not run yet.
export async function fetchPayrollRows({ from, to }) {
  const dayBefore = addDaysISO(from, -1);

  const profilesColumns =
    'id, full_name, employee_id, position, daily_rate, is_active';

  const attendancePromise = supabase
    .from('attendance_records')
    .select('user_id, date, time_in, time_out, status')
    .gte('date', dayBefore)
    .lte('date', to);

  const adjustmentsPromise = supabase
    .from('payroll_adjustments')
    .select('user_id, work_date, kind, minutes')
    .gte('work_date', from)
    .lte('work_date', to);

  let profilesRes = await supabase.from('profiles').select(profilesColumns);
  let ratesAvailable = true;
  if (profilesRes.error && /daily_rate/.test(profilesRes.error.message)) {
    // Migration not run yet — retry without the rate column.
    ratesAvailable = false;
    profilesRes = await supabase
      .from('profiles')
      .select('id, full_name, employee_id, position, is_active');
  }

  const [attendanceRes, adjustmentsRes] = await Promise.all([
    attendancePromise,
    adjustmentsPromise,
  ]);

  const firstError =
    profilesRes.error || attendanceRes.error || adjustmentsRes.error;
  if (firstError) throw firstError;

  const attendance = attendanceRes.data ?? [];

  return {
    rows: aggregatePayrollRows({
      profiles: (profilesRes.data ?? []).map((p) => ({
        ...p,
        daily_rate: ratesAvailable ? p.daily_rate : null,
      })),
      attendance,
      adjustments: adjustmentsRes.data ?? [],
      from,
      to,
    }),
    attendance,
    ratesAvailable,
  };
}

export async function fetchAdjustments({ userId, from, to }) {
  const { data, error } = await supabase
    .from('payroll_adjustments')
    .select('id, user_id, work_date, kind, minutes, reason, approved_at')
    .eq('user_id', userId)
    .gte('work_date', from)
    .lte('work_date', to)
    .order('work_date', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function fetchDailyAttendance({ userId, from, to }) {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('id, date, time_in, time_out, status, selfie_url, notes')
    .eq('user_id', userId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function addAdjustment({
  userId,
  workDate,
  kind,
  minutes,
  reason,
  adminId,
}) {
  if (!userId) throw new Error('userId is required');
  if (!workDate) throw new Error('workDate is required');
  if (kind !== 'overtime' && kind !== 'undertime') {
    throw new Error('kind must be overtime or undertime');
  }
  if (!minutes || minutes <= 0) throw new Error('minutes must be > 0');

  const { error } = await supabase.from('payroll_adjustments').insert({
    user_id: userId,
    work_date: workDate,
    kind,
    minutes,
    reason: reason || null,
    approved_by: adminId,
  });

  if (error) throw error;
  return { success: true };
}

export async function deleteAdjustment(id) {
  const { error } = await supabase
    .from('payroll_adjustments')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return { success: true };
}

export const payrollRepository = {
  recentCutoffs,
  recentWeeklyCutoffs,
  fetchPayrollForCutoff,
  fetchPayrollRows,
  fetchAdjustments,
  fetchDailyAttendance,
  addAdjustment,
  deleteAdjustment,
};

export default payrollRepository;