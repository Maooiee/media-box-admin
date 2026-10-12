import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, QrCode, Camera, ClipboardList, CheckSquare, Users, Calendar, Wallet, LogOut,
} from 'lucide-react';
import { useAuth } from '../../core/hooks/useAuth';

const NAV_ITEMS = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/qr',         icon: QrCode,          label: 'QR Code' },
  { to: '/attendance', icon: Camera,          label: 'Selfies' },
  { to: '/records',    icon: ClipboardList,   label: 'Attendance' },
  { to: '/tasks',      icon: CheckSquare,     label: 'Tasks' },
  { to: '/shifts',     icon: Calendar,        label: 'Shifts' },
  { to: '/employees',  icon: Users,           label: 'Employees' },
  { to: '/payroll',    icon: Wallet,          label: 'Payroll' },
];

export default function Sidebar() {
  const { signOut } = useAuth();

  return (
    <aside className="w-[72px] bg-white border-r border-border flex flex-col items-center py-5 gap-2 shrink-0">
      <div className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center text-white font-bold text-lg mb-3">
        A
      </div>

      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          title={item.label}
          className={({ isActive }) =>
            `w-11 h-11 rounded-xl flex items-center justify-center transition ${
              isActive
                ? 'bg-primary text-white shadow-sm'
                : 'text-textLight hover:bg-bg hover:text-textDark'
            }`
          }
        >
          <item.icon size={20} strokeWidth={2} />
        </NavLink>
      ))}

      <div className="flex-1" />

      <button
        onClick={signOut}
        title="Sign Out"
        className="w-11 h-11 rounded-xl flex items-center justify-center text-textLight hover:bg-red-50 hover:text-red-600 transition"
      >
        <LogOut size={20} strokeWidth={2} />
      </button>
    </aside>
  );
}