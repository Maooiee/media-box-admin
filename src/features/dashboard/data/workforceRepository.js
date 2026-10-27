// admin-panel/src/features/dashboard/data/workforceRepository.js
//
// Computes live workforce availability for today.
// No schema changes — uses attendance_records, shifts, profiles.

import { supabase } from '../../../core/config/supabase';
import {
  manilaMinutes,
  toManilaDate,
} from '../../../core/utils/formatters';
import { fetchOnLeaveUserIds } from '../../leave/data/leaveStatusRepository';

const EMPTY = { onDuty: [], absent: [], onLeave: [], offDuty: [] };
const GRACE_MINUTES = 60;

export async function fetchWorkforceAvailability() {
  // Business date must be Manila, not the device clock (UTC is 8h behind).
  const todayStr = toManilaDate();

  try {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, employee_id, position, is_active')
      .eq('is_active', true);

    if (!profiles || profiles.length === 0) return EMPTY;

    const [{ data: attendance }, { data: shifts }, onLeaveIds] = await Promise.all([
      supabase
        .from('attendance_records')
        .select('user_id, time_in, time_out, status')
        .eq('date', todayStr),
      supabase
        .from('shifts')
        .select('user_id, name, start_hour, end_hour')
        .eq('shift_date', todayStr),
      fetchOnLeaveUserIds(todayStr),
    ]);

    const attMap = Object.fromEntries(
      (attendance ?? []).map((r) => [r.user_id, r])
    );
    const shiftMap = Object.fromEntries(
      (shifts ?? []).map((r) => [r.user_id, r])
    );

    const onDuty = [];
    const absent = [];
    const onLeave = [];
    const offDuty = [];

    const now = new Date();
    const nowMs = now.getTime();
    // Wall-clock minutes in Asia/Manila — matches shifts.start_hour.
    const currentMinutes = manilaMinutes(now);

    for (const p of profiles) {
      const att = attMap[p.id];
      const shift = shiftMap[p.id];

      const entry = {
        userId: p.id,
        fullName: p.full_name ?? 'Unknown',
        employeeId: p.employee_id ?? '',
        position: p.position ?? '',
        shiftName: shift?.name ?? null,
        shiftStart: shift?.start_hour ?? null,
        shiftEnd: shift?.end_hour ?? null,
      };

      // 1. ON DUTY — clocked in, not out
      if (att?.time_in && !att?.time_out) {
        const ms = Math.max(0, nowMs - new Date(att.time_in).getTime());
        onDuty.push({
          ...entry,
          timeIn: att.time_in,
          minutesOn: Math.floor(ms / 60000),
        });
        continue;
      }

      // 2. ON LEAVE — approved request OR materialised on_leave row.
      //    Leave wins over "absent": an approved-leave employee is never
      //    expected to check in.
      if (onLeaveIds.has(p.id) || att?.status === 'on_leave') {
        onLeave.push(entry);
        continue;
      }

      // 3. ABSENT — explicit OR live-computed
      const explicitlyAbsent = att?.status === 'absent';

      let computedAbsent = false;
      if (shift && !att?.time_in) {
        const startHour =
          typeof shift.start_hour === 'number' ? shift.start_hour : 0;
        const shiftStartMinutes = startHour * 60;
        const minutesSinceStart = currentMinutes - shiftStartMinutes;
        if (minutesSinceStart > GRACE_MINUTES) {
          computedAbsent = true;
        }
      }

      if (explicitlyAbsent || computedAbsent) {
        absent.push(entry);
        continue;
      }

      // 4. OFF DUTY — no shift today, OR shift hasn't started yet
      offDuty.push({
        ...entry,
        timeOut: att?.time_out ?? null,
      });
    }

    return { onDuty, absent, onLeave, offDuty };
  } catch (e) {
    console.error('Workforce load failed:', e);
    return EMPTY;
  }
}

export function fmtMinutes(min) {
  if (!min || min <= 0) return '0m';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}