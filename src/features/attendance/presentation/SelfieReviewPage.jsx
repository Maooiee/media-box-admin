import { useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { attendanceRepository } from '../data/attendanceRepository';
import { createAttendanceRecord } from '../domain/AttendanceRecord';
import { formatTime, daysUntil, initials } from '../../../core/utils/formatters';
import SendReminderModal from './widgets/SendReminderModal';

export default function SelfieReviewPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rangeFilter, setRangeFilter] = useState('all'); // all | today | week | month
  const [search, setSearch] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [sortBy, setSortBy] = useState('recent'); // recent | lowest | issues
  const [view, setView] = useState('grid'); // grid | table
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [reminderRecord, setReminderRecord] = useState(null);
  const [toast, setToast] = useState(null);

  function showToast(message, type) {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2600);
  }

  useEffect(() => {
    loadRecords();
  }, [rangeFilter]);

  async function loadRecords() {
    setLoading(true);
    try {
      const raw = await attendanceRepository.fetchRecords({
        filter: rangeFilter,
      });
      setRecords(
        raw.map((row) => ({
          ...createAttendanceRecord(row),
          userId: row.user_id ?? row.userId,
        }))
      );
    } catch (e) {
      console.error(e);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }

  // ─── Filter + sort pipeline ───
  const visible = useMemo(() => {
    let list = records;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.employeeName.toLowerCase().includes(q) ||
          r.employeeId.toLowerCase().includes(q)
      );
    }

    if (flaggedOnly) {
      list = list.filter(
        (r) =>
          (r.selfieQualityScore !== null && r.selfieQualityScore < 60) ||
          (r.selfieIssues && r.selfieIssues.length > 0)
      );
    }

    const sorted = [...list];
    if (sortBy === 'recent') {
      sorted.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    } else if (sortBy === 'lowest') {
      sorted.sort((a, b) => {
        const sa = a.selfieQualityScore ?? 999;
        const sb = b.selfieQualityScore ?? 999;
        return sa - sb;
      });
    } else if (sortBy === 'issues') {
      sorted.sort(
        (a, b) =>
          (b.selfieIssues?.length ?? 0) - (a.selfieIssues?.length ?? 0)
      );
    }

    return sorted;
  }, [records, search, flaggedOnly, sortBy]);

  // ─── Stats ───
  const stats = useMemo(() => {
    const withSelfie = records.filter((r) => r.selfieUrl).length;
    const scored = records.filter((r) => r.selfieQualityScore !== null);
    const flagged = records.filter(
      (r) =>
        (r.selfieQualityScore !== null && r.selfieQualityScore < 60) ||
        (r.selfieIssues && r.selfieIssues.length > 0)
    ).length;
    const avg =
      scored.length > 0
        ? Math.round(
            scored.reduce((s, r) => s + r.selfieQualityScore, 0) / scored.length
          )
        : 0;
    return {
      total: records.length,
      withSelfie,
      noSelfie: records.length - withSelfie,
      flagged,
      avg,
    };
  }, [records]);

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-textDark">Selfie Review</h2>
          <p className="text-sm text-textLight mt-0.5">
            Review attendance photos and quality scores
          </p>
        </div>
        <div className="flex gap-2">
          {['all', 'today', 'week', 'month'].map((f) => (
            <button
              key={f}
              onClick={() => setRangeFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                rangeFilter === f
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'bg-white text-textMedium border border-border hover:border-primary/40'
              }`}
            >
              {f === 'all'
                ? 'All'
                : f === 'today'
                ? 'Today'
                : f === 'week'
                ? 'This Week'
                : 'This Month'}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Stats ─── */}
      {!loading && records.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Total" value={stats.total} tone="neutral" />
          <StatCard label="With Selfie" value={stats.withSelfie} tone="good" />
          <StatCard label="No Selfie" value={stats.noSelfie} tone="muted" />
          <StatCard label="Flagged" value={stats.flagged} tone="warn" />
          <StatCard
            label="Avg Score"
            value={stats.avg > 0 ? stats.avg : '—'}
            tone="info"
          />
        </div>
      )}

      {/* ─── Toolbar ─── */}
      {!loading && records.length > 0 && (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between bg-white rounded-2xl border border-border p-3">
          <div className="flex flex-1 gap-3 flex-col sm:flex-row">
            {/* Search */}
            <div className="relative flex-1">
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textLight"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-full border border-border bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2.5 rounded-full border border-border bg-bg text-sm font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="recent">Most Recent</option>
              <option value="lowest">Lowest Score</option>
              <option value="issues">Most Issues</option>
            </select>
          </div>

          <div className="flex gap-2 items-center">
            {/* Flagged toggle */}
            <button
              onClick={() => setFlaggedOnly((v) => !v)}
              className={`px-4 py-2.5 rounded-full text-sm font-semibold transition flex items-center gap-1.5 ${
                flaggedOnly
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'bg-bg text-textMedium border border-border hover:border-amber-400'
              }`}
            >
              ⚠ Flagged
            </button>

            {/* View toggle */}
            <div className="flex bg-bg rounded-full border border-border p-1">
              <button
                onClick={() => setView('grid')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                  view === 'grid'
                    ? 'bg-white text-textDark shadow-sm'
                    : 'text-textLight'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setView('table')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                  view === 'table'
                    ? 'bg-white text-textDark shadow-sm'
                    : 'text-textLight'
                }`}
              >
                Table
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Content ─── */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <p className="text-sm text-textLight">Loading records...</p>
          </div>
        </div>
      ) : records.length === 0 ? (
        <EmptyState />
      ) : visible.length === 0 ? (
        <NoResults
          onClear={() => {
            setSearch('');
            setFlaggedOnly(false);
          }}
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visible.map((r) => (
            <SelfieCard
              key={r.id}
              record={r}
              onClick={() => setSelectedRecord(r)}
              onRemind={(rec) => setReminderRecord(rec)}
            />
          ))}
        </div>
      ) : (
        <SelfieTable
          records={visible}
          onRowClick={(r) => setSelectedRecord(r)}
        />
      )}

      {/* ─── Detail modal ─── */}
      {selectedRecord && (
        <SelfieDetailModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      )}

      {/* ─── Send Reminder modal ─── */}
      <SendReminderModal
        open={!!reminderRecord}
        onClose={() => setReminderRecord(null)}
        userId={reminderRecord?.userId}
        employeeName={reminderRecord?.employeeName}
        onToast={showToast}
      />

      {/* ─── Toast ─── */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold flex items-center gap-2 ${
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

// ─────────────────────────────────────────────────────────────
// Stat card
// ─────────────────────────────────────────────────────────────
function StatCard({ label, value, tone }) {
  const tones = {
    neutral: 'bg-white text-textDark',
    good: 'bg-emerald-50 text-emerald-700',
    warn: 'bg-amber-50 text-amber-700',
    info: 'bg-indigo-50 text-indigo-700',
    muted: 'bg-bg text-textMedium',
  };
  return (
    <div className={`${tones[tone]} rounded-2xl px-4 py-3 border border-border/60`}>
      <p className="text-[10px] font-bold tracking-wider uppercase opacity-70">
        {label}
      </p>
      <p className="text-2xl font-bold mt-0.5">{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Empty + no-results states
// ─────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-border">
      <div className="w-16 h-16 rounded-full bg-bg flex items-center justify-center mb-4">
        <svg
          className="w-7 h-7 text-textLight"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
      <p className="text-base font-semibold text-textDark">No attendance records</p>
      <p className="text-sm text-textLight mt-1">Records with selfies will show up here</p>
    </div>
  );
}

function NoResults({ onClear }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-border">
      <p className="text-base font-semibold text-textDark">No matches</p>
      <p className="text-sm text-textLight mt-1">Try adjusting your search or filters</p>
      <button
        onClick={onClear}
        className="mt-4 px-4 py-2 rounded-full text-sm font-semibold bg-primary text-white hover:bg-primary-dark transition"
      >
        Clear filters
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Selfie card (grid view)
// ─────────────────────────────────────────────────────────────
function SelfieCard({ record: r, onClick, onRemind }) {
  const days = daysUntil(r.expiresAt);
  const url = attendanceRepository.getSelfieUrl(r.selfieUrl);
  const hasIssues = r.selfieIssues && r.selfieIssues.length > 0;
  const score = r.selfieQualityScore;

  const borderColor =
    score === null || score === undefined
      ? 'border-border'
      : score >= 80
      ? 'border-emerald-200'
      : score >= 60
      ? 'border-amber-200'
      : 'border-red-200';

  return (
    <div
      onClick={onClick}
      className={`group bg-white rounded-3xl overflow-hidden border ${borderColor} hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer`}
    >
      <div className="flex items-center gap-3 p-4">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-sm">
          {initials(r.employeeName)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-textDark truncate text-sm">
            {r.employeeName}
          </p>
          <p className="text-[11px] text-textLight truncate">
            {r.employeeId}
            {r.position ? ` · ${r.position}` : ''}
          </p>
        </div>
      </div>

      <div className="relative aspect-square bg-gradient-to-br from-bg to-border/30">
        {url ? (
          <>
            <img
              src={url}
              alt="Selfie"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/40 to-transparent" />
            {days !== null && (
              <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                {days}d left
              </div>
            )}
            <QualityBadge score={score} issues={r.selfieIssues} variant="overlay" />
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-textLight">
            <svg
              className="w-10 h-10 mb-2 opacity-40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 4h16v16H4z"
              />
            </svg>
            <p className="text-xs font-medium">No selfie</p>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <StatusPill status={r.status} />
          {hasIssues && (
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              {r.selfieIssues.length} issue{r.selfieIssues.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-textLight font-medium">{r.date}</span>
          <span className="text-textMedium font-semibold">
            {formatTime(r.timeIn)}
            {r.timeOut ? ` – ${formatTime(r.timeOut)}` : ''}
          </span>
        </div>

        {/* Send Reminder button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemind?.(r);
          }}
          className="w-full mt-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border border-border bg-white text-textMedium hover:border-primary hover:text-primary transition"
        >
          <Bell size={12} /> Send Reminder
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Table view
// ─────────────────────────────────────────────────────────────
function SelfieTable({ records, onRowClick }) {
  return (
    <div className="bg-white rounded-3xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg text-left text-[10px] font-bold uppercase tracking-wider text-textLight">
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Time In</th>
              <th className="px-4 py-3">Time Out</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Issues</th>
              <th className="px-4 py-3">Selfie</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const url = attendanceRepository.getSelfieUrl(r.selfieUrl);
              return (
                <tr
                  key={r.id}
                  onClick={() => onRowClick(r)}
                  className="border-t border-border hover:bg-bg/60 cursor-pointer transition"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                        {initials(r.employeeName)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-textDark truncate text-sm">
                          {r.employeeName}
                        </p>
                        <p className="text-[10px] text-textLight truncate">
                          {r.employeeId}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-textMedium">{r.date}</td>
                  <td className="px-4 py-3 text-textMedium">{formatTime(r.timeIn)}</td>
                  <td className="px-4 py-3 text-textMedium">{formatTime(r.timeOut)}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="px-4 py-3">
                    <QualityBadge score={r.selfieQualityScore} issues={r.selfieIssues} />
                  </td>
                  <td className="px-4 py-3 text-textLight text-xs">
                    {r.selfieIssues?.length ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    {url ? (
                      <img
                        src={url}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover border border-border"
                      />
                    ) : (
                      <span className="text-textLight text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Quality badge
// ─────────────────────────────────────────────────────────────
function QualityBadge({ score, issues, variant = 'inline' }) {
  const hasIssues = issues && issues.length > 0;

  let label, colorClass, dotColor;

  if (score === null || score === undefined) {
    label = 'No score';
    colorClass = 'bg-gray-100 text-gray-600 border-gray-200';
    dotColor = 'bg-gray-400';
  } else if (score >= 80) {
    label = `${score}/100`;
    colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    dotColor = 'bg-emerald-500';
  } else if (score >= 60) {
    label = `${score}/100`;
    colorClass = 'bg-amber-50 text-amber-700 border-amber-200';
    dotColor = 'bg-amber-500';
  } else {
    label = `${score}/100`;
    colorClass = 'bg-red-50 text-red-700 border-red-200';
    dotColor = 'bg-red-500';
  }

  if (variant === 'overlay') {
    return (
      <div className="absolute bottom-3 left-3 flex items-center gap-2">
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md text-[11px] font-bold border ${colorClass} bg-white/90`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
          {label}
        </div>
        {hasIssues && (
          <div
            title={issues.join('\n')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full backdrop-blur-md text-[11px] font-bold bg-amber-500/90 text-white"
          >
            ⚠ {issues.length}
          </div>
        )}
      </div>
    );
  }

  return (
    <span
      title={hasIssues ? issues.join('\n') : undefined}
      className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${colorClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {label}
    </span>
  );
}

function StatusPill({ status }) {
  const map = {
    present: {
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dot: 'bg-emerald-500',
    },
    late: {
      bg: 'bg-amber-50 text-amber-700 border-amber-200',
      dot: 'bg-amber-500',
    },
    absent: {
      bg: 'bg-red-50 text-red-700 border-red-200',
      dot: 'bg-red-500',
    },
  };
  const s = map[status] ?? map.absent;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${s.bg}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Detail modal
// ─────────────────────────────────────────────────────────────
function SelfieDetailModal({ record: r, onClose }) {
  const url = attendanceRepository.getSelfieUrl(r.selfieUrl);
  const hasIssues = r.selfieIssues && r.selfieIssues.length > 0;

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row shadow-2xl"
      >
        <div className="md:w-1/2 bg-black flex items-center justify-center relative">
          {url ? (
            <img
              src={url}
              alt="Selfie"
              className="w-full h-full object-contain max-h-[90vh]"
            />
          ) : (
            <div className="py-20 text-white/60 text-sm">No selfie</div>
          )}
          {r.selfieQualityScore !== null && (
            <div className="absolute top-4 left-4">
              <QualityBadge
                score={r.selfieQualityScore}
                issues={r.selfieIssues}
                variant="overlay"
              />
            </div>
          )}
        </div>

        <div className="md:w-1/2 p-6 overflow-y-auto">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p className="text-[10px] font-bold tracking-wider text-textLight uppercase">
                Attendance Detail
              </p>
              <h3 className="text-xl font-bold text-textDark mt-1">
                {r.employeeName}
              </h3>
              <p className="text-xs text-textLight mt-0.5">
                {r.employeeId}
                {r.position ? ` · ${r.position}` : ''}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full hover:bg-bg flex items-center justify-center text-textLight hover:text-textDark transition"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <InfoBox label="Date" value={r.date} />
            <InfoBox label="Status" value={r.status?.toUpperCase() ?? '—'} />
            <InfoBox label="Time In" value={formatTime(r.timeIn)} />
            <InfoBox
              label="Time Out"
              value={r.timeOut ? formatTime(r.timeOut) : '—'}
            />
          </div>

          {r.selfieQualityScore !== null && (
            <div className="bg-bg rounded-2xl p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold tracking-wider text-textLight uppercase">
                  Selfie Quality
                </p>
                <QualityBadge
                  score={r.selfieQualityScore}
                  issues={r.selfieIssues}
                />
              </div>
              {hasIssues ? (
                <ul className="mt-3 space-y-1.5">
                  {r.selfieIssues.map((issue, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-xs text-red-700"
                    >
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-emerald-700 mt-2">
                  No issues detected — looks good.
                </p>
              )}
            </div>
          )}

          {r.expiresAt && (
            <p className="text-[11px] text-textLight text-center">
              Selfie auto-deletes on{' '}
              {new Date(r.expiresAt).toLocaleDateString('en-PH')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value }) {
  return (
    <div className="bg-bg rounded-xl p-3">
      <p className="text-[10px] font-bold tracking-wider text-textLight uppercase">
        {label}
      </p>
      <p className="text-sm font-bold text-textDark mt-1 truncate">{value}</p>
    </div>
  );
}