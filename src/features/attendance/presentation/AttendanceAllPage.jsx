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
      if (emp) {
        list = list.filter((r) => r.employeeId === emp.employee_id);
      }
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
    <div className="space-y-4 relative">
      <div
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(242,106,27,0.20) 0%, rgba(242,106,27,0.06) 40%, rgba(242,106,27,0) 70%)',
        }}
      />

      <div className="relative space-y-4">
        {/* Header — gradient band */}
        <div className="rounded-2xl bg-gradient-to-br from-primary-light/70 via-primary-light/25 to-transparent px-5 py-4 border border-primary/10 shadow-card flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white shadow-brand shrink-0">
              <Calendar size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-textDark tracking-tight">
                Attendance Records
              </h2>
              <p className="text-xs text-textMedium mt-0.5">
                View, filter, add notes, and export your team's attendance
              </p>
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={exporting || visible.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-br from-primary to-primary-dark text-white font-semibold text-sm shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
          >
            <Download size={15} />
            {exporting ? 'Generating...' : 'Export PDF'}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile label="Total" value={stats.total} tone="brand" icon={<Calendar size={14} />} />
          <StatTile label="Present" value={stats.present} tone="good" icon={<Check size={14} />} />
          <StatTile label="Late" value={stats.late} tone="warn" />
          <StatTile label="Absent" value={stats.absent} tone="bad" />
        </div>

        {/* Filters */}
        <div className="rounded-2xl p-3 border border-border shadow-card bg-gradient-to-r from-white via-white to-primary-light/15 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[220px] px-3 py-2 rounded-xl border border-border bg-white focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition">
              <Search size={16} className="text-textLight shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or employee ID..."
                className="flex-1 bg-transparent outline-none text-sm text-textDark placeholder:text-textLight"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="text-[10px] font-bold text-textLight hover:text-primary transition"
                >
                  CLEAR
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Users size={16} className="text-primary shrink-0" />
              <EmployeePicker
                employees={employees}
                value={filterEmployeeId}
                onChange={setFilterEmployeeId}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => {
                    setRange(r.key);
                    clearCustomRange();
                  }}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition ${
                    range === r.key && !customFrom && !customTo
                      ? 'bg-gradient-to-br from-primary to-primary-dark text-white shadow-md shadow-primary/30'
                      : 'bg-white text-textMedium border border-border hover:border-primary/40 hover:bg-primary-light/20 hover:text-textDark'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Calendar size={14} className="text-primary" />
              <DatePill value={customFrom} onChange={setCustomFrom} placeholder="From" />
              <span className="text-xs text-textLight">to</span>
              <DatePill value={customTo} onChange={setCustomTo} placeholder="To" />
              {(customFrom || customTo) && (
                <button
                  onClick={clearCustomRange}
                  className="text-[10px] font-bold text-primary hover:underline"
                >
                  CLEAR
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-20 text-textLight">Loading...</div>
        ) : visible.length === 0 ? (
          <EmptyState hasFilters={!!hasFilters} />
        ) : (
          <div className="bg-white rounded-2xl shadow-card border border-border overflow-hidden">
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
                    const missingTimeout =
                      r.timeIn && !r.timeOut && r.status !== 'absent';

                    return (
                      <tr
                        key={r.id}
                        className="border-t border-border hover:bg-primary-light/10 transition"
                      >
                        <td
                          className="px-4 py-3 cursor-pointer"
                          onClick={() => setSelectedRecord(r)}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-light to-primary/30 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                              {r.employeeName?.[0]?.toUpperCase() ?? '?'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-textDark truncate">
                                {r.employeeName}
                              </p>
                              <p className="text-[10px] text-textLight truncate">
                                {r.employeeId}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td
                          className="px-4 py-3 text-textDark whitespace-nowrap font-medium cursor-pointer"
                          onClick={() => setSelectedRecord(r)}
                        >
                          {r.date}
                        </td>
                        <td
                          className="px-4 py-3 text-textDark whitespace-nowrap cursor-pointer"
                          onClick={() => setSelectedRecord(r)}
                        >
                          {formatTime(r.timeIn)}
                        </td>
                        <td
                          className="px-4 py-3 whitespace-nowrap cursor-pointer"
                          onClick={() => setSelectedRecord(r)}
                        >
                          {missingTimeout ? (
                            <span className="inline-flex items-center gap-1 text-red text-[10px] font-bold px-2 py-0.5 rounded-full bg-redLight border border-red/20">
                              MISSING
                            </span>
                          ) : (
                            <span className="text-textDark">{formatTime(r.timeOut)}</span>
                          )}
                        </td>
                        <td
                          className="px-4 py-3 text-textMedium whitespace-nowrap cursor-pointer"
                          onClick={() => setSelectedRecord(r)}
                        >
                          {hoursWorked(r)}
                        </td>
                        <td
                          className="px-4 py-3 cursor-pointer"
                          onClick={() => setSelectedRecord(r)}
                        >
                          <span
                            className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wide border ${
                              r.status === 'present'
                                ? 'bg-greenLight text-green border-green/20'
                                : r.status === 'late'
                                ? 'bg-yellowLight text-yellow border-yellow/20'
                                : r.status === 'on_leave'
                                ? 'bg-blueLight text-blue border-blue/20'
                                : r.status === 'absent'
                                ? 'bg-redLight text-red border-red/20'
                                : 'bg-bg text-textMedium border-border'
                            }`}
                          >
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
                            title={hasNotes ? r.notes : 'Add a note for this day'}
                          >
                            <StickyNote size={10} />
                            {hasNotes ? 'View / Add' : '+ Add note'}
                          </button>
                        </td>
                        <td
                          className="px-4 py-3 text-right cursor-pointer"
                          onClick={() => setSelectedRecord(r)}
                        >
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
        )}
      </div>

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
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold flex items-center gap-2 text-white ${
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
    <div className={`rounded-2xl border shadow-card px-4 py-3 flex items-center gap-3 ${tones[tone]}`}>
      {icon && (
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconTones[tone]}`}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-bold tracking-wider uppercase opacity-70 truncate">
          {label}
        </p>
        <p className="text-xl font-bold leading-tight">{value}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────
function EmptyState({ hasFilters }) {
  return (
    <div className="text-center py-20 px-6 bg-white rounded-2xl border border-border shadow-card">
      <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-primary-light via-primary-light/70 to-primary/20 flex items-center justify-center mb-5 shadow-lg shadow-primary/10">
        <Inbox size={40} className="text-primary" />
      </div>
      <h3 className="text-lg font-bold text-textDark mb-1">
        {hasFilters ? 'No matching records' : 'No attendance records yet'}
      </h3>
      <p className="text-sm text-textLight max-w-md mx-auto">
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
        year: 'numeric',
      })
    : placeholder;

  return (
    <label
      className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer transition ${
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
// Employee picker (unchanged)
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
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition min-w-[160px] ${
          open
            ? 'border-primary ring-2 ring-primary/20 bg-white'
            : 'border-border bg-white hover:border-primary/40'
        }`}
      >
        <span className="text-textDark truncate flex-1 text-left">
          {selected ? selected.full_name : 'All employees'}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-textLight transition-transform shrink-0 ${
            open ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-30 top-full right-0 mt-2 w-64 bg-white rounded-2xl border border-border shadow-2xl overflow-hidden">
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
              <span className="text-sm font-semibold text-textDark flex-1">
                All employees
              </span>
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
                    <p className="text-xs font-semibold text-textDark truncate">
                      {e.full_name}
                    </p>
                    <p className="text-[10px] text-textLight truncate">
                      {e.employee_id}
                    </p>
                  </div>
                  {isSelected && <Check size={14} className="text-primary shrink-0" />}
                </button>
              );
            })}

            {filtered.length === 0 && (
              <p className="text-xs text-textLight text-center py-6">
                No matching employees
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}