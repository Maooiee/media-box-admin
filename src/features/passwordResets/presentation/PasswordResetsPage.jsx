// admin-panel/src/features/passwordResets/presentation/PasswordResetsPage.jsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Inbox,
  KeyRound,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  UserX,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '../../../core/config/supabase';
import { passwordResetsRepository } from '../data/passwordResetsRepository';
import PageHeader from '../../../shared/components/PageHeader';
import SegmentedTabs from '../../../shared/components/SegmentedTabs';
import EmptyState from '../../../shared/components/EmptyState';
import Toast from '../../../shared/components/Toast';
import { SkeletonList } from '../../../shared/components/Skeleton';
import ResetPasswordModal from '../../employees/presentation/widgets/ResetPasswordModal';
import { formatPH, initials } from '../../../core/utils/formatters';

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'handled', label: 'Handled' },
  { key: 'all', label: 'All' },
];

const STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  in_progress: 'bg-sky-50 text-sky-700 border-sky-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
  rejected: 'Rejected',
};

export default function PasswordResetsPage() {
  const [tab, setTab] = useState('pending');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);
  const [activeRequest, setActiveRequest] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await passwordResetsRepository.fetchAll();
      setRequests(rows);
    } catch (e) {
      console.error('LOAD PASSWORD RESETS FAILED:', e);
      showToast(
        e?.message?.includes('password_reset_requests')
          ? 'Password reset requests are not set up in the database yet.'
          : 'Failed to load password reset requests',
        'error',
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  // Live-refresh when the employee app creates a new request.
  useEffect(() => {
    const channel = supabase
      .channel('admin-password-resets')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'password_reset_requests' },
        () => load(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const counts = useMemo(
    () => ({
      pending: requests.filter(
        (r) => r.status === 'pending' || r.status === 'in_progress',
      ).length,
      handled: requests.filter(
        (r) => r.status === 'completed' || r.status === 'rejected',
      ).length,
      all: requests.length,
    }),
    [requests],
  );

  const visible = useMemo(() => {
    if (tab === 'pending') {
      return requests.filter(
        (r) => r.status === 'pending' || r.status === 'in_progress',
      );
    }
    if (tab === 'handled') {
      return requests.filter(
        (r) => r.status === 'completed' || r.status === 'rejected',
      );
    }
    return requests;
  }, [requests, tab]);

  async function handleReject(req) {
    setBusyId(req.id);
    try {
      await passwordResetsRepository.updateStatus(req.id, 'rejected');
      showToast(`Rejected ${displayName(req)}'s reset request`, 'success');
      await load();
    } catch (e) {
      showToast(e.message || 'Failed to update the request', 'error');
    } finally {
      setBusyId(null);
    }
  }

  // Called by ResetPasswordModal after the password was changed.
  async function handlePasswordSaved() {
    const req = activeRequest;
    if (!req) return;

    try {
      await passwordResetsRepository.updateStatus(req.id, 'completed');
      await load();
    } catch (e) {
      console.error('Failed to mark reset request completed:', e);
    }
  }

  const modalEmployee = useMemo(() => {
    if (!activeRequest) return null;
    return {
      id: activeRequest.user_id,
      fullName: displayName(activeRequest),
      employeeId:
        activeRequest.profile?.employee_id || activeRequest.username || '—',
      email: activeRequest.email || activeRequest.profile?.email || '',
    };
  }, [activeRequest]);

  return (
    <div className="space-y-3 md:space-y-4">
      <PageHeader
        section="Security"
        title="Password Resets"
        subtitle="Requests sent from the employee app's “Forgot password?” screen."
        icon={KeyRound}
        action={
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2.5 text-sm font-semibold text-textMedium transition hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      {/* ─── Tabs + pending callout ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          items={TABS.map((t) => ({ ...t, count: counts[t.key] ?? 0 }))}
        />

        {counts.pending > 0 && (
          <div className="inline-flex items-center gap-2 rounded-full border border-yellow/30 bg-yellowLight/60 px-3 py-1.5 text-xs font-semibold text-yellow">
            <Clock size={13} />
            {counts.pending} waiting for you
          </div>
        )}
      </div>

      {/* ─── List ─── */}
      {loading ? (
        <SkeletonList rows={4} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={tab === 'pending' ? Inbox : CheckCircle2}
          title={tab === 'pending' ? 'No pending requests' : 'Nothing here'}
          description={
            tab === 'pending'
              ? 'When an employee taps “Forgot password?” in the app, it will appear here.'
              : 'Try a different tab.'
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((req) => (
            <ResetRequestCard
              key={req.id}
              request={req}
              busy={busyId === req.id}
              onReset={() => setActiveRequest(req)}
              onReject={() => handleReject(req)}
            />
          ))}
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}

      <ResetPasswordModal
        open={Boolean(activeRequest)}
        employee={modalEmployee}
        onClose={() => setActiveRequest(null)}
        onSaved={handlePasswordSaved}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────
//  One request card
// ─────────────────────────────────────────────────────
function ResetRequestCard({ request, busy, onReset, onReject }) {
  const profile = request.profile;
  const name = displayName(request);
  const isPending =
    request.status === 'pending' || request.status === 'in_progress';
  const statusStyle =
    STATUS_STYLES[request.status] || STATUS_STYLES.pending;

  return (
    <div className="surface-card surface-card-hover p-4 md:p-5">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-sm font-bold text-white shadow-md shadow-primary/20">
          {initials(profile?.full_name || request.username)}
        </div>

        {/* Identity */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="min-w-0 max-w-full truncate text-sm font-bold text-textDark md:text-base">
              {name}
            </p>
            <span
              className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${statusStyle}`}
            >
              {STATUS_LABELS[request.status] || request.status}
            </span>
          </div>

          <p className="text-[11.5px] text-textLight mt-0.5 truncate">
            @{request.username || 'unknown'}
            {profile?.employee_id ? ` · ${profile.employee_id}` : ''}
            {profile?.position ? ` · ${profile.position}` : ''}
          </p>

          <p className="text-[11px] text-textFaint mt-0.5 truncate">
            {request.email || profile?.email || 'No email on file'}
          </p>
        </div>

        {/* Open employee */}
        {request.user_id && (
          <Link
            to={`/employees/${request.user_id}`}
            title="Open employee"
            className="w-8 h-8 rounded-full bg-bg text-textLight hover:text-primary hover:bg-primary-light flex items-center justify-center transition shrink-0"
          >
            <ExternalLink size={14} />
          </Link>
        )}
      </div>

      {/* Note from the employee */}
      {request.note && (
        <div className="mt-3 bg-bg rounded-2xl border border-border/70 px-4 py-3">
          <p className="text-[10px] font-bold tracking-wider text-textLight uppercase mb-1">
            Note from employee
          </p>
          <p className="text-xs text-textMedium leading-relaxed">
            “{request.note}”
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-textLight">
          <Clock size={12} className="shrink-0" />
          {timeAgo(request.created_at)}
          {request.handled_at && (
            <>
              <span className="text-textFaint">·</span>
              handled {formatPH(request.handled_at, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </>
          )}
        </div>

        {isPending ? (
          <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
            <button
              onClick={onReject}
              disabled={busy}
              className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-white px-3.5 py-2 text-xs font-semibold text-textMedium transition hover:border-red-300 hover:text-red-600 disabled:opacity-50 sm:flex-none"
            >
              <XCircle size={14} />
              Reject
            </button>

            {request.user_id ? (
              <button
                onClick={onReset}
                disabled={busy}
                className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-br from-primary to-primary-dark px-4 py-2 text-xs font-bold text-white shadow-md shadow-primary/25 transition hover:shadow-lg hover:shadow-primary/30 disabled:opacity-50 sm:flex-none"
              >
                <KeyRound size={14} />
                Reset password
              </button>
            ) : (
              <span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-bg px-3 py-2 text-xs font-semibold text-textLight sm:flex-none">
                <UserX size={14} />
                Account removed
              </span>
            )}
          </div>
        ) : (
          request.user_id && (
            <button
              onClick={onReset}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-xs font-semibold text-textMedium transition hover:border-primary/40 hover:text-primary disabled:opacity-50 sm:w-auto sm:shrink-0"
            >
              <KeyRound size={14} />
              Reset again
            </button>
          )
        )}
      </div>
    </div>
  );
}

function displayName(request) {
  return (
    request.profile?.full_name?.trim() ||
    request.username ||
    request.email ||
    'Unknown employee'
  );
}

function timeAgo(iso) {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatPH(iso, { month: 'short', day: 'numeric', year: 'numeric' });
}
