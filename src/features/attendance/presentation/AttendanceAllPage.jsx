// admin-panel/src/features/attendance/presentation/AttendanceAllPage.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Download, Users, Calendar, Inbox, Check, StickyNote } from 'lucide-react';
import { attendanceRepository } from '../data/attendanceRepository';
import { createAttendanceRecord } from '../domain/AttendanceRecord';
import { formatTime } from '../../../core/utils/formatters';
import { exportAttendancePDF } from '../../../core/utils/pdfExport';
import AttendanceRecordDrawer from './widgets/AttendanceRecordDrawer';
import QuickNoteModal from './widgets/QuickNoteModal';

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all',   label: 'All Time' },
];

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function AttendanceAllPage() {
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [search, setSearch] = useState('');
  const [filterEmployeeId, setFilterEmployeeId] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [noteRecord, setNoteRecord] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const raw = await attendanceRepository.fetchRecords({
        filter: 'all',
        limit: 500,
      });

      const { employeesRepository } = await import(
        '../../employees/data/employeesRepository'
      );
      const emps = await employeesRepository.fetchAll();

      const empMap = Object.fromEntries(emps.map((e) => [e.id, e]));
      const enriched = raw.map((r) => {
        const emp = empMap[r.user_id];
        return {
          ...r,
          profiles: emp
            ? {
                full_name: emp.full_name,
                employee_id: emp.employee_id,
                position: emp.position,
              }
            : null,
        };
      });

      setRecords(enriched.map(createAttendanceRecord));
      setEmployees(emps);
    } catch (e) {
      console.error('LOAD FAILED:', e);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }

  function rangeDates() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (customFrom || customTo) {
      return { from: customFrom || null, to: customTo || null };
    }

    switch (range) {
      case 'today':
        return { from: toDateStr(today), to: toDateStr(today) };
      case 'week': {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return { from: toDateStr(weekAgo), to: toDateStr(today) };
      }
      case 'month': {
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return { from: toDateStr(firstOfMonth), to: toDateStr(today) };
      }
      case 'all':
      default:
        return { from: null, to: null };
    }
  }

  const visible = useMemo(() => {
    let list = records;
    const { from, to } = rangeDates();
    if (from) list = list.filter((r) => r.date >= from);
    if (to) list = list.filter((r) => r.date <= to);

    if (filterEmployeeId) {
      const emp = employees.find((e) => e.id === filterEmployeeId);
      if (emp) list = list.filter((r) => r.employeeId === emp.employee_id);
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.employeeName?.toLowerCase().includes(q) ||
          r.employeeId?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [records, range, customFrom, customTo, search, filterEmployeeId, employees]);

  const stats = useMemo(() => {
    const acc = { total: visible.length, present: 0, late: 0, absent: 0 };
    for (const r of visible) {
      if (r.status === 'present') acc.present++;
      else if (r.status === 'late') acc.late++;
      else if (r.status === 'absent') acc.absent++;
    }
    return acc;
  }, [visible]);

  function hoursWorked(r) {
    if (!r.timeIn || !r.timeOut) return '--';
    const ms = new Date(r.timeOut) - new Date(r.timeIn);
    if (ms <= 0) return '--';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  }

  async function handleExport() {
    if (visible.length === 0) {
      showToast('Nothing to export', 'error');
      return;
    }
    setExporting(true);
    try {
      const rangeLabel =
        customFrom || customTo
          ? `${customFrom || '...'} → ${customTo || '...'}`
          : RANGES.find((r) => r.key === range)?.label || 'All Time';

      await exportAttendancePDF(visible, {
        orgName: 'Media Box',
        dateRange: rangeLabel,
        getSelfieUrl: attendanceRepository.getSelfieUrl,
        formatTime,
        hoursWorked,
      });

      showToast(
        `PDF exported · ${visible.length} record${visible.length === 1 ? '' : 's'}`,
        'success'
      );
    } catch (e) {
      console.error(e);
      showToast('PDF export failed', 'error');
    } finally {
      setExporting(false);
    }
  }

  function showToast(message, type) {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2600);
  }

  function clearCustomRange() {
    setCustomFrom('');
    setCustomTo('');
  }

  const hasFilters =
    range !== 'month' || customFrom || customTo || search.trim() || filterEmployeeId;

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Header — responsive */}
      <div className="flex items-start justify-between flex-wrap gap-3 md:gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white shadow-brand shrink-0">
            <Calendar size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl md:text-2xl font-bold text-textDark tracking-tight truncate">
              Attendance Records
            </h2>
            <p className="text-[11px] md:text-xs text-textMedium mt-0.5 truncate">
              View, filter, add notes, and export
            </p>
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting || visible.length === 0}
          className="inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 rounded-full bg-gradient-to-br from-primary to-primary-dark text-white font-semibold text-xs md:text-sm shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed shrink-0"
        >
          <Download size={14} className="md:hidden" />
          <Download size={15} className="hidden md:block" />
          <span className="whitespace-nowrap">{exporting ? 'Generating...' : 'Export'}</span>
        </button>
      </div>

      {/* Stats — 2x2 on mobile, 4 across on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        <StatTile label="Total" value={stats.total} tone="brand" icon={<Calendar size={13} />} />
        <StatTile label="Present" value={stats.present} tone="good" icon={<Check size={13} />} />
        <StatTile label="Late" value={stats.late} tone="warn" />
        <StatTile label="Absent" value={stats.absent} tone="bad" />
      </div>

      {/* Filters */}
      <div className="rounded-2xl p-2.5 md:p-3 border border-border shadow-card bg-gradient-to-r from-white via-white to-primary-light/15 space-y-2.5 md:space-y-3">
        {/* Search + employee picker — full row each on mobile */}
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-white focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition md:flex-1">
            <Search size={14} className="text-textLight shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or ID…"
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

          <div className="flex items-center gap-2">
            <Users size={14} className="text-primary shrink-0" />
            <EmployeePicker
              employees={employees}
              value={filterEmployeeId}
              onChange={setFilterEmployeeId}
            />
          </div>
        </div>

        {/* Range chips + date range */}
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
          <div className="-mx-2.5 md:mx-0 px-2.5 md:px-0 overflow-x-auto md:overflow-visible">
            <div className="flex gap-1.5 md:gap-2 w-max md:w-auto">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => {
                    setRange(r.key);
                    clearCustomRange();
                  }}
                  className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[11px] md:text-xs font-semibold transition whitespace-nowrap ${
                    range === r.key && !customFrom && !customTo
                      ? 'bg-gradient-to-br from-primary to-primary-dark text-white shadow-md shadow-primary/30'
                      : 'bg-white text-textMedium border border-border hover:border-primary/40 hover:bg-primary-light/20 hover:text-textDark'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 md:ml-auto">
            <Calendar size={13} className="text-primary shrink-0" />
            <DatePill value={customFrom} onChange={setCustomFrom} placeholder="From" />
            <span className="text-[10px] md:text-xs text-textLight">to</span>
            <DatePill value={customTo} onChange={setCustomTo} placeholder="To" />
            {(customFrom || customTo) && (
              <button
                onClick={clearCustomRange}
                className="text-[10px] font-bold text-primary hover:underline shrink-0"
              >
                CLEAR
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table / Cards */}
      {loading ? (
        <div className="text-center py-20 text-textLight text-sm">Loading...</div>
      ) : visible.length === 0 ? (
        <EmptyState hasFilters={!!hasFilters} />
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden md:block bg-white rounded-2xl shadow-card border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-primary-light/40 to-primary-light/10 text-textMedium text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-3 font-bold">Employee</th>
                    <th className="text-left px-4 py-3 font-bold">Date</th>
                    <th className="text-left px-4 py-3 font-bold">Time In</th>
                    <th className="text-left px-4 py-3 font-bold">Time Out</th>
                    <th className="text-left px-4 py-3 font-bold">Hours</th>
                    <th className="text-left px-4 py-3 font-bold">Status</th>
                    <th className="text-left px-4 py-3 font-bold">Notes</th>
                    <th className="text-right px-4 py-3 font-bold">Selfie</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => {
                    const selfieUrl = attendanceRepository.getSelfieUrl(r.selfieUrl);
                    const hasNotes = !!r.notes;
                    const missingTimeout = r.timeIn && !r.timeOut && r.status !== 'absent';
                    return (
                      <tr
                        key={r.id}
                        className="border-t border-border hover:bg-primary-light/10 transition"
                      >
                        <td className="px-4 py-3 cursor-pointer" onClick={() => setSelectedRecord(r)}>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-light to-primary/30 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                              {r.employeeName?.[0]?.toUpperCase() ?? '?'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-textDark truncate">{r.employeeName}</p>
                              <p className="text-[10px] text-textLight truncate">{r.employeeId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-textDark whitespace-nowrap font-medium cursor-pointer" onClick={() => setSelectedRecord(r)}>{r.date}</td>
                        <td className="px-4 py-3 text-textDark whitespace-nowrap cursor-pointer" onClick={() => setSelectedRecord(r)}>{formatTime(r.timeIn)}</td>
                        <td className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => setSelectedRecord(r)}>
                          {missingTimeout ? (
                            <span className="inline-flex items-center gap-1 text-red text-[10px] font-bold px-2 py-0.5 rounded-full bg-redLight border border-red/20">
                              MISSING
                            </span>
                          ) : (
                            <span className="text-textDark">{formatTime(r.timeOut)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-textMedium whitespace-nowrap cursor-pointer" onClick={() => setSelectedRecord(r)}>{hoursWorked(r)}</td>
                        <td className="px-4 py-3 cursor-pointer" onClick={() => setSelectedRecord(r)}>
                          <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wide border ${
                            r.status === 'present' ? 'bg-greenLight text-green border-green/20'
                            : r.status === 'late' ? 'bg-yellowLight text-yellow border-yellow/20'
                            : r.status === 'on_leave' ? 'bg-blueLight text-blue border-blue/20'
                            : r.status === 'absent' ? 'bg-redLight text-red border-red/20'
                            : 'bg-bg text-textMedium border-border'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setNoteRecord(r)}
                            className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border transition ${
                              hasNotes
                                ? 'bg-yellowLight border-yellow/30 text-yellow hover:bg-yellow/15'
                                : 'bg-white border-border text-textLight hover:border-primary/40 hover:text-primary hover:bg-primary-light/20'
                            }`}
                          >
                            <StickyNote size={10} />
                            {hasNotes ? 'View / Add' : '+ Add note'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right cursor-pointer" onClick={() => setSelectedRecord(r)}>
                          {selfieUrl ? (
                            <img
                              src={selfieUrl}
                              alt="selfie"
                              className="w-9 h-9 rounded-lg object-cover border border-border inline-block"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <span className="text-xs text-textLight">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 bg-gradient-to-r from-primary-light/20 to-transparent border-t border-border text-xs text-textMedium font-semibold">
              Showing {visible.length} of {records.length} records
            </div>
          </div>

          {/* Mobile: card list */}
          <div className="md:hidden space-y-2">
            {visible.map((r) => {
              const selfieUrl = attendanceRepository.getSelfieUrl(r.selfieUrl);
              const hasNotes = !!r.notes;
              const missingTimeout = r.timeIn && !r.timeOut && r.status !== 'absent';
              return (
                <div
                  key={r.id}
                  className="bg-white rounded-2xl border border-border shadow-card overflow-hidden"
                >
                  <button
                    onClick={() => setSelectedRecord(r)}
                    className="w-full text-left p-3 space-y-2.5"
                  >
                    {/* Row 1: avatar + name + status */}
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-light to-primary/30 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                        {r.employeeName?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-textDark truncate">
                          {r.employeeName}
                        </p>
                        <p className="text-[10px] text-textLight truncate">
                          {r.employeeId} · {r.date}
                        </p>
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide border shrink-0 ${
                        r.status === 'present' ? 'bg-greenLight text-green border-green/20'
                        : r.status === 'late' ? 'bg-yellowLight text-yellow border-yellow/20'
                        : r.status === 'on_leave' ? 'bg-blueLight text-blue border-blue/20'
                        : r.status === 'absent' ? 'bg-redLight text-red border-red/20'
                        : 'bg-bg text-textMedium border-border'
                      }`}>
                        {r.status}
                      </span>
                    </div>

                    {/* Row 2: times + hours + selfie thumb */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 grid grid-cols-3 gap-1.5 text-[10px]">
                        <div className="rounded-lg bg-bg px-2 py-1.5">
                          <p className="font-bold text-textLight uppercase tracking-wider text-[9px]">In</p>
                          <p className="text-textDark font-semibold mt-0.5 truncate">{formatTime(r.timeIn)}</p>
                        </div>
                        <div className="rounded-lg bg-bg px-2 py-1.5">
                          <p className="font-bold text-textLight uppercase tracking-wider text-[9px]">Out</p>
                          {missingTimeout ? (
                            <p className="text-red font-bold mt-0.5 text-[9px]">MISSING</p>
                          ) : (
                            <p className="text-textDark font-semibold mt-0.5 truncate">{formatTime(r.timeOut)}</p>
                          )}
                        </div>
                        <div className="rounded-lg bg-bg px-2 py-1.5">
                          <p className="font-bold text-textLight uppercase tracking-wider text-[9px]">Hours</p>
                          <p className="text-textDark font-semibold mt-0.5 truncate">{hoursWorked(r)}</p>
                        </div>
                      </div>
                      {selfieUrl ? (
                        <img
                          src={selfieUrl}
                          alt=""
                          className="w-11 h-11 rounded-lg object-cover border border-border shrink-0"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-bg flex items-center justify-center text-textFaint text-[10px] shrink-0">
                          —
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Note button row */}
                  <div className="px-3 pb-3 flex items-center justify-between">
                    <button
                      onClick={() => setNoteRecord(r)}
                      className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border transition ${
                        hasNotes
                          ? 'bg-yellowLight border-yellow/30 text-yellow'
                          : 'bg-white border-border text-textLight hover:border-primary/40 hover:text-primary'
                      }`}
                    >
                      <StickyNote size={10} />
                      {hasNotes ? 'View / Add note' : '+ Add note'}
                    </button>
                    <span className="text-[10px] font-bold text-primary">Tap card to open →</span>
                  </div>
                </div>
              );
            })}
            <p className="text-center text-[10px] text-textLight pt-2">
              Showing {visible.length} of {records.length} records
            </p>
          </div>
        </>
      )}

      <AttendanceRecordDrawer
        open={!!selectedRecord}
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
        onSaved={loadAll}
      />

      <QuickNoteModal
        open={!!noteRecord}
        record={noteRecord}
        onClose={() => setNoteRecord(null)}
        onSaved={loadAll}
      />

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-2xl shadow-2xl text-xs md:text-sm font-semibold flex items-center gap-2 text-white ${
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

// ─────────────────────────────────────────────────────────
// Stats tile
// ─────────────────────────────────────────────────────────
function StatTile({ label, value, tone, icon }) {
  const tones = {
    brand: 'bg-gradient-to-br from-primary-light/70 to-primary-light/30 border-primary/25 text-textDark',
    good:  'bg-gradient-to-br from-greenLight to-greenLight/50 border-green/30 text-green',
    warn:  'bg-gradient-to-br from-yellowLight to-yellowLight/50 border-yellow/30 text-yellow',
    bad:   'bg-gradient-to-br from-redLight to-redLight/50 border-red/30 text-red',
  };
  const iconTones = {
    brand: 'bg-white/80 text-primary',
    good:  'bg-white/70 text-green',
    warn:  'bg-white/70 text-yellow',
    bad:   'bg-white/70 text-red',
  };
  return (
    <div className={`rounded-xl md:rounded-2xl border shadow-card p-2.5 md:px-4 md:py-3 flex items-center gap-2 md:gap-3 ${tones[tone]}`}>
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

// ─────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────
function EmptyState({ hasFilters }) {
  return (
    <div className="text-center py-16 md:py-20 px-4 md:px-6 bg-white rounded-2xl border border-border shadow-card">
      <div className="w-16 h-16 md:w-24 md:h-24 mx-auto rounded-2xl md:rounded-3xl bg-gradient-to-br from-primary-light via-primary-light/70 to-primary/20 flex items-center justify-center mb-4 md:mb-5 shadow-lg shadow-primary/10">
        <Inbox size={28} className="md:hidden text-primary" />
        <Inbox size={40} className="hidden md:block text-primary" />
      </div>
      <h3 className="text-base md:text-lg font-bold text-textDark mb-1">
        {hasFilters ? 'No matching records' : 'No attendance records yet'}
      </h3>
      <p className="text-xs md:text-sm text-textLight max-w-md mx-auto">
        {hasFilters
          ? 'Try adjusting the filters or search term.'
          : 'Records will appear here as employees start timing in.'}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Date pill
// ─────────────────────────────────────────────────────────
function DatePill({ value, onChange, placeholder }) {
  const formatted = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
      })
    : placeholder;

  return (
    <label
      className={`relative inline-flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-full border text-[11px] md:text-xs font-semibold cursor-pointer transition ${
        value
          ? 'bg-gradient-to-br from-primary-light to-primary-light/60 border-primary/30 text-primary'
          : 'bg-white border-border text-textMedium hover:border-primary/40 hover:bg-primary-light/15'
      }`}
    >
      <span>{formatted}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />
    </label>
  );
}

// ─────────────────────────────────────────────────────────
// Employee picker (unchanged, just responsive)
// ─────────────────────────────────────────────────────────
function EmployeePicker({ employees, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const selected = employees.find((e) => e.id === value);

  const filtered = employees.filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.full_name?.toLowerCase().includes(q) ||
      e.employee_id?.toLowerCase().includes(q)
    );
  });

  function initialsFor(name) {
    if (!name) return '?';
    return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  }

  return (
    <div ref={ref} className="relative flex-1 md:flex-none">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full md:w-auto flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition md:min-w-[160px] ${
          open
            ? 'border-primary ring-2 ring-primary/20 bg-white'
            : 'border-border bg-white hover:border-primary/40'
        }`}
      >
        <span className="text-textDark truncate flex-1 text-left text-xs md:text-sm">
          {selected ? selected.full_name : 'All employees'}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-textLight transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-30 top-full right-0 md:right-0 md:left-auto mt-2 w-full md:w-64 bg-white rounded-2xl border border-border shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg">
              <Search size={14} className="text-textLight shrink-0" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="flex-1 bg-transparent outline-none text-xs text-textDark placeholder:text-textLight"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto p-1.5">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
                setSearch('');
              }}
              className={`w-full flex items-center gap-2 p-2 rounded-xl text-left transition ${
                !value ? 'bg-primary-light/60' : 'hover:bg-bg'
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-bg flex items-center justify-center shrink-0">
                <Users size={12} className="text-textLight" />
              </div>
              <span className="text-sm font-semibold text-textDark flex-1">All employees</span>
              {!value && <Check size={14} className="text-primary shrink-0" />}
            </button>

            {filtered.map((e) => {
              const isSelected = e.id === value;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    onChange(e.id);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={`w-full flex items-center gap-2 p-2 rounded-xl text-left transition ${
                    isSelected ? 'bg-primary-light/60' : 'hover:bg-bg'
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-light to-primary/30 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                    {initialsFor(e.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-textDark truncate">{e.full_name}</p>
                    <p className="text-[10px] text-textLight truncate">{e.employee_id}</p>
                  </div>
                  {isSelected && <Check size={14} className="text-primary shrink-0" />}
                </button>
              );
            })}

            {filtered.length === 0 && (
              <p className="text-xs text-textLight text-center py-6">No matching employees</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}