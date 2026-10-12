import { supabase } from '../../../core/config/supabase';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export const dashboardRepository = {
  /** Today's attendance records with profile info */
  async fetchTodayRecords() {
    const { data, error } = await supabase
      .from('attendance_records')
      .select(
        'id, user_id, date, time_in, time_out, status, selfie_url, selfie_quality_score, selfie_issues, created_at'
      )
      .eq('date', todayStr())
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (!data || data.length === 0) return [];
    return enrichWithProfiles(data);
  },

  /** Employees currently clocked in (time_in set, time_out null) */
  async fetchLiveNow() {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('id, user_id, date, time_in, time_out, status')
      .eq('date', todayStr())
      .not('time_in', 'is', null)
      .is('time_out', null)
      .order('time_in', { ascending: true });
    if (error) throw error;
    if (!data || data.length === 0) return [];
    return enrichWithProfiles(data);
  },

  /** Last N check-ins across all dates */
  async fetchRecentCheckins(limit = 6) {
    const { data, error } = await supabase
      .from('attendance_records')
      .select(
        'id, user_id, date, time_in, time_out, status, selfie_url, selfie_quality_score'
      )
      .not('time_in', 'is', null)
      .order('time_in', { ascending: false })
      .limit(limit);
    if (error) throw error;
    if (!data || data.length === 0) return [];
    return enrichWithProfiles(data);
  },

  /** Counts for the past N days — used for the sparkline */
  async fetchWeeklyTrend(days = 7) {
    const from = daysAgoStr(days - 1);
    const { data, error } = await supabase
      .from('attendance_records')
      .select('date, status')
      .gte('date', from)
      .lte('date', todayStr());
    if (error) throw error;

    const buckets = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { date: key, present: 0, late: 0, absent: 0, total: 0 };
    }
    for (const r of data ?? []) {
      if (!buckets[r.date]) continue;
      buckets[r.date].total++;
      if (r.status === 'present') buckets[r.date].present++;
      else if (r.status === 'late') buckets[r.date].late++;
      else if (r.status === 'absent') buckets[r.date].absent++;
    }
    return Object.values(buckets);
  },

  /**
   * Records where time_in is set but time_out is missing.
   * FIXED: only looks back 2 days (today + yesterday) instead of every
   * historical record, so stale entries from weeks ago don't get flagged.
   */
  async fetchMissingTimeouts(limit = 5) {
    const from = daysAgoStr(2);
    const { data, error } = await supabase
      .from('attendance_records')
      .select('id, user_id, date, time_in, time_out, status')
      .gte('date', from)
      .not('time_in', 'is', null)
      .is('time_out', null)
      .order('date', { ascending: false })
      .limit(limit);
    if (error) throw error;
    if (!data || data.length === 0) return [];
    return enrichWithProfiles(data);
  },

  /** Summary stats for the current week */
  async fetchWeeklySummary() {
    const from = daysAgoStr(6);
    const { data, error } = await supabase
      .from('attendance_records')
      .select('user_id, date, status, time_in')
      .gte('date', from)
      .lte('date', todayStr());
    if (error) throw error;

    const rows = data ?? [];
    const total = rows.length;
    const present = rows.filter((r) => r.status === 'present').length;
    const late = rows.filter((r) => r.status === 'late').length;
    const absent = rows.filter((r) => r.status === 'absent').length;

    const onTimeRate = total > 0 ? Math.round((present / total) * 100) : 0;

    // Avg check-in time (only for present/late)
    const times = rows
      .filter((r) => r.time_in)
      .map((r) => {
        const t = new Date(r.time_in);
        return t.getHours() * 60 + t.getMinutes();
      });
    const avgMins =
      times.length > 0
        ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
        : 0;
    const avgHours = Math.floor(avgMins / 60);
    const avgRem = avgMins % 60;
    const avgCheckIn = times.length > 0
      ? `${((avgHours + 11) % 12) + 1}:${String(avgRem).padStart(2, '0')} ${avgHours >= 12 ? 'PM' : 'AM'}`
      : '—';

    return { total, present, late, absent, onTimeRate, avgCheckIn };
  },

  /**
   * Selfie quality snapshot for today.
   * FIXED: uses typeof / Array.isArray guards so null or weird shapes
   * don't produce unexpected NaN or throw.
   */
  async fetchSelfieSnapshot() {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('selfie_url, selfie_quality_score, selfie_issues')
      .eq('date', todayStr());
    if (error) throw error;

    const rows = data ?? [];
    const withScore = rows.filter(
      (r) => typeof r.selfie_quality_score === 'number'
    );
    const avg =
      withScore.length > 0
        ? Math.round(
            withScore.reduce((s, r) => s + r.selfie_quality_score, 0) /
              withScore.length
          )
        : 0;
    const flagged = rows.filter(
      (r) =>
        (typeof r.selfie_quality_score === 'number' &&
          r.selfie_quality_score < 60) ||
        (Array.isArray(r.selfie_issues) && r.selfie_issues.length > 0)
    ).length;
    const noSelfie = rows.filter((r) => !r.selfie_url).length;

    return { avg, flagged, noSelfie, total: rows.length };
  },

  /** Count of pending leave requests — used by the dashboard Leave card */
  async fetchPendingLeaveCount() {
    const { count, error } = await supabase
      .from('leave_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (error) throw error;
    return count ?? 0;
  },

  /** Upcoming shifts (from the shifts table if it exists) */
  async fetchUpcomingShifts(limit = 3) {
    try {
      const now = new Date();
      const { data, error } = await supabase
        .from('shifts')
        .select('id, user_id, start_time, end_time, date')
        .eq('date', todayStr())
        .gte('start_time', now.toISOString())
        .order('start_time', { ascending: true })
        .limit(limit);
      if (error) return [];
      if (!data || data.length === 0) return [];
      return enrichWithProfiles(data);
    } catch (e) {
      return [];
    }
  },
};

// ─── Helper: attach profile info to a list of records ───
async function enrichWithProfiles(records) {
  const userIds = [...new Set(records.map((r) => r.user_id).filter(Boolean))];
  if (userIds.length === 0) return records;

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, employee_id, position, avatar_url')
    .in('id', userIds);

  const map = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  return records.map((r) => ({ ...r, profiles: map[r.user_id] ?? null }));
}