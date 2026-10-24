// admin-panel/src/features/payroll/data/holidaysRepository.js
//
// CRUD for the Philippine holiday calendar (public.holidays, admin-only RLS).

import { supabase } from '../../../core/config/supabase';

function mapRow(r) {
  return { id: r.id, date: r.date, name: r.name, kind: r.kind };
}

export const holidaysRepository = {
  /// Every holiday, oldest first. The admin UI groups/filters by year.
  async fetchAll() {
    const { data, error } = await supabase
      .from('holidays')
      .select('id, date, name, kind')
      .order('date', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapRow);
  },

  /// Holidays inside an inclusive date range (used by the payroll calc).
  async fetchRange(from, to) {
    const { data, error } = await supabase
      .from('holidays')
      .select('date, name, kind')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapRow);
  },

  async create({ date, name, kind }) {
    const { data, error } = await supabase
      .from('holidays')
      .insert({ date, name: name.trim(), kind })
      .select('id, date, name, kind')
      .single();
    if (error) throw error;
    return mapRow(data);
  },

  async update(id, { date, name, kind }) {
    const { data, error } = await supabase
      .from('holidays')
      .update({ date, name: name.trim(), kind })
      .eq('id', id)
      .select('id, date, name, kind')
      .single();
    if (error) throw error;
    return mapRow(data);
  },

  async remove(id) {
    const { error } = await supabase.from('holidays').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  /// Map<'YYYY-MM-DD', { kind, name }> for payrollCalc.
  toMap(holidays) {
    return new Map((holidays ?? []).map((h) => [h.date, h]));
  },
};

export default holidaysRepository;
