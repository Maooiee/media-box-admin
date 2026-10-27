import { useEffect, useMemo, useState } from 'react';
import {
  Bell, Search, X, LayoutGrid, List as ListIcon,
  Camera, AlertTriangle, CheckCircle2, Sparkles,
} from 'lucide-react';
import { attendanceRepository } from '../data/attendanceRepository';
import { createAttendanceRecord } from '../domain/AttendanceRecord';
import { fetchLeaveDaysByUser } from '../../leave/data/leaveStatusRepository';
import {
  formatTime,
  daysUntil,
  initials,
  toManilaDate,
} from '../../../core/utils/formatters';
import SendReminderModal from './widgets/SendReminderModal';
import PageHeader from '../../../shared/components/PageHeader';
import StatTile from '../../../shared/components/StatTile';
import EmptyState from '../../../shared/components/EmptyState';
import SearchField from '../../../shared/components/SearchField';
import FilterChips from '../../../shared/components/FilterChips';
import SelfieImage from '../../../shared/components/SelfieImage'; // <-- Added
import { SkeletonGrid } from '../../../shared/components/Skeleton';

/** Picks the most useful reminder preset for a given attendance/selfie record. */
function suggestedReminderKind(record) {
  if (!record) return 'admin_reminder';
  if (record.timeIn && !record.timeOut) return 'missed_time_out';

  const isToday = record.date === toManilaDate();
  const issues = record.selfieIssues?.length ?? 0;
  const score = record.selfieQualityScore;
  if (isToday && (issues > 0 || (score !== null && score < 60))) {
    return 'retake_selfie';
  }

  if (String(record.status ?? '').toLowerCase().includes('late')) return 'late';
  return 'time_in';
}

export default function SelfieReviewPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rangeFilter, setRangeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [sortBy, setSortBy] = useState('recent');
  const [view, setView] = useState('grid');
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
      const raw = await attendanceRepository.fetchRecords({ filter: rangeFilter });

      // Only show records that actually have a selfie
      const withSelfie = raw.filter((row) => row.selfie_url);

      // Approved leave is not an attendance day: those employees must never
      // show up as "missing" or "flagged" selfies. Check the real date span
      // of the loaded rows so the range filter stays accurate.
      let leaveDays = new Map();
      if (withSelfie.length > 0) {
        const dates = withSelfie
          .map((row) => row.date)
          .filter(Boolean)
          .sort();
        leaveDays = await fetchLeaveDaysByUser(dates[0], dates[dates.length - 1]);
      }

      const eligible = withSelfie.filter((row) => {
        if (row.status === 'on_leave') return false;
        return !leaveDays.get(row.user_id)?.has(row.date);
      });

      setRecords(
        eligible.map((row) => ({
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
        (a, b) => (b.selfieIssues?.length ?? 0) - (a.selfieIssues?.length ?? 0)
      );
    }
    return sorted;
  }, [records, search, flaggedOnly, sortBy]);

   const stats = useMemo(() => {
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
      withSelfie: records.length,   // all records now have selfies
      noSelfie: 0,                  // nothing without a selfie
      flagged,
      avg,
    };
  }, [records]);

  return (
    <div className="space-y-3 md:space-y-4">
      {/* ─── Page Header ─── */}
      <PageHeader
        section="Attendance"
        title="Selfie Review"
        subtitle="Review attendance photos and quality scores"
        icon={Camera}
      >
        <FilterChips
          options={[
            { key: 'all', label: 'All' },
            { key: 'today', label: 'Today' },
            { key: 'week', label: 'Week' },
            { key: 'month', label: 'Month' },
          ]}
          value={rangeFilter}
          onChange={setRangeFilter}
        />
      </PageHeader>

      {/* ─── Stats ─── */}
      {!loading && records.length > 0 && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          <StatTile label="Total" value={stats.total} tone="brand" icon={<Camera size={13} />} />
          <StatTile label="With Selfie" value={stats.withSelfie} tone="good" icon={<CheckCircle2 size={13} />} />
          <StatTile label="Flagged" value={stats.flagged} tone="warn" icon={<AlertTriangle size={13} />} />
          <StatTile
            label="Avg Score"
            value={stats.avg > 0 ? stats.avg : '—'}
            tone="info"
            icon={<Sparkles size={13} />}
          />
        </div>
      )}

      {/* ─── Toolbar ─── */}
      {!loading && records.length > 0 && (
        <div className="surface-toolbar space-y-2 p-2.5 md:flex md:items-center md:gap-3 md:space-y-0 md:p-3">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search by name or ID…"
            className="md:flex-1"
          />

          <div className="grid grid-cols-2 gap-1.5 md:flex md:items-center md:gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="field-select col-span-2 md:col-span-1 md:flex-none md:text-xs"
            >
              <option value="recent">Sort: Most Recent</option>
              <option value="lowest">Sort: Lowest Score</option>
              <option value="issues">Sort: Most Issues</option>
            </select>

            <button
              onClick={() => setFlaggedOnly((v) => !v)}
              className={`inline-flex items-center justify-center gap-1 rounded-xl border px-2.5 py-2 text-[11px] font-bold transition md:px-3 md:text-xs ${
                flaggedOnly
                  ? 'border-yellow bg-gradient-to-br from-yellow to-yellow/85 text-white shadow-md shadow-yellow/25'
                  : 'border-border bg-white text-textMedium hover:border-yellow/50 hover:bg-yellowLight/40'
              }`}
            >
              <AlertTriangle size={11} />
              <span>Flagged</span>
            </button>

            <div className="hidden md:flex bg-bg rounded-xl border border-border p-0.5 shrink-0">
              <button
                onClick={() => setView('grid')}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                  view === 'grid'
                    ? 'bg-gradient-to-br from-primary to-primary-dark text-white shadow-sm'
                    : 'text-textLight hover:text-textDark'
                }`}
                title="Grid view"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setView('table')}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                  view === 'table'
                    ? 'bg-gradient-to-br from-primary to-primary-dark text-white shadow-sm'
                    : 'text-textLight hover:text-textDark'
                }`}
                title="Table view"
              >
                <ListIcon size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Content ─── */}
      {loading ? (
        <SkeletonGrid count={6} />
      ) : records.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="No attendance records"
          description="Records with selfies will show up here"
        />
      ) : visible.length === 0 ? (
        <NoResults
          onClear={() => {
            setSearch('');
            setFlaggedOnly(false);
          }}
        />
      ) : view === 'grid' || typeof window === 'undefined' || window.innerWidth < 768 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
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
        <SelfieTable records={visible} onRowClick={(r) => setSelectedRecord(r)} />
      )}

      {selectedRecord && (
        <SelfieDetailModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      )}

      <SendReminderModal
        open={!!reminderRecord}
        onClose={() => setReminderRecord(null)}
        userId={reminderRecord?.userId}
        employeeName={reminderRecord?.employeeName}
        recordDate={reminderRecord?.date}
        suggestedKind={suggestedReminderKind(reminderRecord)}
        onToast={showToast}
      />

      {toast && (
        <div
          className={`fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-[80] px-4 py-2.5 rounded-2xl shadow-2xl text-xs md:text-sm font-semibold flex items-center gap-2 text-white ${
            toast.type === 'success'
              ? 'bg-gradient-to-br from-green to-green/85'
              : 'bg-gradient-to-br from-red to-red/85'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// No-results
// ─────────────────────────────────────────────────────────────
function NoResults({ onClear }) {
  return (
    <div className="text-center py-16 md:py-20 px-4 md:px-6 bg-white rounded-2xl md:rounded-3xl border border-border shadow-card">
      <div className="w-14 h-14 md:w-16 md:h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary-light to-primary-light/50 flex items-center justify-center mb-4">
        <Search size={22} className="md:hidden text-primary" />
        <Search size={26} className="hidden md:block text-primary" />
      </div>
      <h3 className="text-base md:text-lg font-bold text-textDark mb-1">
        No matches
      </h3>
      <p className="text-xs md:text-sm text-textLight max-w-md mx-auto mb-4">
        Try adjusting your search or filters
      </p>
      <button
        onClick={onClear}
        className="px-4 py-2 rounded-full text-xs md:text-sm font-semibold bg-gradient-to-br from-primary to-primary-dark text-white shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 transition-all"
      >
        Clear filters
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Selfie card
// ─────────────────────────────────────────────────────────────
function SelfieCard({ record: r, onClick, onRemind }) {
  const days = daysUntil(r.expiresAt);
  const hasIssues = r.selfieIssues && r.selfieIssues.length > 0;
  const score = r.selfieQualityScore;

  const accentGradient =
    score === null || score === undefined
      ? 'from-slate-300 to-slate-200'
      : score >= 80
      ? 'from-emerald-400 to-emerald-300'
      : score >= 60
      ? 'from-amber-400 to-amber-300'
      : 'from-red-400 to-red-300';

  return (
    <div
      onClick={onClick}
      className="group bg-white rounded-2xl md:rounded-3xl overflow-hidden border border-border hover:border-primary/40 hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 cursor-pointer shadow-card"
    >
      <div className={`h-1 bg-gradient-to-r ${accentGradient}`} />

      <div className="flex items-center gap-2.5 md:gap-3 p-3 md:p-4">
        <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-gradient-to-br from-primary-light via-primary/25 to-primary/40 flex items-center justify-center text-primary font-bold text-xs md:text-sm shrink-0 ring-2 ring-white shadow-sm">
          {initials(r.employeeName)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-textDark truncate text-sm">
            {r.employeeName}
          </p>
          <p className="text-[10px] md:text-[11px] text-textLight truncate">
            {r.employeeId}
            {r.position ? ` · ${r.position}` : ''}
          </p>
        </div>
      </div>

      <div className="relative aspect-[4/3] md:aspect-square bg-gradient-to-br from-bg to-border/30">
        {r.selfieUrl ? (
          <>
            <SelfieImage
              path={r.selfieUrl}
              alt="Selfie"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-x-0 top-0 h-16 md:h-20 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />
            {days !== null && (
              <div className="absolute top-2.5 right-2.5 md:top-3 md:right-3 bg-black/50 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 md:py-1 rounded-full">
                {days}d left
              </div>
            )}
            <QualityBadge score={score} issues={r.selfieIssues} variant="overlay" />
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-textLight">
            <Camera size={32} className="md:hidden mb-2 opacity-40" />
            <Camera size={40} className="hidden md:block mb-2 opacity-40" />
            <p className="text-[11px] md:text-xs font-medium">No selfie</p>
          </div>
        )}
      </div>

      <div className="p-3 md:p-4 space-y-2 md:space-y-3">
        <div className="flex items-center justify-between gap-2">
          <StatusPill status={r.status} />
          {hasIssues && (
            <span className="text-[10px] font-bold text-yellow bg-yellowLight border border-yellow/30 px-2 py-0.5 rounded-full shrink-0">
              {r.selfieIssues.length} issue{r.selfieIssues.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between text-[11px] md:text-xs gap-2">
          <span className="text-textLight font-medium shrink-0">{r.date}</span>
          <span className="text-textMedium font-semibold truncate">
            {formatTime(r.timeIn)}
            {r.timeOut ? ` – ${formatTime(r.timeOut)}` : ''}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemind?.(r);
          }}
          className="w-full mt-1 inline-flex items-center justify-center gap-1.5 text-[11px] md:text-xs font-bold px-3 py-2 rounded-xl border border-border bg-white text-textMedium hover:border-primary hover:text-primary hover:bg-primary-light/15 hover:-translate-y-0.5 transition-all"
        >
          <Bell size={12} /> Send Reminder
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Table view (desktop only)
// ─────────────────────────────────────────────────────────────
function SelfieTable({ records, onRowClick }) {
  return (
    <div className="bg-white rounded-2xl md:rounded-3xl border border-border shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-primary-light/40 via-primary-light/20 to-primary-light/10 text-left text-[10px] font-bold uppercase tracking-wider text-textMedium">
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
            {records.map((r) => (
              <tr
                key={r.id}
                onClick={() => onRowClick(r)}
                className="border-t border-border hover:bg-primary-light/10 cursor-pointer transition"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-light to-primary/30 flex items-center justify-center text-primary font-bold text-xs shrink-0">
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
                <td className="px-4 py-3 text-textMedium whitespace-nowrap">{r.date}</td>
                <td className="px-4 py-3 text-textMedium whitespace-nowrap">{formatTime(r.timeIn)}</td>
                <td className="px-4 py-3 text-textMedium whitespace-nowrap">{formatTime(r.timeOut)}</td>
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
                  {r.selfieUrl ? (
                    <SelfieImage
                      path={r.selfieUrl}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover border border-border"
                    />
                  ) : (
                    <span className="text-textLight text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
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
    colorClass = 'bg-bg text-textLight border-border';
    dotColor = 'bg-textFaint';
  } else if (score >= 80) {
    label = `${score}/100`;
    colorClass = 'bg-greenLight text-green border-green/25';
    dotColor = 'bg-green';
  } else if (score >= 60) {
    label = `${score}/100`;
    colorClass = 'bg-yellowLight text-yellow border-yellow/25';
    dotColor = 'bg-yellow';
  } else {
    label = `${score}/100`;
    colorClass = 'bg-redLight text-red border-red/25';
    dotColor = 'bg-red';
  }

  if (variant === 'overlay') {
    return (
      <div className="absolute bottom-2.5 left-2.5 md:bottom-3 md:left-3 flex items-center gap-1.5 md:gap-2">
        <div
          className={`flex items-center gap-1.5 px-2 md:px-2.5 py-0.5 md:py-1 rounded-full backdrop-blur-md text-[10px] md:text-[11px] font-bold border ${colorClass} bg-white/90`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
          {label}
        </div>
        {hasIssues && (
          <div
            title={issues.join('\n')}
            className="flex items-center gap-1 px-2 md:px-2.5 py-0.5 md:py-1 rounded-full backdrop-blur-md text-[10px] md:text-[11px] font-bold bg-gradient-to-br from-yellow to-yellow/85 text-white"
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
    present: { bg: 'bg-greenLight text-green border-green/25', dot: 'bg-green' },
    late: { bg: 'bg-yellowLight text-yellow border-yellow/25', dot: 'bg-yellow' },
    absent: { bg: 'bg-redLight text-red border-red/25', dot: 'bg-red' },
    on_leave: { bg: 'bg-blueLight text-blue border-blue/25', dot: 'bg-blue' },
    // Unknown/extra statuses (e.g. a future schema addition) must not look
    // like an absence — show them as neutral instead.
    other: { bg: 'bg-bg text-textMedium border-border', dot: 'bg-textFaint' },
  };
  const s = map[status] ?? map.other;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider shrink-0 ${s.bg}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Detail modal — bottom sheet on mobile
// ─────────────────────────────────────────────────────────────
function SelfieDetailModal({ record: r, onClose }) {
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
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="
          relative w-full md:max-w-4xl
          bg-white
          rounded-t-3xl md:rounded-3xl
          max-h-[92vh] md:max-h-[90vh]
          overflow-hidden
          flex flex-col md:flex-row
          shadow-float
          border border-white/60
        "
      >
        <button
          onClick={onClose}
          className="
            absolute top-3 right-3 z-20
            w-9 h-9 rounded-full
            bg-white/90 hover:bg-white backdrop-blur-md
            border border-border
            flex items-center justify-center
            text-textDark
            shadow-lg
            transition
          "
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="md:w-1/2 bg-black flex items-center justify-center relative shrink-0 max-h-[50vh] md:max-h-none">
          {r.selfieUrl ? (
            <SelfieImage
              path={r.selfieUrl}
              alt="Selfie"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="py-16 md:py-20 text-white/60 text-sm">No selfie</div>
          )}
        </div>

        <div className="md:w-1/2 p-4 md:p-6 overflow-y-auto flex-1">
          <div className="mb-4 md:mb-6 pr-8">
            <p className="text-[10px] font-bold tracking-wider text-primary uppercase">
              Attendance Detail
            </p>
            <h3 className="text-lg md:text-xl font-bold text-textDark mt-1 truncate">
              {r.employeeName}
            </h3>
            <p className="text-[11px] md:text-xs text-textLight mt-0.5 truncate">
              {r.employeeId}
              {r.position ? ` · ${r.position}` : ''}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 md:gap-3 mb-4 md:mb-6">
            <InfoBox label="Date" value={r.date} />
            <InfoBox label="Status" value={r.status?.toUpperCase() ?? '—'} />
            <InfoBox label="Time In" value={formatTime(r.timeIn)} />
            <InfoBox label="Time Out" value={r.timeOut ? formatTime(r.timeOut) : '—'} />
          </div>

          {r.selfieQualityScore !== null && (
            <div className="bg-gradient-to-br from-primary-light/40 via-white to-white border border-primary/15 rounded-2xl p-3 md:p-4 mb-4 shadow-card">
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
                <p className="text-xs text-green mt-2">
                  No issues detected — looks good.
                </p>
              )}
            </div>
          )}

          {r.expiresAt && (
            <p className="text-[10px] md:text-[11px] text-textLight text-center">
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
    <div className="bg-bg rounded-xl p-2.5 md:p-3">
      <p className="text-[9px] md:text-[10px] font-bold tracking-wider text-textLight uppercase">
        {label}
      </p>
      <p className="text-xs md:text-sm font-bold text-textDark mt-1 truncate">
        {value}
      </p>
    </div>
  );
}