// admin-panel/src/features/leave/data/leaveAdminRepository.js
//
// Data layer for admin-side leave management.

import { supabase } from '../../../core/config/supabase';

const LEAVE_TYPES = {
  sick: { label: 'Sick Leave', color: 'red' },
  vacation: { label: 'Vacation', color: 'blue' },
  emergency: { label: 'Emergency', color: 'amber' },
  maternity: { label: 'Maternity', color: 'purple' },
  paternity: { label: 'Paternity', color: 'teal' },
  bereavement: { label: 'Bereavement', color: 'gray' },
  others: { label: 'Others', color: 'slate' },
};

const STATUSES = {
  pending: { label: 'Pending', color: 'amber' },
  approved: { label: 'Approved', color: 'green' },
  rejected: { label: 'Rejected', color: 'red' },
  cancelled: { label: 'Cancelled', color: 'gray' },
};

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function dateRangeLabel(startDate, endDate, halfDay) {
  const s = fmtDate(startDate);
  const e = fmtDate(endDate);
  if (s === e) {
    if (halfDay) {
      return `${s} · ${halfDay === 'morning' ? 'Morning' : 'Afternoon'}`;
    }
    return s;
  }
  const days = Math.round(
    (new Date(endDate) - new Date(startDate)) / 86400000
  ) + 1;
  return `${s} → ${e}  (${days} days)`;
}

export const leaveAdminRepository = {
  LEAVE_TYPES,
  STATUSES,

  /** Load all leave requests with employee info. Newest first. */
  async fetchAll({ status } = {}) {
    let q = supabase
      .from('leave_requests')
      .select(`
        id,
        user_id,
        leave_type,
        start_date,
        end_date,
        half_day,
        reason,
        attachment_path,
        status,
        reviewed_by,
        reviewed_at,
        review_note,
        created_at,
        profiles:user_id (
          full_name,
          employee_id,
          position
        )
      `)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') q = q.eq('status', status);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r) => ({
      ...r,
      employeeName: r.profiles?.full_name ?? 'Unknown',
      employeeId: r.profiles?.employee_id ?? '',
      position: r.profiles?.position ?? '',
      dateLabel: dateRangeLabel(r.start_date, r.end_date, r.half_day),
      typeLabel: LEAVE_TYPES[r.leave_type]?.label ?? r.leave_type,
      statusLabel: STATUSES[r.status]?.label ?? r.status,
    }));
  },

  /** Approve a request and (optionally) mark attendance days as on_leave. */
  async approve(requestId, adminId, note = null) {
    const { data: req, error: getErr } = await supabase
      .from('leave_requests')
      .select('id, user_id, leave_type, start_date, end_date, status')
      .eq('id', requestId)
      .maybeSingle();

    if (getErr || !req) throw new Error('Leave request not found');
    if (req.status !== 'pending') throw new Error('Already reviewed');

    const { error: updErr } = await supabase
      .from('leave_requests')
      .update({
        status: 'approved',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        review_note: note,
      })
      .eq('id', requestId);

    if (updErr) throw updErr;

    // Mark each date as on_leave in attendance_records.
    // Skip days that already have a real time_in (don't overwrite).
    const days = enumerateDays(req.start_date, req.end_date);
    for (const date of days) {
      const { data: existing } = await supabase
        .from('attendance_records')
        .select('id, time_in')
        .eq('user_id', req.user_id)
        .eq('date', date)
        .maybeSingle();

      if (existing?.time_in) continue;

      if (existing) {
        await supabase
          .from('attendance_records')
          .update({ status: 'on_leave' })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('attendance_records')
          .insert({
            user_id: req.user_id,
            date,
            status: 'on_leave',
          });
      }
    }

    // ─── Notify the employee (in-app) ───
    try {
      const typeLabel = LEAVE_TYPES[req.leave_type]?.label ?? 'Leave';
      const range = dateRangeLabel(req.start_date, req.end_date, null);

      await supabase.from('notifications').insert({
        user_id: req.user_id,
        title: 'Leave Approved ✓',
        body: `Your ${typeLabel} request for ${range} has been approved.`,
        kind: 'leave_approved',
        data: {
          leave_id: req.id,
          start_date: req.start_date,
          end_date: req.end_date,
          status: 'approved',
        },
      });
    } catch (e) {
      console.warn('Notification insert failed (approve):', e);
    }

    // Optional: also try to send a push via edge function
    try {
      await supabase.functions.invoke('notify-leave-decision', {
        body: { leave_request_id: requestId },
      });
    } catch (e) {
      // Silent — edge function might not exist
    }

    return { success: true };
  },

  /** Reject a request with an optional note. */
  async reject(requestId, adminId, note = null) {
    // Fetch first so we have the user_id + dates for the notification
    const { data: req, error: getErr } = await supabase
      .from('leave_requests')
      .select('id, user_id, leave_type, start_date, end_date, status')
      .eq('id', requestId)
      .maybeSingle();

    if (getErr || !req) throw new Error('Leave request not found');

    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: 'rejected',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        review_note: note,
      })
      .eq('id', requestId);

    if (error) throw error;

    // ─── Notify the employee (in-app) ───
    try {
      const typeLabel = LEAVE_TYPES[req.leave_type]?.label ?? 'Leave';
      const range = dateRangeLabel(req.start_date, req.end_date, null);

      await supabase.from('notifications').insert({
        user_id: req.user_id,
        title: 'Leave Rejected',
        body: note
          ? `Your ${typeLabel} request for ${range} was rejected. Note: ${note}`
          : `Your ${typeLabel} request for ${range} was rejected.`,
        kind: 'leave_rejected',
        data: {
          leave_id: req.id,
          start_date: req.start_date,
          end_date: req.end_date,
          status: 'rejected',
          review_note: note,
        },
      });
    } catch (e) {
      console.warn('Notification insert failed (reject):', e);
    }

    // Optional push
    try {
      await supabase.functions.invoke('notify-leave-decision', {
        body: { leave_request_id: requestId },
      });
    } catch (e) {
      // Silent
    }

    return { success: true };
  },

  /** Returns a short-lived signed URL for viewing the attachment. */
  async getAttachmentUrl(path) {
    if (!path) return null;
    const { data, error } = await supabase.storage
      .from('leave_attachments')
      .createSignedUrl(path, 3600);
    if (error) return null;
    return data?.signedUrl ?? null;
  },

  /** Counts for the tab badges. */
  async counts() {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('status');
    if (error) throw error;
    const acc = { all: 0, pending: 0, approved: 0, rejected: 0 };
    for (const r of data ?? []) {
      acc.all++;
      if (acc[r.status] !== undefined) acc[r.status]++;
    }
    return acc;
  },
};

function enumerateDays(startIso, endIso) {
  const out = [];
  const start = new Date(startIso + 'T00:00:00');
  const end = new Date(endIso + 'T00:00:00');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    );
  }
  return out;
}

export default leaveAdminRepository;