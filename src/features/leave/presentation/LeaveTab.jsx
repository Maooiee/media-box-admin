// admin-panel/src/features/leave/presentation/LeaveTab.jsx
import { useEffect, useState } from 'react';
import { CalendarDays, Inbox, RefreshCw, Settings2 } from 'lucide-react';
import { supabase } from '../../../core/config/supabase';
import { leaveAdminRepository } from '../data/leaveAdminRepository';
import LeaveRequestCard from './widgets/LeaveRequestCard';
import LeaveTypeSettingsModal from './widgets/LeaveTypeSettingsModal';
import PageHeader from '../../../shared/components/PageHeader';
import SegmentedTabs from '../../../shared/components/SegmentedTabs';
import EmptyState from '../../../shared/components/EmptyState';
import Toast from '../../../shared/components/Toast';
import { SkeletonGrid } from '../../../shared/components/Skeleton';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export default function LeaveTab() {
  const [tab, setTab] = useState('pending');
  const [requests, setRequests] = useState([]);
  const [counts, setCounts] = useState({ all: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);
  const [showTypes, setShowTypes] = useState(false);

  useEffect(() => {
    load();
  }, [tab]);

  async function load() {
    setLoading(true);
    try {
      const [rows, c] = await Promise.all([
        leaveAdminRepository.fetchAll({ status: tab }),
        leaveAdminRepository.counts(),
      ]);
      setRequests(rows);
      setCounts(c);
    } catch (e) {
      console.error('LOAD FAILED:', e);
      showToast('Failed to load leave requests', 'error');
    } finally {
      setLoading(false);
    }
  }

  function showToast(message, type) {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2600);
  }

  async function handleApprove(req, note) {
    setBusyId(req.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await leaveAdminRepository.approve(req.id, user?.id, note);
      showToast(`Approved ${req.employeeName}'s leave`, 'success');
      await load();
    } catch (e) {
      showToast(e.message || 'Failed to approve', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(req, note) {
    setBusyId(req.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await leaveAdminRepository.reject(req.id, user?.id, note);
      showToast(`Rejected ${req.employeeName}'s leave`, 'success');
      await load();
    } catch (e) {
      showToast(e.message || 'Failed to reject', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleViewAttachment(path) {
    const url = await leaveAdminRepository.getAttachmentUrl(path);
    if (url) window.open(url, '_blank');
    else showToast('Attachment not available', 'error');
  }

  return (
    <div className="space-y-3 md:space-y-4">
      <PageHeader
        section="Schedule"
        title="Leave Requests"
        subtitle="Review and act on employee leave requests"
        icon={CalendarDays}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowTypes(true)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-white px-3 py-2 text-xs font-semibold text-textMedium transition hover:border-primary hover:text-primary md:px-4 md:py-2.5 md:text-sm"
            >
              <Settings2 size={14} />
              Pay settings
            </button>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-white px-3 py-2 text-xs font-semibold text-textMedium transition hover:border-primary hover:text-primary md:px-4 md:py-2.5 md:text-sm"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          items={TABS.map((t) => ({ ...t, count: counts[t.key] ?? 0 }))}
        />
      </div>

      {loading ? (
        <SkeletonGrid count={3} />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={tab === 'pending' ? 'No pending requests' : 'Nothing here'}
          description={
            tab === 'pending'
              ? 'New leave requests will appear here.'
              : 'Try a different tab.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {requests.map((r) => (
            <LeaveRequestCard
              key={r.id}
              request={r}
              busy={busyId === r.id}
              onApprove={handleApprove}
              onReject={handleReject}
              onViewAttachment={handleViewAttachment}
            />
          ))}
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}

      <LeaveTypeSettingsModal
        open={showTypes}
        onClose={() => setShowTypes(false)}
        onSaved={load}
        onToast={showToast}
      />
    </div>
  );
}