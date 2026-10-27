// admin-panel/src/features/passwordResets/data/passwordResetsRepository.js
//
// Password reset requests created from the employee app's "Forgot password?"
// flow. Requests are written by the `request_password_reset` RPC in Supabase
// and are only readable by admins (RLS).

import { supabase } from '../../../core/config/supabase';

export const passwordResetsRepository = {
  /**
   * Returns reset requests, newest first, each with its related profile
   * (when the user still exists) attached as `profile`.
   */
  async fetchAll() {
    const { data: requests, error } = await supabase
      .from('password_reset_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    const userIds = [
      ...new Set((requests ?? []).map((r) => r.user_id).filter(Boolean)),
    ];

    let profilesById = {};
    if (userIds.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, employee_id, username, email, position, is_active')
        .in('id', userIds);

      if (profileError) throw profileError;

      profilesById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
    }

    return (requests ?? []).map((r) => ({
      ...r,
      profile: r.user_id ? profilesById[r.user_id] ?? null : null,
    }));
  },

  /** Number of requests still waiting for an admin. */
  async countPending() {
    const { count, error } = await supabase
      .from('password_reset_requests')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'in_progress']);

    if (error) throw error;
    return count ?? 0;
  },

  /**
   * Marks a request handled. The RPC is admin-guarded server-side and also
   * clears the matching admin notification.
   */
  async updateStatus(id, status) {
    const { data, error } = await supabase.rpc('admin_update_reset_request', {
      p_request_id: id,
      p_status: status,
    });

    if (error) throw error;
    return data;
  },
};

export default passwordResetsRepository;
