import { supabase } from '../../../core/config/supabase';
import {
  daysAgoManila,
  toManilaDate,
} from '../../../core/utils/formatters';

export const attendanceRepository = {
  async fetchRecords({ filter = 'all', limit = 100 } = {}) {
    // 1. Fetch attendance records (no join — avoids schema cache issues)
    let query = supabase
      .from('attendance_records')
      .select(
        'id, user_id, date, time_in, time_out, status, selfie_url, expires_at, notes, selfie_quality_score, selfie_issues'
      )
      .order('date', { ascending: false })
      .limit(limit);

    if (filter === 'today') {
      query = query.eq('date', toManilaDate());
    } else if (filter === 'week') {
      query = query.gte('date', daysAgoManila(7));
    }

    const { data: records, error: recErr } = await query;
    if (recErr) throw recErr;
    if (!records || records.length === 0) return [];

    // 2. Fetch profiles for the unique user_ids
    const userIds = [...new Set(records.map((r) => r.user_id).filter(Boolean))];
    let profileMap = {};

    if (userIds.length > 0) {
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('id, full_name, employee_id, position')
        .in('id', userIds);

      if (profErr) {
        console.warn('Profiles fetch failed (names will be Unknown):', profErr);
      } else {
        profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
      }
    }

    // 3. Merge the profile into each record (keeps the `profiles` key shape
    //    so createAttendanceRecord() keeps working without changes)
    return records.map((r) => ({
      ...r,
      profiles: profileMap[r.user_id] ?? null,
    }));
  },

  async updateRecord(id, { timeIn, timeOut, status, notes }) {
    const payload = {};
    if (timeIn !== undefined) payload.time_in = timeIn;
    if (timeOut !== undefined) payload.time_out = timeOut;
    if (status !== undefined) payload.status = status;
    if (notes !== undefined) payload.notes = notes;

    const { data, error } = await supabase
      .from('attendance_records')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

   async getSelfieUrl(path) {
    if (!path) return null;
    
    // Generate a signed URL valid for 1 hour (3600 seconds)
    const { data, error } = await supabase.storage
      .from('selfies')
      .createSignedUrl(path, 3600);

    if (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }
    
    return data.signedUrl;
  },

  getQualityBadge(score) {
    if (score === null || score === undefined) {
      return { label: '—', tone: 'none' };
    }
    if (score >= 80) return { label: `✓ ${score}/100`, tone: 'good' };
    if (score >= 60) return { label: `⚠ ${score}/100`, tone: 'warn' };
    return { label: `✗ ${score}/100`, tone: 'bad' };
  },
};