import { supabase } from '../../../core/config/supabase';

export const employeeDetailRepository = {
  async fetchEmployee(id) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, employee_id, email, position, is_admin, joined_date, avatar_url')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async fetchRecentAttendance(userId, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('attendance_records')
      .select('id, date, time_in, time_out, status, selfie_url')
      .eq('user_id', userId)
      .gte('date', sinceStr)
      .order('date', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  async fetchTasks(userId) {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, description, status, due_date, due_time, created_at')
      .eq('assigned_to', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  getSelfieUrl(path) {
    if (!path) return null;
    const { data } = supabase.storage.from('selfies').getPublicUrl(path);
    return data.publicUrl;
  },
};
