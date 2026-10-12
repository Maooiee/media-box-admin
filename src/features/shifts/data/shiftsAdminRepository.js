import { supabase } from '../../../core/config/supabase';

export const shiftsAdminRepository = {
  async fetchAll({ from, to, userId } = {}) {
    let query = supabase
      .from('shifts')
      .select('id, user_id, shift_date, name, kind, start_hour, end_hour, is_flexible')
      .order('shift_date', { ascending: false })
      .order('start_hour', { ascending: true });

    if (from) query = query.gte('shift_date', from);
    if (to) query = query.lte('shift_date', to);
    if (userId) query = query.eq('user_id', userId);

    const { data, error } = await query;
    if (error) {
      console.error('SHIFTS QUERY ERROR:', error);
      throw error;
    }
    return data ?? [];
  },

  async upsertShift({
    userId,
    shiftDate,
    name,
    kind,
    startHour,
    endHour,
    isFlexible = false,
  }) {
    const { data, error } = await supabase
      .from('shifts')
      .upsert(
        {
          user_id: userId,
          shift_date: shiftDate,
          name,
          kind,
          start_hour: startHour,
          end_hour: endHour,
          is_flexible: isFlexible,
        },
        { onConflict: 'user_id,shift_date' }
      )
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async updateShift(id, { name, kind, startHour, endHour, isFlexible }) {
    const { data, error } = await supabase
      .from('shifts')
      .update({
        name,
        kind,
        start_hour: startHour,
        end_hour: endHour,
        is_flexible: isFlexible,
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async deleteShift(id) {
    const { error } = await supabase.from('shifts').delete().eq('id', id);
    if (error) throw error;
  },
};