import { NavLink } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../core/hooks/useAuth';
import { NAV_ITEMS } from '../navigation';

export default function Sidebar({ variant = 'desktop' }) {
  const { signOut } = useAuth();
  const isDrawer = variant === 'drawer';

  return (
    <aside
      className={`bg-white border-r border-border flex-col shrink-0 h-full ${
        isDrawer
          ? 'flex w-72 px-3 py-5'
          : 'hidden md:flex w-64 px-3 py-5'
      }`}
    >
      {/* ─── Logo ─── */}
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-bold text-base shadow-brand shrink-0">
          MB
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-textDark leading-tight truncate">
            Media Box
          </p>
          <p className="text-[10px] font-semibold tracking-[0.14em] text-textLight uppercase mt-0.5">
            Admin
          </p>
        </div>
      </div>

      {/* ─── Section label ─── */}
      <p className="px-3 mb-2 text-[10px] font-bold tracking-[0.14em] text-textFaint uppercase">
        Menu
      </p>

      {/* ─── Nav ─── */}
      <nav className="flex-1 flex flex-col gap-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-[13px] font-semibold ${
                isActive
                  ? 'bg-gradient-to-br from-primary to-primary-dark text-white shadow-md shadow-primary/25'
                  : 'text-textMedium hover:bg-primary-light/30 hover:text-textDark'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white/40 rounded-r-full" />
                )}
                <item.icon
                  size={17}
                  strokeWidth={isActive ? 2.4 : 2}
                  className="shrink-0"
                />
                <span className="truncate">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ─── Sign out ─── */}
      <div className="mt-4 pt-4 border-t border-border/60">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-[13px] font-semibold text-textMedium hover:bg-redLight hover:text-red transition"
        >
          <LogOut size={17} strokeWidth={2} className="shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}