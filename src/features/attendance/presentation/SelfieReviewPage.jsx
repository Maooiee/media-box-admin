import { useEffect, useMemo, useState } from 'react';
import {
  Bell, Search, X, LayoutGrid, List as ListIcon,
  Camera, AlertTriangle, CheckCircle2, Users, Sparkles,
} from 'lucide-react';
import { attendanceRepository } from '../data/attendanceRepository';
import { createAttendanceRecord } from '../domain/AttendanceRecord';
import { formatTime, daysUntil, initials } from '../../../core/utils/formatters';
import SendReminderModal from './widgets/SendReminderModal';

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
    <div className="space-y-3 md:space-y-4">
      {/* ─── Page Header ─── */}
      <div className="bg-gradient-to-br from-primary-light/60 via-white to-white rounded-2xl border border-primary/15 shadow-card p-3 md:p-5">
        <div className="flex items-start gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white shadow-brand shrink-0">
            <Camera size={18} className="md:hidden" />
            <Camera size={22} className="hidden md:block" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 md:gap-2 mb-0.5 md:mb-1">
              <span className="text-[9px] md:text-[10px] font-bold tracking-[0.18em] text-primary uppercase">
                Attendance
              </span>
              <span className="w-1 h-1 rounded-full bg-textFaint" />
              <span className="text-[9px] md:text-[10px] font-bold tracking-[0.18em] text-textLight uppercase">
                Selfie Review
              </span>
            </div>
            <h2 className="text-lg md:text-2xl font-bold text-textDark tracking-tight leading-tight truncate">
              Selfie Review
            </h2>
            <p className="text-[11px] md:text-xs text-textLight mt-0.5 truncate">
              Review attendance photos and quality scores
            </p>
          </div>
        </div>

        {/* Range chips — horizontal scroll on mobile, aligned right on desktop */}
        <div className="-mx-3 md:mx-0 px-3 md:px-0 mt-3 md:mt-0 md:absolute md:right-5 md:top-1/2 md:-translate-y-1/2 overflow-x-auto md:overflow-visible md:relative md:mt-3 md:top-auto md:translate-y-0">
          <div className="flex gap-1.5 md:gap-2 w-max md:w-auto">
            {[
              { key: 'all', label: 'All' },
              { key: 'today', label: 'Today' },
              { key: 'week', label: 'Week' },
              { key: 'month', label: 'Month' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setRangeFilter(f.key)}
                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[11px] md:text-xs font-semibold transition whitespace-nowrap ${
                  rangeFilter === f.key
                    ? 'bg-gradient-to-br from-primary to-primary-dark text-white shadow-md shadow-primary/30'
                    : 'bg-white/80 text-textMedium border border-border hover:border-primary/40 hover:bg-primary-light/20 hover:text-textDark'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Stats ─── */}
      {!loading && records.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
          <StatTile label="Total" value={stats.total} tone="brand" icon={<Camera size={13} />} />
          <StatTile label="With Selfie" value={stats.withSelfie} tone="good" icon={<CheckCircle2 size={13} />} />
          <StatTile label="No Selfie" value={stats.noSelfie} tone="muted" icon={<Users size={13} />} />
          <StatTile label="Flagged" value={stats.flagged} tone="warn" icon={<AlertTriangle size={13} />} />
          <StatTile
            label="Avg Score"
            value={stats.avg > 0 ? stats.avg : '—'}
            tone="info"
            icon={<Sparkles size={13} />}
            className="col-span-2 md:col-span-1"
          />
        </div>
      )}

      {/* ─── Toolbar ─── */}
      {!loading && records.length > 0 && (
        <div className="rounded-2xl border border-border shadow-card bg-gradient-to-r from-white via-white to-primary-light/15 p-2.5 md:p-3 space-y-2 md:space-y-0 md:flex md:items-center md:gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-white focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition md:flex-1">
            <Search size={14} className="text-textLight shrink-0" />
            <input
              type="text"
              placeholder="Search by name or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-0 bg-transparent outline-none text-sm text-textDark placeholder:text-textLight"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-[10px] font-bold text-textLight hover:text-primary transition shrink-0"
              >
                CLEAR
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:flex md:items-center gap-1.5 md:gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="col-span-2 md:col-span-1 md:flex-none px-2.5 md:px-3 py-2 rounded-xl border border-border bg-white text-[11px] md:text-xs font-semibold text-textDark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
            >
              <option value="recent">Sort: Most Recent</option>
              <option value="lowest">Sort: Lowest Score</option>
              <option value="issues">Sort: Most Issues</option>
            </select>

            <button
              onClick={() => setFlaggedOnly((v) => !v)}
              className={`inline-flex items-center justify-center gap-1 px-2.5 md:px-3 py-2 rounded-xl text-[11px] md:text-xs font-bold transition border ${
                flaggedOnly
                  ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white border-amber-500 shadow-md shadow-amber-500/20'
                  : 'bg-white text-textMedium border-border hover:border-amber-400 hover:bg-amber-50'
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
// Stat tile
// ─────────────────────────────────────────────────────────────
function StatTile({ label, value, tone, icon, className = '' }) {
  const tones = {
    brand: 'bg-gradient-to-br from-primary-light/70 to-primary-light/30 border-primary/25 text-textDark',
    good: 'bg-gradient-to-br from-greenLight to-greenLight/50 border-green/30 text-green',
    warn: 'bg-gradient-to-br from-yellowLight to-yellowLight/50 border-yellow/30 text-yellow',
    bad: 'bg-gradient-to-br from-redLight to-redLight/50 border-red/30 text-red',
    info: 'bg-gradient-to-br from-indigo-100 to-indigo-50 border-indigo-300/40 text-indigo-700',
    muted: 'bg-gradient-to-br from-bg to-bg/50 border-border text-textMedium',
  };
  const iconTones = {
    brand: 'bg-white/80 text-primary',
    good: 'bg-white/70 text-green',
    warn: 'bg-white/70 text-yellow',
    bad: 'bg-white/70 text-red',
    info: 'bg-white/80 text-indigo-600',
    muted: 'bg-white/80 text-textLight',
  };
  return (
    <div className={`rounded-xl md:rounded-2xl border shadow-card p-2.5 md:px-3.5 md:py-3 flex items-center gap-2 md:gap-3 ${tones[tone]} ${className}`}>
      {icon && (
        <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center shrink-0 ${iconTones[tone]}`}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[9px] md:text-[10px] font-bold tracking-wider uppercase opacity-70 truncate">
          {label}
        </p>
        <p className="text-lg md:text-xl font-bold leading-tight">{value}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Empty + no-results
// ─────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="text-center py-16 md:py-20 px-4 md:px-6 bg-white rounded-2xl md:rounded-3xl border border-border shadow-card">
      <div className="w-16 h-16 md:w-24 md:h-24 mx-auto rounded-2xl md:rounded-3xl bg-gradient-to-br from-primary-light via-primary-light/70 to-primary/20 flex items-center justify-center mb-4 md:mb-5 shadow-lg shadow-primary/10">
        <Camera size={28} className="md:hidden text-primary" />
        <Camera size={40} className="hidden md:block text-primary" />
      </div>
      <h3 className="text-base md:text-lg font-bold text-textDark mb-1">
        No attendance records
      </h3>
      <p className="text-xs md:text-sm text-textLight max-w-md mx-auto">
        Records with selfies will show up here
      </p>
    </div>
  );
}

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
  const url = attendanceRepository.getSelfieUrl(r.selfieUrl);
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
            {records.map((r) => {
              const url = attendanceRepository.getSelfieUrl(r.selfieUrl);
              return (
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
  };
  const s = map[status] ?? map.absent;
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
          shadow-2xl
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
          {url ? (
            <img
              src={url}
              alt="Selfie"
              className="w-full h-full object-contain"
              style={{ maxHeight: '50vh' }}
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