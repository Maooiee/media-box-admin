// admin-panel/src/features/dashboard/presentation/DashboardPage.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardRepository } from '../data/dashboardRepository';
import {
  fetchWorkforceAvailability,
  fmtMinutes,
} from '../data/workforceRepository';
import { supabase } from '../../../core/config/supabase';
import { formatTime } from '../../../core/utils/formatters';
import { exportAttendancePDF } from '../../../core/utils/pdfExport';
import PageHeader from '../../../shared/components/PageHeader';
import SegmentedTabs from '../../../shared/components/SegmentedTabs';
import SelfieImage from '../../../shared/components/SelfieImage'; // <-- Added
import { Skeleton, SkeletonCard, SkeletonStats } from '../../../shared/components/Skeleton';

// 🧪 DEV-ONLY crash trigger — verifies the ErrorBoundary.
//   1. Start the dev server and log in.
//   2. Visit http://localhost:5173/dashboard?crash
//   The page throws once, the ErrorBoundary shows its fallback, and
//   clicking "Try again" recovers (it only throws a single time per
//   page load). A full reload re-arms it.
// In production `import.meta.env.DEV` is statically false, so this is
// dead code and gets stripped from the bundle.
let devCrashArmed = true;
function maybeDevCrash() {
  if (!import.meta.env.DEV || !devCrashArmed) return;
  if (typeof window === 'undefined') return;
  if (!new URLSearchParams(window.location.search).has('crash')) return;
  devCrashArmed = false;
  throw new Error('Test crash — ErrorBoundary verification via ?crash');
}

export default function DashboardPage() {
  maybeDevCrash(); // must run before hooks: it throws on the first pass only
  const navigate = useNavigate();
  const [range, setRange] = useState('today');
  const [loading, setLoading] = useState(true);
  const [todayRecords, setTodayRecords] = useState([]);
  const [liveNow, setLiveNow] = useState([]);
  const [todayShifts, setTodayShifts] = useState([]);
  const [recent, setRecent] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [missing, setMissing] = useState([]);
  const [weeklySummary, setWeeklySummary] = useState({
    total: 0, present: 0, late: 0, absent: 0, onTimeRate: 0, avgCheckIn: '—',
  });
  const [selfieSnapshot, setSelfieSnapshot] = useState({
    avg: 0, flagged: 0, noSelfie: 0, total: 0,
  });
  const [workforce, setWorkforce] = useState({
    onDuty: [], absent: [], onLeave: [], offDuty: [],
  });
  const [pendingLeave, setPendingLeave] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadAll() {
    try {
      setRefreshing(true);
      const [
        today, live, recentData, weeklyData, missingData,
        summary, snapshot, wf, leaveCount, shiftsData,
      ] = await Promise.all([
        dashboardRepository.fetchTodayRecords(),
        dashboardRepository.fetchLiveNow(),
        dashboardRepository.fetchRecentCheckins(6),
        dashboardRepository.fetchWeeklyTrend(7),
        dashboardRepository.fetchMissingTimeouts(5),
        dashboardRepository.fetchWeeklySummary(),
        dashboardRepository.fetchSelfieSnapshot(),
        fetchWorkforceAvailability(),
        dashboardRepository.fetchPendingLeaveCount?.() ?? Promise.resolve(0),
        dashboardRepository.fetchUpcomingShifts(5).catch(() => []),
      ]);
      setTodayRecords(Array.isArray(today) ? today : []);
      setLiveNow(Array.isArray(live) ? live : []);
      setTodayShifts(Array.isArray(shiftsData) ? shiftsData : []);
      setRecent(Array.isArray(recentData) ? recentData : []);
      setWeekly(Array.isArray(weeklyData) ? weeklyData : []);
      setMissing(Array.isArray(missingData) ? missingData : []);
      setWeeklySummary(summary ?? { total: 0, present: 0, late: 0, absent: 0, onTimeRate: 0, avgCheckIn: '—' });
      setSelfieSnapshot(snapshot ?? { avg: 0, flagged: 0, noSelfie: 0, total: 0 });
      setWorkforce(wf ?? { onDuty: [], absent: [], onLeave: [], offDuty: [] });
      setPendingLeave(leaveCount ?? 0);
    } catch (e) {
      console.error('Dashboard load failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function goToSelfieReview(filter) {
    navigate(filter ? `/attendance?filter=${filter}` : '/attendance');
  }

  async function handleExportToday() {
    if (todayRecords.length === 0) return;

    // Pre-fetch signed URLs for the PDF export
    const recordsWithSignedUrls = await Promise.all(
      todayRecords.map(async (r) => {
        let signedUrl = null;
        if (r.selfie_url) {
          const { data } = await supabase.storage
            .from('selfies')
            .createSignedUrl(r.selfie_url, 3600);
          if (data) signedUrl = data.signedUrl;
        }
        
        return {
          employeeName: r.profiles?.full_name ?? 'Unknown',
          employeeId: r.profiles?.employee_id ?? '',
          position: r.profiles?.position ?? '',
          date: r.date,
          timeIn: r.time_in,
          timeOut: r.time_out,
          status: r.status,
          selfieUrl: signedUrl, // Pass the actual signed URL
        };
      })
    );

    await exportAttendancePDF(recordsWithSignedUrls, {
      orgName: 'Media Box',
      dateRange: 'Today',
      getSelfieUrl: (url) => url, // It's already a signed URL
      formatTime,
      hoursWorked: (r) => {
        if (!r.timeIn || !r.timeOut) return '--';
        const ms = new Date(r.timeOut) - new Date(r.timeIn);
        if (ms <= 0) return '--';
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        return `${h}h ${m}m`;
      },
    });
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-3 pb-6 md:space-y-4 md:pb-8">
        <Skeleton className="h-28 w-full md:h-32" rounded="rounded-2xl" />
        <SkeletonStats count={4} />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 md:gap-4">
          <div className="space-y-3 md:space-y-4 lg:col-span-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="space-y-3 md:space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-3 md:space-y-4 pb-6 md:pb-8">
      {/* Header — responsive */}
      <PageHeader
        section="Admin"
        title="Attendance Dashboard"
        subtitle={new Date().toLocaleDateString('en-PH', {
          timeZone: 'Asia/Manila',
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
        })}
        icon={IconChartBar}
        action={
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-[11px] text-textLight md:flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green" />
              </span>
              {refreshing
                ? 'Refreshing…'
                : `Live · ${new Date().toLocaleTimeString('en-PH', {
                    timeZone: 'Asia/Manila',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`}
            </div>
            <SegmentedTabs
              value={range}
              onChange={setRange}
              items={[
                { key: 'today', label: 'Today' },
                { key: 'week', label: 'Week' },
                { key: 'month', label: 'Month' },
              ]}
            />
          </div>
        }
      />

      {/* This Week summary — responsive */}
      <div className="surface-card border-primary/15 bg-gradient-to-br from-primary-light/60 via-white to-white p-3.5 md:p-4">
        <div className="flex items-center justify-between mb-2.5 md:mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-light/70 text-primary md:h-8 md:w-8">
              <IconCalendar size={14} />
            </div>
            <p className="text-xs font-bold text-textDark">This Week</p>
          </div>
          <span className={`text-xs font-bold ${
            weeklySummary.onTimeRate >= 90 ? 'text-green'
            : weeklySummary.onTimeRate >= 70 ? 'text-yellow' : 'text-red'
          }`}>
            {weeklySummary.onTimeRate}% on-time
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Present" value={weeklySummary.present} tone="good" />
          <MiniStat label="Late" value={weeklySummary.late} tone="warn" />
          <MiniStat label="Absent" value={weeklySummary.absent} tone="bad" />
        </div>
        <div className="mt-2.5 md:mt-3 pt-2.5 md:pt-3 border-t border-primary/10 flex items-center justify-between text-[10px] md:text-[11px] text-textMedium">
          <span>{weeklySummary.total} check-ins</span>
          <span>Avg {weeklySummary.avgCheckIn}</span>
        </div>
      </div>

      {/* Workforce */}
      <WorkforceCard workforce={workforce} />

      {/* Main grid — single column on mobile, 3 columns on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        <div className="lg:col-span-2 space-y-3 md:space-y-4">
          <Card
            title="Live now"
            subtitle={`${liveNow.length} ${liveNow.length === 1 ? 'person' : 'people'} on shift`}
            icon={<IconPulse size={15} />}
          >
            {liveNow.length === 0 ? (
              <EmptyText text="No one is currently on shift." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                {liveNow.map((r) => (
                  <LiveRow key={r.id} record={r} />
                ))}
              </div>
            )}
          </Card>

          <Card
            title="Recent Check-ins"
            subtitle={`Last ${recent.length} across all dates`}
            icon={<IconClock size={15} />}
            action={{ label: 'View all', onClick: () => goToSelfieReview('all') }}
          >
            {recent.length === 0 ? (
              <EmptyText text="No check-ins yet." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                {recent.map((r) => (
                  <CheckinRow key={r.id} record={r} />
                ))}
              </div>
            )}
          </Card>

          <Card
            title="Weekly Trend"
            subtitle="Check-ins · last 7 days"
            icon={<IconTrendingUp size={15} />}
          >
            <WeeklyChart data={weekly} />
          </Card>
        </div>

        <div className="space-y-3 md:space-y-4">
          <Card
            title="Today's Shifts"
            subtitle={`${todayShifts.length} scheduled`}
            icon={<IconCalendar size={15} />}
            action={{ label: 'Manage', onClick: () => navigate('/shifts') }}
          >
            {todayShifts.length === 0 ? (
              <EmptyText text="No shifts scheduled today." />
            ) : (
              <div className="space-y-0.5">
                {todayShifts.map((s) => (
                  <ShiftRow key={s.id} shift={s} />
                ))}
              </div>
            )}
          </Card>

          <Card title="Selfie Quality" icon={<IconCamera size={15} />}>
            <div className="space-y-2.5 md:space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold text-textLight">Avg score</span>
                <span className={`text-xl md:text-2xl font-bold leading-none ${
                  selfieSnapshot.avg >= 80 ? 'text-green'
                  : selfieSnapshot.avg >= 60 ? 'text-yellow' : 'text-red'
                }`}>
                  {selfieSnapshot.avg > 0 ? selfieSnapshot.avg : '—'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <MiniStat label="Flagged" value={selfieSnapshot.flagged} tone="warn" />
                <MiniStat label="No selfie" value={selfieSnapshot.noSelfie} tone="bad" />
              </div>
              <button
                onClick={() => goToSelfieReview('flagged')}
                className="w-full text-[11px] font-bold text-primary hover:underline text-left"
              >
                View flagged selfies →
              </button>
            </div>
          </Card>

          {missing.length > 0 && (
            <Card
              title="Missing Time-Out"
              subtitle={`${missing.length} ${missing.length === 1 ? 'employee' : 'employees'}`}
              icon={<IconAlert size={15} />}
              tone="warn"
            >
              <div className="space-y-0.5">
                {missing.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-1.5 md:py-2 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-textDark truncate">
                        {r.profiles?.full_name ?? 'Unknown'}
                      </p>
                      <p className="text-[10px] text-textLight truncate">
                        {r.date} · in {formatTime(r.time_in)}
                      </p>
                    </div>
                    <button
                      onClick={() => goToSelfieReview('all')}
                      className="text-[10px] font-bold text-primary hover:underline shrink-0 ml-2"
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {pendingLeave > 0 && (
            <Card
              title="Pending Leave"
              subtitle={`${pendingLeave} request${pendingLeave === 1 ? '' : 's'}`}
              icon={<IconClipboard size={15} />}
              tone="warn"
            >
              <button
                onClick={() => navigate('/leave')}
                className="w-full text-xs font-bold text-primary hover:underline text-left py-1.5 md:py-2"
              >
                Review requests →
              </button>
            </Card>
          )}

          <Card title="Quick Actions" icon={<IconBolt size={15} />}>
            <div className="space-y-1.5">
              <ActionButton
                icon={<IconFileText size={13} />}
                label="Export today's PDF"
                onClick={handleExportToday}
                disabled={todayRecords.length === 0}
              />
              <ActionButton
                icon={<IconCamera size={13} />}
                label="Review selfies"
                onClick={() => goToSelfieReview('all')}
              />
              <ActionButton
                icon={<IconClipboard size={13} />}
                label="All attendance"
                onClick={() => navigate('/records')}
              />
              <ActionButton
                icon={<IconUsers size={13} />}
                label="Manage employees"
                onClick={() => navigate('/employees')}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Workforce
// ─────────────────────────────────────────────────────────
function WorkforceCard({ workforce }) {
  const { onDuty = [], absent = [], onLeave = [], offDuty = [] } = workforce ?? {};
  const total = onDuty.length + absent.length + onLeave.length + offDuty.length;

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center justify-between px-4 md:px-5 py-3 md:py-3.5 border-b border-border/60">
        <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-primary-light flex items-center justify-center text-primary shrink-0">
            <IconPulse size={14} />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs md:text-sm font-bold text-textDark truncate">
              Workforce Availability
            </h3>
            <p className="text-[10px] text-textLight truncate">
              Who's in, who's out, who's absent
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-textLight shrink-0 ml-2">
          {total} {total === 1 ? 'employee' : 'employees'}
        </span>
      </div>

      {total === 0 ? (
        <p className="text-xs md:text-sm text-textLight text-center py-6 md:py-8">No employees yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-2 p-2">
          {onDuty.map((e) => (
            <WfRow key={e.userId} dot="bg-green animate-pulse" name={e.fullName} empId={e.employeeId} meta={`${fmtMinutes(e.minutesOn)} on`} metaColor="text-green" />
          ))}
          {onLeave.map((e) => (
            <WfRow key={e.userId} dot="bg-blue" name={e.fullName} empId={e.employeeId} meta="On leave" metaColor="text-blue" />
          ))}
          {absent.map((e) => (
            <WfRow key={e.userId} dot="bg-red" name={e.fullName} empId={e.employeeId} meta="Absent" metaColor="text-red" />
          ))}
          {offDuty.map((e) => (
            <WfRow key={e.userId} dot="bg-textFaint" name={e.fullName} empId={e.employeeId} meta={e.timeOut ? `Out ${formatTime(e.timeOut)}` : 'Off'} metaColor="text-textLight" />
          ))}
        </div>
      )}
    </div>
  );
}

function WfRow({ dot, name, empId, meta, metaColor }) {
  return (
    <div className="flex items-center gap-2 px-2.5 md:px-3 py-1.5 md:py-2 rounded-lg hover:bg-bg transition">
      <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full shrink-0 ${dot}`} />
      <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-primary-light flex items-center justify-center text-primary text-[9px] md:text-[10px] font-bold shrink-0">
        {name?.[0]?.toUpperCase() ?? '?'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] md:text-xs font-semibold text-textDark truncate">{name}</p>
        <p className="text-[9px] md:text-[10px] text-textLight truncate">{empId}</p>
      </div>
      <p className={`text-[9px] md:text-[10px] font-semibold shrink-0 ${metaColor}`}>{meta}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Card wrapper
// ─────────────────────────────────────────────────────────
function Card({ title, subtitle, icon, action, tone, children }) {
  const isWarn = tone === 'warn';

  return (
    <section
      className={`surface-card overflow-hidden transition-colors duration-200 hover:border-primary/20 ${
        isWarn ? 'border-yellow/30' : ''
      }`}
    >
      <div
        className={`flex items-center justify-between gap-3 border-b px-4 py-2.5 md:px-5 md:py-3.5 ${
          isWarn
            ? 'border-yellow/20 bg-yellowLight/50'
            : 'border-border/60 bg-white'
        }`}
      >
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          {icon && (
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg md:h-8 md:w-8 ${
                isWarn ? 'bg-white/80 text-yellow' : 'bg-primary-light/60 text-primary'
              }`}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="truncate text-xs font-bold text-textDark md:text-sm">{title}</h3>
            {subtitle && <p className="truncate text-[10px] text-textLight">{subtitle}</p>}
          </div>
        </div>
        {action && (
          <button
            onClick={action.onClick}
            className="ml-2 shrink-0 rounded-full px-2 py-1 text-[11px] font-bold text-primary transition hover:bg-primary-light/40"
          >
            {action.label}
          </button>
        )}
      </div>
      <div className="p-3 md:p-4">{children}</div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────
// Rows
// ─────────────────────────────────────────────────────────
function LiveRow({ record: r }) {
  const timeIn = r.time_in ? new Date(r.time_in) : null;
  let hours = 0, mins = 0;
  if (timeIn) {
    const diffMs = Math.max(0, Date.now() - timeIn.getTime());
    hours = Math.floor(diffMs / 3600000);
    mins = Math.floor((diffMs % 3600000) / 60000);
  }
  return (
    <div className="flex items-center gap-2 py-1.5 md:py-2">
      <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green animate-pulse shrink-0" />
      <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-primary-light flex items-center justify-center text-primary text-[9px] md:text-[10px] font-bold shrink-0">
        {(r.profiles?.full_name ?? '?')[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] md:text-xs font-semibold text-textDark truncate">
          {r.profiles?.full_name ?? 'Unknown'}
        </p>
        <p className="text-[9px] md:text-[10px] text-textLight">in {formatTime(r.time_in)}</p>
      </div>
      <span className="text-[10px] md:text-[11px] font-bold text-green shrink-0">
        {hours}h {mins}m
      </span>
    </div>
  );
}

function formatHour(hour) {
  const h = Number(hour);
  if (!Number.isFinite(h)) return '--';
  const suffix = h >= 12 ? 'PM' : 'AM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${suffix}`;
}

function ShiftRow({ shift: s }) {
  const isClosing = s.kind === 'closing';

  return (
    <div className="flex items-center gap-2 py-1.5 md:py-2">
      <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-primary-light flex items-center justify-center text-primary text-[9px] md:text-[10px] font-bold shrink-0">
        {(s.profiles?.full_name ?? '?')[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] md:text-xs font-semibold text-textDark truncate">
          {s.profiles?.full_name ?? 'Unknown'}
        </p>
        <p className="text-[9px] md:text-[10px] text-textLight truncate">
          {formatHour(s.start_hour)} – {formatHour(s.end_hour)}
        </p>
      </div>
      <span className={`text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
        isClosing ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
      }`}>
        {isClosing ? 'Closing' : 'Opening'}
      </span>
    </div>
  );
}

function CheckinRow({ record: r }) {
  const score = r.selfie_quality_score;

  return (
    <div className="flex items-center gap-2 py-1.5 md:py-2">
      <SelfieImage
        path={r.selfie_url}
        className="w-7 h-7 md:w-8 md:h-8 rounded-lg object-cover border border-border shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] md:text-xs font-semibold text-textDark truncate">
          {r.profiles?.full_name ?? 'Unknown'}
        </p>
        <p className="text-[9px] md:text-[10px] text-textLight truncate">
          {r.date} · {formatTime(r.time_in)}
        </p>
      </div>
      {score !== null && score !== undefined ? (
        <span className={`text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
          score >= 80 ? 'bg-greenLight text-green'
          : score >= 60 ? 'bg-yellowLight text-yellow'
          : 'bg-redLight text-red'
        }`}>
          {score}
        </span>
      ) : (
        <span className="text-[10px] text-textLight shrink-0">—</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Weekly chart
// ─────────────────────────────────────────────────────────
function WeeklyChart({ data }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <EmptyText text="No weekly data yet." />;
  }
  const max = Math.max(...data.map((d) => d.total || 0), 1);

  return (
    <div className="flex items-end justify-between gap-1.5 md:gap-2 h-24 md:h-32 px-1">
      {data.map((d, i) => {
        const heightPct = ((d.total || 0) / max) * 100;
        // Append a time so 'YYYY-MM-DD' is parsed as local midnight, not UTC.
        const dayLabel = new Date(d.date + 'T00:00:00').toLocaleDateString('en-PH', {
          weekday: 'short',
        });
        const isZero = !d.total;
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 md:gap-2">
            <span className={`text-[10px] md:text-[11px] font-bold ${isZero ? 'text-textFaint' : 'text-textDark'}`}>
              {d.total || 0}
            </span>
            <div className="w-full h-14 md:h-20 flex items-end justify-center">
              <div
                className={`w-full max-w-[36px] rounded-t-md transition-all duration-500 md:max-w-[40px] animate-[fadeUp_500ms_ease-out_both] ${
                  isZero ? 'bg-border' : 'bg-gradient-to-t from-primary to-primary/60'
                }`}
                style={{
                  height: `${Math.max(heightPct, 4)}%`,
                  animationDelay: `${i * 60}ms`,
                }}
                title={`${d.total} check-ins on ${d.date}`}
              />
            </div>
            <span className="text-[9px] md:text-[10px] font-semibold text-textLight uppercase">{dayLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Small pieces
// ─────────────────────────────────────────────────────────
function MiniStat({ label, value, tone }) {
  const tones = {
    good: 'bg-greenLight text-green',
    warn: 'bg-yellowLight text-yellow',
    bad: 'bg-redLight text-red',
  };
  return (
    <div className={`${tones[tone]} rounded-lg md:rounded-xl px-2 py-1.5 md:py-2 text-center`}>
      <p className="text-[9px] font-bold uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-sm md:text-base font-bold leading-tight mt-0.5">{value}</p>
    </div>
  );
}

function ActionButton({ icon, label, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-2 px-2.5 md:px-3 py-1.5 md:py-2 rounded-xl border border-border bg-white hover:border-primary hover:bg-primary-light/40 transition text-left disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <span className="text-textMedium">{icon}</span>
      <span className="text-[11px] md:text-xs font-semibold text-textDark">{label}</span>
    </button>
  );
}

function EmptyText({ text }) {
  return <p className="text-[11px] md:text-xs text-textLight text-center py-4 md:py-6">{text}</p>;
}

// ─────────────────────────────────────────────────────────
// Icons — unchanged from your original
// ─────────────────────────────────────────────────────────
const iconProps = {
  fill: 'none', stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round', strokeLinejoin: 'round',
};

function IconChartBar({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps}>
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
  </svg>;
}
function IconUsers({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps}>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>;
}
function IconClock({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>;
}
function IconPulse({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps}>
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>;
}
function IconTrendingUp({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>;
}
function IconCalendar({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>;
}
function IconCamera({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps}>
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>;
}
function IconAlert({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps}>
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>;
}
function IconBolt({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>;
}
function IconFileText({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>;
}
function IconClipboard({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps}>
    <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>;
}