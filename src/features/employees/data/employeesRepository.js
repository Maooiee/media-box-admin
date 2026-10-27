import { supabase } from '../../../core/config/supabase';
import { callFunction } from '../../../core/api/edgeFunctions';
import { missingColumnName } from '../../../core/utils/dbErrors';

// Core profile columns every environment has.
const BASE_COLUMNS =
  'id, full_name, employee_id, email, position, schedule, is_admin, is_active, joined_date, avatar_url';

// Added by 20261024120000_payroll_foundation.sql.
const RATE_COLUMNS = `${BASE_COLUMNS}, daily_rate`;

// Added by 20261027120000_payroll_suite.sql.
const PAYROLL_COLUMNS = `${RATE_COLUMNS}, department, rest_day, bank_name, bank_account_name, bank_account_number, sss_number, philhealth_number, pagibig_number, tin, payroll_role`;

const PAYROLL_FIELD_MAP = {
  department: 'department',
  restDay: 'rest_day',
  bankName: 'bank_name',
  bankAccountName: 'bank_account_name',
  bankAccountNumber: 'bank_account_number',
  sssNumber: 'sss_number',
  philhealthNumber: 'philhealth_number',
  pagibigNumber: 'pagibig_number',
  tin: 'tin',
  payrollRole: 'payroll_role',
};

function profileColumnList() {
  return PAYROLL_COLUMNS.split(',')
    .map((column) => column.trim())
    .filter(Boolean);
}

export const employeesRepository = {
  async fetchAll() {
    // Try the full payroll profile first, then drop only the column that the
    // database says is missing. This keeps bank details (and every other
    // payroll field) available when one migration step has not been applied.
    let columns = profileColumnList();
    let result;

    for (let attempt = 0; attempt <= columns.length; attempt += 1) {
      result = await supabase
        .from('profiles')
        .select(columns.join(', '))
        .order('full_name', { ascending: true });

      if (!result.error) break;

      const missing = missingColumnName(result.error, columns);
      if (!missing) break;

      columns = columns.filter((column) => column !== missing);
      if (columns.length === 0) break;
    }

    const { data, error } = result;
    if (error) throw error;
    return data ?? [];
  },

  /// Creates an auth user + profile row via a Supabase Edge Function.
  /// Payroll-profile extras are written in a follow-up update because the
  /// Edge Function only knows the original profile fields.
  async createEmployee({
    email,
    password,
    fullName,
    employeeId,
    position,
    schedule,
    isAdmin,
    dailyRate,
    department,
    restDay,
    bankName,
    bankAccountName,
    bankAccountNumber,
    sssNumber,
    philhealthNumber,
    pagibigNumber,
    tin,
    payrollRole,
  }) {
    const result = await callFunction('create-employee', {
      email,
      password,
      full_name: fullName,
      employee_id: employeeId,
      position,
      schedule,
      is_admin: isAdmin,
      daily_rate: dailyRate,
    });

    const extras = {
      department,
      restDay,
      bankName,
      bankAccountName,
      bankAccountNumber,
      sssNumber,
      philhealthNumber,
      pagibigNumber,
      tin,
      payrollRole,
    };
    const hasExtras = Object.values(extras).some(
      (v) => v !== undefined && v !== null && v !== ''
    );

    if (result?.user_id && hasExtras) {
      try {
        await employeesRepository.updateEmployee(result.user_id, extras);
      } catch (e) {
        // The base profile exists — don't fail the whole creation because a
        // payroll migration has not been applied yet.
        console.warn('Payroll profile update skipped:', e?.message ?? e);
      }
    }

    return result;
  },

  /// Resets an employee's login password via a Supabase Edge Function.
  /// When no password is passed, the server generates a temporary one.
  /// Returns { password, temporary } — the password is shown only once.
  async resetPassword({ userId, password }) {
    return callFunction('reset-employee-password', {
      user_id: userId,
      password: password || null,
    });
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

    for (const [key, column] of Object.entries(PAYROLL_FIELD_MAP)) {
      if (updates[key] !== undefined) payload[column] = updates[key];
    }

    const next = { ...payload };
    if (Object.keys(next).length === 0) return { data: null, skipped: [] };

    let result;
    let lastError = null;
    const skipped = [];

    // Remove only the columns the database reports as missing, then retry.
    // The old fallback stripped every payroll field at once, which silently
    // discarded bank details when a single column was not migrated.
    for (let attempt = 0; attempt <= Object.keys(payload).length; attempt += 1) {
      if (Object.keys(next).length === 0) break;

      result = await supabase
        .from('profiles')
        .update(next)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (!result.error) return { data: result.data, skipped };

      lastError = result.error;
      const missing = missingColumnName(result.error, Object.keys(next));
      if (!missing) break;

      delete next[missing];
      skipped.push(missing);
    }

    throw lastError ?? new Error('Could not update employee profile');
  },

  async toggleActive(id, isActive) {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: isActive })
      .eq('id', id);
    if (error) throw error;
  },
};
