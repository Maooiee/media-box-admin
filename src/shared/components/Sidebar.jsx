import { NavLink } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../core/hooks/useAuth';
import { NAV_ITEMS } from '../navigation';

export default function Sidebar({ variant = 'desktop' }) {
  const { signOut } = useAuth();
  const isDrawer = variant === 'drawer';

  return (
    <aside
      className={`bg-white border-r border-border flex flex-col shrink-0 h-full ${
        isDrawer ? 'w-72 px-3 py-5' : 'w-64 px-3 py-5'
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 mb-6 ${isDrawer ? 'pl-1' : 'pl-1'}`}>
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-bold text-base shadow-brand">
          MB
        </div>
        <div>
          <p className="text-sm font-bold text-textDark leading-tight">Media Box</p>
          <p className="text-[10px] font-semibold tracking-wider text-textLight uppercase">
            Admin
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-sm font-semibold ${
                isActive
                  ? 'bg-gradient-to-br from-primary to-primary-dark text-white shadow-md shadow-primary/25'
                  : 'text-textMedium hover:bg-primary-light/40 hover:text-textDark'
              }`
            }
          >
            <item.icon size={18} strokeWidth={2} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Sign out */}
      <button
        onClick={signOut}
        className="mt-4 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-textMedium hover:bg-redLight hover:text-red transition"
      >
        <LogOut size={18} strokeWidth={2} />
        <span>Sign Out</span>
      </button>
    </aside>
  );
}