// admin-panel/src/features/attendance/presentation/AttendanceAllPage.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Download, Users, Calendar, Inbox, Check, StickyNote, Briefcase } from 'lucide-react';
import { attendanceRepository } from '../data/attendanceRepository';
import { createAttendanceRecord } from '../domain/AttendanceRecord';
import {
  addDaysToDate,
  formatTime,
  toManilaDate,
} from '../../../core/utils/formatters';
import { exportAttendancePDF } from '../../../core/utils/pdfExport';
import AttendanceRecordDrawer from './widgets/AttendanceRecordDrawer';
import QuickNoteModal from './widgets/QuickNoteModal';

// 👈 Import the new custom DatePicker
import DatePicker from '../../../shared/components/DatePicker';
import PageHeader from '../../../shared/components/PageHeader';
import StatTile from '../../../shared/components/StatTile';
import EmptyState from '../../../shared/components/EmptyState';
import SearchField from '../../../shared/components/SearchField';
import FilterChips from '../../../shared/components/FilterChips';
import { SkeletonTable } from '../../../shared/components/Skeleton';

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all',   label: 'All Time' },
];

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
    if (customFrom || customTo) {
      return { from: customFrom || null, to: customTo || null };
    }

    const today = toManilaDate();

    switch (range) {
      case 'today':
        return { from: today, to: today };
      case 'week':
        return { from: addDaysToDate(today, -7), to: today };
      case 'month':
        return { from: `${today.slice(0, 7)}-01`, to: today };
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
    const acc = { total: 0, present: 0, late: 0, absent: 0, onLeave: 0 };
    for (const r of visible) {
      // Approved leave is not an attendance day — keep it out of the
      // present/late/absent/total attendance statistics.
      if (r.status === 'on_leave') {
        acc.onLeave++;
        continue;
      }
      acc.total++;
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
      {/* Header */}
      <PageHeader
        section="Attendance"
        title="Attendance Records"
        subtitle="View, filter, add notes, and export"
        icon={Calendar}
        action={
          <button
            onClick={handleExport}
            disabled={exporting || visible.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-primary to-primary-dark px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5 hover:shadow-primary/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 md:gap-2 md:px-4 md:text-sm"
          >
            <Download size={14} className="md:hidden" />
            <Download size={15} className="hidden md:block" />
            <span className="whitespace-nowrap">
              {exporting ? 'Generating...' : 'Export'}
            </span>
          </button>
        }
      />

      {/* Stats — 2x2 on mobile, 5 across on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
        <StatTile label="Total" value={stats.total} tone="brand" icon={<Calendar size={13} />} />
        <StatTile label="Present" value={stats.present} tone="good" icon={<Check size={13} />} />
        <StatTile label="Late" value={stats.late} tone="warn" />
        <StatTile label="Absent" value={stats.absent} tone="bad" />
        <StatTile label="On Leave" value={stats.onLeave} tone="info" icon={<Briefcase size={13} />} />
      </div>

      {/* Filters */}
      <div className="surface-toolbar space-y-2.5 p-2.5 md:space-y-3 md:p-3">
        {/* Search + employee picker — full row each on mobile */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search name or ID…"
            className="md:flex-1"
          />

          <div className="flex items-center gap-2">
            <Users size={14} className="shrink-0 text-primary" />
            <EmployeePicker
              employees={employees}
              value={filterEmployeeId}
              onChange={setFilterEmployeeId}
            />
          </div>
        </div>

        {/* Range chips + date range */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <FilterChips
            options={RANGES}
            value={customFrom || customTo ? '' : range}
            onChange={(key) => {
              setRange(key);
              clearCustomRange();
            }}
          />

          {/* 👈 Replaced DatePill with custom DatePicker */}
          <div className="flex items-center gap-2 md:ml-auto">
            <Calendar size={13} className="hidden shrink-0 text-primary md:block" />
            <DatePicker 
              value={customFrom} 
              onChange={setCustomFrom} 
              placeholder="From" 
            />
            <span className="text-[10px] text-textLight md:text-xs">to</span>
            <DatePicker 
              value={customTo} 
              onChange={setCustomTo} 
              placeholder="To" 
            />
            {(customFrom || customTo) && (
              <button
                onClick={clearCustomRange}
                className="ml-1 shrink-0 text-[10px] font-bold text-primary hover:underline"
              >
                CLEAR
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table / Cards */}
      {loading ? (
        <SkeletonTable rows={6} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={hasFilters ? 'No matching records' : 'No attendance records yet'}
          description={
            hasFilters
              ? 'Try adjusting the filters or search term.'
              : 'Records will appear here as employees start timing in.'
          }
        />
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
// Employee picker
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