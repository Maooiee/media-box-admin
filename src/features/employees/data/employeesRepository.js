import { supabase } from '../../../core/config/supabase';

const EDGE_FUNCTION_URL =
  'https://qbefrttyhmhssdolbfhi.supabase.co/functions/v1/create-employee';

export const employeesRepository = {
  async fetchAll() {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, full_name, employee_id, email, position, schedule, is_admin, is_active, joined_date, avatar_url'
      )
      .order('full_name', { ascending: true });

    if (error) throw error;
    return data ?? [];
  },

  /// Creates an auth user + profile row via a Supabase Edge Function.
  async createEmployee({
    email,
    password,
    fullName,
    employeeId,
    position,
    schedule,
    isAdmin,
  }) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        email,
        password,
        full_name: fullName,
        employee_id: employeeId,
        position,
        schedule,
        is_admin: isAdmin,
      }),
    });

    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to create employee');
    return body;
  },

  async updateEmployee(id, updates) {
    const payload = {};
    if (updates.fullName !== undefined) payload.full_name = updates.fullName;
    if (updates.position !== undefined) payload.position = updates.position;
    if (updates.schedule !== undefined) payload.schedule = updates.schedule;
    if (updates.isAdmin !== undefined) payload.is_admin = updates.isAdmin;
    if (updates.isActive !== undefined) payload.is_active = updates.isActive;
    if (updates.email !== undefined) payload.email = updates.email;

    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async toggleActive(id, isActive) {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: isActive })
      .eq('id', id);
    if (error) throw error;
  },
};