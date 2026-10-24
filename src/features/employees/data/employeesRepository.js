import { supabase } from '../../../core/config/supabase';

const FUNCTIONS_BASE_URL =
  'https://qbefrttyhmhssdolbfhi.supabase.co/functions/v1';

const EDGE_FUNCTION_URL = `${FUNCTIONS_BASE_URL}/create-employee`;

export const employeesRepository = {
  async fetchAll() {
    const columns =
      'id, full_name, employee_id, email, position, schedule, is_admin, is_active, joined_date, avatar_url';

    // daily_rate needs the payroll migration (supabase/migrations/20261024…).
    // Fall back to a plain query so the Employees page still works before it runs.
    let result = await supabase
      .from('profiles')
      .select(`${columns}, daily_rate`)
      .order('full_name', { ascending: true });

    if (result.error && /daily_rate/.test(result.error.message)) {
      result = await supabase
        .from('profiles')
        .select(columns)
        .order('full_name', { ascending: true });
    }

    const { data, error } = result;
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
    dailyRate,
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
        daily_rate: dailyRate,
      }),
    });

    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to create employee');
    return body;
  },

  /// Resets an employee's login password via a Supabase Edge Function.
  /// When no password is passed, the server generates a temporary one.
  /// Returns { password, temporary } — the password is shown only once.
  async resetPassword({ userId, password }) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const res = await fetch(`${FUNCTIONS_BASE_URL}/reset-employee-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ user_id: userId, password: password || null }),
    });

    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to reset password');
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
    if (updates.dailyRate !== undefined) payload.daily_rate = updates.dailyRate;

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