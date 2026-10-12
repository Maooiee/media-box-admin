// admin-panel/src/features/leave/presentation/LeaveTab.jsx
import { useEffect, useState } from 'react';
import { Inbox, RefreshCw } from 'lucide-react';
import { supabase } from '../../../core/config/supabase';
import { leaveAdminRepository } from '../data/leaveAdminRepository';
import LeaveRequestCard from './widgets/LeaveRequestCard';

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
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map((t) => {
            const active = tab === t.key;
            const count = counts[t.key] ?? 0;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition flex items-center gap-2 ${
                  active
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-white text-textMedium border border-border hover:border-primary/40'
                }`}
              >
                {t.label}
                {count > 0 && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      active ? 'bg-white/25' : 'bg-bg text-textLight'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold bg-white border border-border text-textMedium hover:border-primary hover:text-primary transition"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-textLight">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-border">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-primary-light flex items-center justify-center mb-4">
            <Inbox size={36} className="text-primary" />
          </div>
          <p className="text-base font-bold text-textDark">
            {tab === 'pending' ? 'No pending requests' : 'Nothing here'}
          </p>
          <p className="text-sm text-textLight mt-1">
            {tab === 'pending'
              ? 'New leave requests will appear here.'
              : 'Try a different tab.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}