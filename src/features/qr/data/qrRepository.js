import { supabase } from '../../../core/config/supabase';

export const qrRepository = {
  async fetchTodayCode() {
    const { data, error } = await supabase
      .from('daily_qr_codes')
      .select('code, valid_from, valid_until')
      .gte('valid_until', new Date().toISOString())
      .order('valid_from', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  },
};
