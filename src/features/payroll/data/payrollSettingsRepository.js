// admin-panel/src/features/payroll/data/payrollSettingsRepository.js
//
// Reads/writes the single payroll settings document. Everything is defensive:
// if the migration has not run yet, the app uses DEFAULT_PAYROLL_SETTINGS and
// saving simply reports that the table is missing.

import { supabase } from '../../../core/config/supabase';
import {
  DEFAULT_PAYROLL_SETTINGS,
  mergePayrollSettings,
} from '../domain/payrollRules';

const SETTINGS_KEY = 'default';

function isMissingTable(error) {
  const message = String(error?.message ?? error ?? '');
  return /relation .* does not exist|could not find the table|schema cache/i.test(
    message
  );
}

export const payrollSettingsRepository = {
  async fetchSettings() {
    try {
      const { data, error } = await supabase
        .from('payroll_settings')
        .select('value')
        .eq('key', SETTINGS_KEY)
        .maybeSingle();

      if (error) {
        if (!isMissingTable(error)) {
          console.warn('Payroll settings fetch failed:', error.message);
        }
        return { settings: { ...DEFAULT_PAYROLL_SETTINGS }, available: false };
      }

      return {
        settings: mergePayrollSettings(data?.value ?? {}),
        available: true,
      };
    } catch (e) {
      console.warn('Payroll settings fetch failed:', e?.message ?? e);
      return { settings: { ...DEFAULT_PAYROLL_SETTINGS }, available: false };
    }
  },

  async saveSettings(settings, actorId = null) {
    const merged = mergePayrollSettings(settings);
    const { error } = await supabase.from('payroll_settings').upsert(
      {
        key: SETTINGS_KEY,
        value: merged,
        updated_by: actorId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    if (error) throw error;
    return { success: true, settings: merged };
  },

  async fetchContributionTables() {
    try {
      const { data, error } = await supabase
        .from('payroll_contribution_tables')
        .select(
          'id, kind, effective_from, effective_to, employee_rate, employer_rate, min_base, max_base, brackets, notes'
        )
        .order('kind', { ascending: true })
        .order('effective_from', { ascending: false });

      if (error) throw error;
      return data ?? [];
    } catch (e) {
      console.warn('Contribution tables fetch failed:', e?.message ?? e);
      return [];
    }
  },
};

export default payrollSettingsRepository;
