import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, Mail, Briefcase, Calendar, BadgeCheck,
  Plus, Search, Edit3, Power, Users,
} from 'lucide-react';
import { employeesRepository } from '../data/employeesRepository';
import { createEmployee } from '../domain/Employee';
import { initials } from '../../../core/utils/formatters';
import { supabase } from '../../../core/config/supabase';
import PageHeader from '../../../shared/components/PageHeader';
import AddEmployeeModal from './widgets/AddEmployeeModal';
import EditEmployeeModal from './widgets/EditEmployeeModal';

const FILTERS = [
  { key: 'all',      label: 'All' },
  { key: 'active',   label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'admins',   label: 'Admins' },
];

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const raw = await employeesRepository.fetchAll();
      setEmployees(raw.map(createEmployee));

      const since = new Date();
      since.setDate(since.getDate() - 30);
      const sinceStr = since.toISOString().slice(0, 10);

      const { data: records, error } = await supabase
        .from('attendance_records')
        .select('user_id, status')
        .gte('date', sinceStr);

      if (!error && records) {
        const grouped = {};
        for (const r of records) {
          if (!grouped[r.user_id]) {
            grouped[r.user_id] = { present: 0, late: 0, absent: 0 };
          }
          if (r.status === 'present') grouped[r.user_id].present++;
          else if (r.status === 'late') grouped[r.user_id].late++;
          else if (r.status === 'absent') grouped[r.user_id].absent++;
        }
        setStats(grouped);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const visible = useMemo(() => {
    let list = employees;
    if (filter === 'active')   list = list.filter((e) => e.isActive);
    if (filter === 'inactive') list = list.filter((e) => !e.isActive);
    if (filter === 'admins')   list = list.filter((e) => e.isAdmin);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (e) =>
          e.fullName?.toLowerCase().includes(q) ||
          e.employeeId?.toLowerCase().includes(q) ||
          e.email?.toLowerCase().includes(q) ||
          e.position?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [employees, search, filter]);

  const counts = useMemo(() => ({
    all:      employees.length,
    active:   employees.filter((e) => e.isActive).length,
    inactive: employees.filter((e) => !e.isActive).length,
    admins:   employees.filter((e) => e.isAdmin).length,
  }), [employees]);

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2600);
  }

  async function handleToggleActive(e) {
    try {
      await employeesRepository.toggleActive(e.id, !e.isActive);
      showToast(e.isActive ? 'Employee deactivated' : 'Employee reactivated');
      await loadAll();
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    }
  }

  return (
    <div className="space-y-3 md:space-y-6">
      {/* Header */}
      <PageHeader
        section="Team"
        title="Employees"
        subtitle={`${employees.length} team member${employees.length === 1 ? '' : 's'}`}
        icon={Users}
        action={
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2 md:py-2.5 rounded-full bg-gradient-to-br from-primary to-primary-dark text-white font-semibold text-xs md:text-sm shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 transition-all"
          >
            <Plus size={14} className="md:hidden" />
            <Plus size={16} className="hidden md:block" />
            <span className="whitespace-nowrap">Add Employee</span>
          </button>
        }
      />

      {/* Search & filters */}
      <div className="rounded-2xl bg-gradient-to-r from-white via-white to-primary-light/20 border border-border shadow-card p-2.5 md:p-3 space-y-2.5 md:space-y-0 md:flex md:flex-row md:gap-3 md:items-center">
        {/* Search — full width on mobile */}
        <div className="flex items-center gap-2 px-3 py-2 md:py-2 rounded-xl border border-border bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 transition md:flex-1">
          <Search size={14} className="text-textLight shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employees…"
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

        {/* Filter chips — horizontal scroll on mobile */}
        <div className="-mx-2.5 px-2.5 md:mx-0 md:px-0 overflow-x-auto md:overflow-visible">
          <div className="flex gap-1.5 md:gap-2 w-max md:w-auto">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[11px] md:text-xs font-semibold transition whitespace-nowrap ${
                  filter === f.key
                    ? 'bg-gradient-to-br from-primary to-primary-dark text-white shadow-md shadow-primary/30'
                    : 'bg-white text-textMedium border border-border hover:border-primary/40 hover:bg-primary-light/20'
                }`}
              >
                {f.label}
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] md:min-w-[18px] text-center ${
                    filter === f.key ? 'bg-white/25 text-white' : 'bg-bg text-textLight'
                  }`}
                >
                  {counts[f.key]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-20 text-textLight text-sm">Loading...</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-20 text-textLight text-sm">
          {search || filter !== 'all' ? 'No matching employees' : 'No employees yet'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-5">
          {visible.map((e) => {
            const s = stats[e.id] ?? { present: 0, late: 0, absent: 0 };

            return (
              <div
                key={e.id}
                className={`group relative rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-card border transition-all duration-200 flex flex-col overflow-hidden ${
                  e.isActive
                    ? 'bg-gradient-to-br from-primary-light/30 via-white to-white border-border hover:border-primary/40 hover:shadow-card-hover md:hover:-translate-y-0.5'
                    : 'bg-bg border-dashed border-textFaint/40 opacity-70'
                }`}
              >
                {/* Soft radial glow */}
                <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full bg-primary/8 blur-3xl" />

                {/* Edit / toggle actions — always visible on mobile, hover on desktop */}
                <div className="absolute top-2 right-2 md:top-3 md:right-3 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition z-10">
                  <button
                    onClick={(ev) => { ev.stopPropagation(); setEditing(e); }}
                    title="Edit employee"
                    className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-white border border-border hover:bg-bg flex items-center justify-center text-textMedium hover:text-primary transition shadow-sm"
                  >
                    <Edit3 size={12} className="md:hidden" />
                    <Edit3 size={13} className="hidden md:block" />
                  </button>
                  <button
                    onClick={(ev) => { ev.stopPropagation(); handleToggleActive(e); }}
                    title={e.isActive ? 'Deactivate' : 'Reactivate'}
                    className={`w-7 h-7 md:w-8 md:h-8 rounded-full border flex items-center justify-center transition shadow-sm ${
                      e.isActive
                        ? 'bg-white border-border text-textLight hover:text-red hover:border-red/40'
                        : 'bg-greenLight border-green/30 text-green hover:bg-green/15'
                    }`}
                  >
                    <Power size={12} className="md:hidden" />
                    <Power size={13} className="hidden md:block" />
                  </button>
                </div>

                <button
                  onClick={() => navigate(`/employees/${e.id}`)}
                  className="text-left flex flex-col flex-1 relative z-[1]"
                >
                  {/* Avatar */}
                  <div className="flex justify-center mb-3 md:mb-4">
                    <div className="relative">
                      <div
                        className={`w-16 h-16 md:w-24 md:h-24 rounded-full flex items-center justify-center text-xl md:text-3xl font-bold ring-4 ring-white shadow-lg transition ${
                          e.isActive
                            ? 'bg-gradient-to-br from-primary-light via-primary/25 to-primary/40 text-primary'
                            : 'bg-textFaint/20 text-textLight'
                        }`}
                      >
                        {initials(e.fullName)}
                      </div>
                      {e.isAdmin && (
                        <div className="absolute -bottom-0.5 -right-0.5 md:-bottom-1 md:-right-1 w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-primary to-primary-dark rounded-full flex items-center justify-center ring-4 ring-white shadow-md shadow-primary/40">
                          <BadgeCheck size={12} className="md:hidden text-white" />
                          <BadgeCheck size={16} className="hidden md:block text-white" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Name + badges */}
                  <div className="text-center mb-3 md:mb-4">
                    <div className="flex items-center justify-center gap-1.5 md:gap-2 flex-wrap">
                      <h3 className="text-base md:text-lg font-bold text-textDark truncate max-w-full">
                        {e.fullName}
                      </h3>
                      {e.isAdmin && (
                        <span className="text-[9px] md:text-[10px] bg-gradient-to-br from-primary to-primary-dark text-white px-1.5 md:px-2 py-0.5 rounded-full font-bold tracking-wide shadow-sm shadow-primary/30">
                          ADMIN
                        </span>
                      )}
                      {!e.isActive && (
                        <span className="text-[9px] md:text-[10px] bg-textFaint/20 text-textLight px-1.5 md:px-2 py-0.5 rounded-full font-bold tracking-wide">
                          INACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] md:text-xs text-textLight font-semibold mt-0.5 md:mt-1 tracking-wide uppercase">
                      {e.employeeId}
                    </p>
                  </div>

                  {/* Contact info */}
                  <div className="space-y-1.5 md:space-y-2 mb-3 md:mb-5 text-xs md:text-sm">
                    <div className="flex items-center gap-2 text-textMedium">
                      <Briefcase size={12} className="md:hidden text-primary/60 shrink-0" />
                      <Briefcase size={14} className="hidden md:block text-primary/60 shrink-0" />
                      <span className="truncate">{e.position || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-textMedium">
                      <Mail size={12} className="md:hidden text-primary/60 shrink-0" />
                      <Mail size={14} className="hidden md:block text-primary/60 shrink-0" />
                      <span className="truncate">{e.email}</span>
                    </div>
                    {e.joinedDate && (
                      <div className="flex items-center gap-2 text-textMedium">
                        <Calendar size={12} className="md:hidden text-primary/60 shrink-0" />
                        <Calendar size={14} className="hidden md:block text-primary/60 shrink-0" />
                        <span className="truncate">Joined {e.joinedDate}</span>
                      </div>
                    )}
                  </div>

                  {/* Stat chips */}
                  <div className="grid grid-cols-3 gap-1.5 md:gap-2 mb-3 md:mb-4">
                    <StatChip value={s.present} label="Present" color="green" />
                    <StatChip value={s.late} label="Late" color="yellow" />
                    <StatChip value={s.absent} label="Absent" color="red" />
                  </div>

                  {/* Footer */}
                  <div className="mt-auto pt-3 md:pt-4 border-t border-border flex items-center justify-between">
                    <span className="text-[10px] md:text-xs text-textLight">Last 30 days</span>
                    <span className="inline-flex items-center gap-1 text-xs md:text-sm font-semibold text-primary group-hover:gap-2 transition-all">
                      View <span className="hidden md:inline">Profile</span>
                      <ChevronRight size={12} className="md:hidden" />
                      <ChevronRight size={14} className="hidden md:block" />
                    </span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <AddEmployeeModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => {
          showToast('Employee added');
          loadAll();
        }}
      />

      {editing && (
        <EditEmployeeModal
          open={!!editing}
          employee={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            showToast('Employee updated');
            loadAll();
          }}
        />
      )}

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold text-white animate-[slideUp_220ms_ease-out] ${
            toast.type === 'error'
              ? 'bg-gradient-to-br from-red to-red/80'
              : 'bg-gradient-to-br from-green to-green/80'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

function StatChip({ value, label, color }) {
  const colors = {
    green:  'bg-greenLight text-green',
    yellow: 'bg-yellowLight text-yellow',
    red:    'bg-redLight text-red',
  };
  return (
    <div className={`${colors[color]} rounded-lg md:rounded-xl py-2 md:py-2.5 text-center`}>
      <p className="text-sm md:text-lg font-bold leading-none">{value}</p>
      <p className="text-[9px] md:text-[10px] font-semibold mt-0.5 md:mt-1 opacity-80 tracking-wide">
        {label}
      </p>
    </div>
  );
}