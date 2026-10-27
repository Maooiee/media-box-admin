import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Mail, Briefcase, BadgeCheck,
  CheckCircle2, Clock, XCircle, Timer, ClipboardList, CalendarDays, Inbox,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { supabase } from '../../../core/config/supabase';
import {
  daysAgoManila,
  formatTime,
  toManilaDate,
} from '../../../core/utils/formatters';
import SegmentedTabs from '../../../shared/components/SegmentedTabs';
import EmptyState from '../../../shared/components/EmptyState';
import { Skeleton, SkeletonStats } from '../../../shared/components/Skeleton';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function localDateStr(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('attendance');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const { data: emp } = await supabase.from('profiles').select('*').eq('id', id).single();
      setEmployee(emp);

      const { data: att } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', id)
        .gte('date', daysAgoManila(30))
        .order('date', { ascending: false });
      setAttendance(att || []);

      const { data: tk } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', id)
        .order('created_at', { ascending: false });
      setTasks(tk || []);

      const { data: sh } = await supabase.from('shifts').select('*').eq('user_id', id);
      setShifts(sh || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const present = attendance.filter((a) => a.status === 'present').length;
  const late = attendance.filter((a) => a.status === 'late').length;
  const absent = attendance.filter((a) => a.status === 'absent').length;
  const totalHours =
    attendance.reduce((acc, curr) => {
      if (curr.time_in && curr.time_out) {
        const ms = new Date(curr.time_out) - new Date(curr.time_in);
        return acc + (ms > 0 ? ms : 0);
      }
      return acc;
    }, 0) / 3600000;
  const activeTasks = tasks.filter((t) => t.status !== 'done').length;

  const calendarCells = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();

    const out = [];
    for (let i = startWeekday - 1; i >= 0; i--) {
      out.push({ date: new Date(year, month - 1, daysInPrev - i), muted: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ date: new Date(year, month, d), muted: false });
    }
    const remaining = (7 - (out.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      out.push({ date: new Date(year, month + 1, i), muted: true });
    }
    return out;
  }, [currentMonth]);

  if (loading || !employee) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 pb-12 md:space-y-5">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-36 w-full md:h-40" rounded="rounded-2xl" />
        <SkeletonStats count={4} />
        <Skeleton className="h-11 w-full md:w-96" rounded="rounded-full" />
        <Skeleton className="h-72 w-full" rounded="rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4 md:space-y-5 pb-12">
      <button
        onClick={() => navigate('/employees')}
        className="inline-flex items-center gap-2 text-sm font-semibold text-textMedium hover:text-primary transition"
      >
        <ArrowLeft size={16} /> Back to Employees
      </button>

      {/* ─── Header (Matches PageHeader aesthetic) ─── */}
      <div className="rounded-2xl bg-gradient-to-br from-primary-light/70 via-primary-light/25 to-transparent border border-primary/10 shadow-card p-5 md:p-6 relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full opacity-60"
          style={{
            background: 'radial-gradient(circle, rgba(242,106,27,0.18) 0%, rgba(242,106,27,0) 70%)',
          }}
        />

        <div className="relative flex flex-col md:flex-row items-center md:items-start gap-5 md:gap-6">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-4xl md:text-5xl font-bold text-white shadow-brand shrink-0 ring-4 ring-white/50">
            {employee.full_name?.charAt(0) || '?'}
          </div>

          <div className="flex-1 text-center md:text-left min-w-0 pt-1">
            <div className="flex items-center justify-center md:justify-start gap-1.5 md:gap-2 mb-1.5">
              <span className="text-[10px] font-bold tracking-[0.18em] text-primary uppercase">
                Media Box
              </span>
              <span className="w-1 h-1 rounded-full bg-textFaint" />
              <span className="text-[10px] font-bold tracking-[0.18em] text-textLight uppercase">
                Team Profile
              </span>
            </div>

            <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold text-textDark tracking-tight truncate">
                {employee.full_name}
              </h1>
              {employee.is_admin && (
                <span className="text-[10px] bg-gradient-to-br from-primary to-primary-dark text-white px-2.5 py-1 rounded-full font-bold uppercase tracking-wide shadow-sm">
                  Admin
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-5 gap-y-2 mt-3 text-sm font-medium text-textMedium">
              <span className="flex items-center gap-1.5">
                <Briefcase size={15} className="text-primary/70" /> {employee.position || 'No role'}
              </span>
              <span className="flex items-center gap-1.5">
                <BadgeCheck size={15} className="text-primary/70" /> {employee.employee_id}
              </span>
              <span className="flex items-center gap-1.5">
                <Mail size={15} className="text-primary/70" /> {employee.email}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Stats Row ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Present" value={present} icon={CheckCircle2} tone="good" />
        <StatCard label="Late" value={late} icon={Clock} tone="warn" />
        <StatCard label="Absent" value={absent} icon={XCircle} tone="bad" />
        <StatCard label="Total Hours" value={`${totalHours.toFixed(1)}h`} icon={Timer} tone="brand" />
      </div>

      {/* ─── Segmented Tabs ─── */}
      <SegmentedTabs
        full
        value={tab}
        onChange={setTab}
        items={[
          { key: 'attendance', label: 'Attendance', icon: Clock, count: attendance.length },
          { key: 'tasks', label: 'Tasks', icon: ClipboardList, count: activeTasks },
          { key: 'schedule', label: 'Schedule', icon: CalendarDays },
        ]}
        className="md:w-auto md:flex-none"
      />

      {/* ─── Tab Content ─── */}
      <div className="surface-card min-h-[400px] overflow-hidden">
        
        {/* Attendance */}
        {tab === 'attendance' && (
          attendance.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No attendance records yet."
              description="Data will appear here once available."
            />
          ) : (
            <div className="divide-y divide-border/60">
              {attendance.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-4 md:p-5 hover:bg-bg/40 transition"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-bg to-border/30 flex flex-col items-center justify-center shrink-0 border border-border/50">
                      <span className="text-[10px] font-bold uppercase text-textLight leading-none mb-0.5">
                        {new Date(a.date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short' })}
                      </span>
                      <span className="text-lg font-bold text-textDark leading-none">
                        {new Date(a.date + 'T00:00:00').getDate()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm md:text-base font-bold text-textDark truncate">
                        {localDateStr(a.date)}
                      </p>
                      <p className="text-xs md:text-sm text-textMedium font-medium mt-0.5">
                        In: {a.time_in ? formatTime(a.time_in) : '--'} <span className="text-border mx-1">|</span> Out: {a.time_out ? formatTime(a.time_out) : '--'}
                      </p>
                    </div>
                  </div>
                  <StatusPill status={a.status} />
                </div>
              ))}
            </div>
          )
        )}

        {/* Tasks */}
        {tab === 'tasks' && (
          tasks.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No tasks assigned."
              description="Data will appear here once available."
            />
          ) : (
            <div className="divide-y divide-border/60">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-4 p-4 md:p-5 hover:bg-bg/40 transition"
                >
                  <div className="min-w-0">
                    <p className="text-sm md:text-base font-bold text-textDark truncate">{t.title}</p>
                    <p className="text-xs md:text-sm text-textLight font-medium mt-0.5">
                      Due: {t.due_date || 'No due date'}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg bg-bg border border-border shrink-0">
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          )
        )}

        {/* Schedule */}
        {tab === 'schedule' && (
          <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white shadow-sm shadow-primary/30">
                  <CalendarDays size={14} />
                </div>
                <h3 className="text-lg font-bold text-textDark">
                  {currentMonth.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}
                </h3>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                  className="w-9 h-9 rounded-xl border border-border bg-white flex items-center justify-center hover:border-primary/40 hover:bg-primary-light/20 hover:text-primary transition shadow-sm"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                  className="w-9 h-9 rounded-xl border border-border bg-white flex items-center justify-center hover:border-primary/40 hover:bg-primary-light/20 hover:text-primary transition shadow-sm"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {/* Gradient Calendar Container */}
            <div className="border border-border rounded-2xl overflow-hidden shadow-sm bg-gradient-to-br from-white via-white to-primary-light/10">
              
              {/* Weekday Header with Gradient */}
              <div className="grid grid-cols-7 bg-gradient-to-r from-primary-light/40 via-primary-light/20 to-primary-light/10 border-b border-border">
                {WEEKDAYS.map((d, i) => (
                  <div key={d} className={`py-2.5 text-center text-[10px] font-bold uppercase tracking-wider ${i === 0 || i === 6 ? 'text-primary/70' : 'text-textLight'}`}>
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {calendarCells.map((cell, i) => {
                  const key = dateKey(cell.date);
                  const shift = shifts.find((s) => s.shift_date === key);
                  const isToday = key === toManilaDate();
                  const isWeekend = cell.date.getDay() === 0 || cell.date.getDay() === 6;

                  return (
                    <div
                      key={i}
                      className={`relative min-h-[70px] md:min-h-[100px] p-2 border-r border-b border-border flex flex-col transition-colors ${
                        cell.muted 
                          ? 'bg-bg/30 text-textFaint' 
                          : isWeekend 
                          ? 'bg-primary-light/15' 
                          : 'bg-white hover:bg-bg/30'
                      } ${isToday ? 'bg-primary-light/30 ring-2 ring-primary/30 ring-inset z-10' : ''}`}
                    >
                      <span
                        className={`text-xs font-bold ${
                          isToday
                            ? 'bg-gradient-to-br from-primary to-primary-dark text-white w-6 h-6 rounded-full flex items-center justify-center shadow-md shadow-primary/30'
                            : cell.muted 
                            ? 'text-textFaint' 
                            : 'text-textDark'
                        }`}
                      >
                        {cell.date.getDate()}
                      </span>
                      
                      {shift && (
                        <div
                          className={`mt-auto px-1.5 py-1 rounded-md text-[9px] md:text-[10px] font-bold truncate border shadow-sm ${
                            shift.kind === 'opening'
                              ? 'bg-amber-100 text-amber-900 border-amber-200'
                              : 'bg-blue-100 text-blue-900 border-blue-200'
                          }`}
                        >
                          {shift.name}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Reusable sub-components ─── */

function StatCard({ label, value, icon: Icon, tone }) {
  const tones = {
    good: 'bg-gradient-to-br from-[#F0F8F4] to-white border-green/20 text-green',
    warn: 'bg-gradient-to-br from-[#FEF9E8] to-white border-yellow/20 text-yellow',
    bad: 'bg-gradient-to-br from-[#FDF2F2] to-white border-red/20 text-red',
    brand: 'bg-gradient-to-br from-[#FFF9F5] to-white border-primary/20 text-primary',
  };
  const iconTones = {
    good: 'bg-white shadow-sm text-green',
    warn: 'bg-white shadow-sm text-yellow',
    bad: 'bg-white shadow-sm text-red',
    brand: 'bg-white shadow-sm text-primary',
  };
  return (
    <div className={`flex flex-col justify-between rounded-2xl border p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover ${tones[tone]}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${iconTones[tone]}`}>
        <Icon size={16} />
      </div>
      <div>
        <p className="text-2xl font-extrabold leading-tight text-textDark">{value}</p>
        <p className="text-[10px] md:text-[11px] font-bold tracking-wide uppercase opacity-70 mt-1">
          {label}
        </p>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const styles = {
    present: 'bg-greenLight text-green border-green/20',
    late: 'bg-yellowLight text-yellow border-yellow/20',
    absent: 'bg-redLight text-red border-red/20',
    on_leave: 'bg-blueLight text-blue border-blue/20',
  };
  return (
    <span
      className={`text-[10px] md:text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border shrink-0 whitespace-nowrap ${
        styles[status] || styles.absent
      }`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}

// ─── End of employee detail helpers ───