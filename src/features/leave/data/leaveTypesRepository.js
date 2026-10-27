// admin-panel/src/features/leave/data/leaveTypesRepository.js
//
// CRUD for paid/unpaid leave-type settings used by payroll.

import { supabase } from '../../../core/config/supabase';
import {
  DEFAULT_LEAVE_TYPES,
  fetchLeaveTypeSettings,
} from './leaveStatusRepository';

export const leaveTypesRepository = {
  DEFAULT_LEAVE_TYPES,

  /** Returns an array of type objects, ordered like the defaults. */
  async fetchAll() {
    const map = await fetchLeaveTypeSettings();
    const order = Object.keys(DEFAULT_LEAVE_TYPES);
    const seen = new Set();
    const out = [];

    for (const key of order) {
      if (map[key]) {
        out.push(map[key]);
        seen.add(key);
      }
    }
    for (const [key, value] of Object.entries(map)) {
      if (!seen.has(key)) out.push(value);
    }
    return out;
  },

  async save(type) {
    if (!type?.key) throw new Error('Leave type key is required');
    const { error } = await supabase.from('payroll_leave_types').upsert(
      {
        key: type.key,
        label: type.label || type.key,
        is_paid: !!type.isPaid,
        max_days:
          type.maxDays === '' || type.maxDays == null
            ? null
            : Number(type.maxDays),
        color: type.color || null,
        is_active: type.isActive !== false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    if (error) throw error;
    return { success: true };
  },
};

export default leaveTypesRepository;
