import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Briefcase, Calendar, BadgeCheck } from 'lucide-react';
import { employeeDetailRepository } from '../data/employeeDetailRepository';
import { initials } from '../../../core/utils/formatters';
import AttendanceTable from './widgets/AttendanceTable';
import TasksList from './widgets/TasksList';
import EmployeeScheduleTab from './widgets/EmployeeScheduleTab';

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('attendance');

  useEffect(() => { loadAll(); }, [id]);

  async function loadAll() {
    setLoading(true);
    try {
      const [emp, att, tsk] = await Promise.all([
        employeeDetailRepository.fetchEmployee(id),
        employeeDetailRepository.fetchRecentAttendance(id, 30),
        employeeDetailRepository.fetchTasks(id),
      ]);
      setEmployee(emp);
      setAttendance(att);
      setTasks(tsk);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const stats = attendance.reduce(
    (acc, r) => {
      acc.total++;
      if (r.status === 'present') acc.present++;
      else if (r.status === 'late') acc.late++;
      else if (r.status === 'absent') acc.absent++;
      if (r.time_in && r.time_out) {
        const ms = new Date(r.time_out) - new Date(r.time_in);
        if (ms > 0) acc.hoursMs += ms;
      }
      return acc;
    },
    { total: 0, present: 0, late: 0, absent: 0, hoursMs: 0 }
  );

  const hoursWorked = Math.round(stats.hoursMs / 3600000);
  const openTaskCount = tasks.filter((t) => t.status !== 'done').length;
  const doneTaskCount = tasks.filter((t) => t.status === 'done').length;

  if (loading) {
    return <div className="text-center py-20 text-textLight">Loading employee...</div>;
  }

  if (!employee) {
    return (
      <div className="text-center py-20">
        <p className="text-textLight mb-4">Employee not found</p>
        <button
          onClick={() => navigate('/employees')}
          className="bg-primary text-white px-6 py-2 rounded-full font-semibold"
        >
          Back to Employees
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/employees')}
        className="inline-flex items-center gap-2 text-sm font-semibold text-textMedium hover:text-primary transition"
      >
        <ArrowLeft size={16} /> Back to Employees
      </button>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-border">
        <div className="flex items-start gap-5 flex-wrap">
          <div className="w-20 h-20 rounded-2xl bg-primary-light flex items-center justify-center text-primary text-2xl font-bold shrink-0">
            {initials(employee.full_name)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-textDark">{employee.full_name}</h1>
              {employee.is_admin && (
                <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
                  <BadgeCheck size={12} /> Admin
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-4 mt-2 text-sm text-textMedium">
              <span className="inline-flex items-center gap-1.5">
                <Briefcase size={14} /> {employee.position}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Mail size={14} /> {employee.email}
              </span>
              {employee.joined_date && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={14} /> Joined {employee.joined_date}
                </span>
              )}
            </div>

            <p className="text-xs text-textLight mt-2">
              Employee ID: <strong className="text-textMedium">{employee.employee_id}</strong>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <StatTile value={stats.present} label="Present" color="text-green-600" />
          <StatTile value={stats.late} label="Late" color="text-yellow-600" />
          <StatTile value={stats.absent} label="Absent" color="text-red-600" />
          <StatTile value={`${hoursWorked}h`} label="Worked" color="text-primary" />
        </div>
      </div>

      <div className="inline-flex gap-2 bg-white rounded-full p-1 border border-border flex-wrap">
        <button
          onClick={() => setTab('attendance')}
          className={`px-5 py-2 rounded-full text-sm font-semibold transition ${
            tab === 'attendance'
              ? 'bg-primary text-white shadow-sm'
              : 'text-textLight hover:text-textDark'
          }`}
        >
          Attendance ({attendance.length})
        </button>
        <button
          onClick={() => setTab('tasks')}
          className={`px-5 py-2 rounded-full text-sm font-semibold transition ${
            tab === 'tasks'
              ? 'bg-primary text-white shadow-sm'
              : 'text-textLight hover:text-textDark'
          }`}
        >
          Tasks ({openTaskCount} open · {doneTaskCount} done)
        </button>
        <button
          onClick={() => setTab('schedule')}
          className={`px-5 py-2 rounded-full text-sm font-semibold transition ${
            tab === 'schedule'
              ? 'bg-primary text-white shadow-sm'
              : 'text-textLight hover:text-textDark'
          }`}
        >
          Schedule
        </button>
      </div>

      {tab === 'attendance' && (
        <AttendanceTable records={attendance} onChanged={loadAll} />
      )}

      {tab === 'tasks' && <TasksList tasks={tasks} />}

      {tab === 'schedule' && employee && (
        <EmployeeScheduleTab employee={employee} />
      )}
    </div>
  );
}

function StatTile({ value, label, color }) {
  return (
    <div className="bg-bg rounded-2xl p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs font-semibold text-textLight mt-1">{label}</p>
    </div>
  );
}