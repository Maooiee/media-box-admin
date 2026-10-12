// admin-panel/src/features/payroll/data/payrollRepository.js
//
// Data layer for admin-side payroll summaries + manual adjustments.

import { supabase } from '../../../core/config/supabase';

function fmtISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  fetchPayrollForCutoff,
  fetchAdjustments,
  fetchDailyAttendance,
  addAdjustment,
  deleteAdjustment,
};

export default payrollRepository;