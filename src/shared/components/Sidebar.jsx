import { NavLink } from 'react-router-dom';
import { LogOut, Sparkles } from 'lucide-react';
import { useAuth } from '../../core/hooks/useAuth';
import { NAV_ITEMS } from '../navigation';

export default function Sidebar({ variant = 'desktop' }) {
  const { signOut } = useAuth();
  const isDrawer = variant === 'drawer';

  return (
    <aside
      className={`bg-white flex-col shrink-0 relative overflow-hidden ${
        isDrawer
          ? 'flex w-72 h-full px-3 py-5'
          : 'hidden md:flex w-64 h-screen sticky top-0 px-3 py-5 border-r border-border'
      }`}
    >
      {/* ─── Soft ambient glow at top ─── */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-56 opacity-70"
        style={{
          background:
            'radial-gradient(circle at 30% 0%, rgba(242,106,27,0.16) 0%, rgba(242,106,27,0) 70%)',
        }}
      />

      {/* ─── Logo block ─── */}
      <div className="relative flex items-center gap-3 mb-6 px-2">
        <div className="relative shrink-0">
          <div className="absolute inset-0 bg-primary rounded-2xl blur-md opacity-30" />
          
          {/* Image Logo pointing to /MB.png */}
          <div className="relative w-11 h-11 rounded-2xl bg-white flex items-center justify-center shadow-lg shadow-primary/25 ring-1 ring-black/5 overflow-hidden p-1.5">
            <img 
              src="/MB.png" 
              alt="Media Box Logo" 
              className="w-full h-full object-contain"
            />
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-textDark leading-tight truncate tracking-tight">
            Media Box
          </p>
          <p className="text-[10px] font-bold tracking-[0.16em] text-primary/80 uppercase mt-0.5 flex items-center gap-1">
            <Sparkles size={9} /> Admin
          </p>
        </div>
      </div>

      {/* ─── Section label ─── */}
      <div className="relative px-3 mb-2 flex items-center gap-2">
        <p className="text-[10px] font-bold tracking-[0.16em] text-textFaint uppercase">
          Menu
        </p>
        <span className="flex-1 h-px bg-border/60" />
      </div>

      {/* ─── Nav ─── */}
      <nav className="relative flex-1 flex flex-col gap-1 overflow-y-auto pb-2 hide-scrollbar">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-[13px] font-semibold ${
                isActive
                  ? 'bg-gradient-to-br from-primary to-primary-dark text-white shadow-md shadow-primary/30'
                  : 'text-textMedium hover:bg-primary-light/40 hover:text-textDark hover:translate-x-0.5'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full shadow-sm shadow-primary/40" />
                )}
                <span
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-bg text-textLight group-hover:bg-primary-light/60 group-hover:text-primary'
                  }`}
                >
                  <item.icon size={15} strokeWidth={isActive ? 2.4 : 2} />
                </span>
                <span className="truncate flex-1">{item.label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white/80 shrink-0" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ─── Sign out ─── */}
      <div className="relative mt-3 pt-3 border-t border-border/60">
        <button
          onClick={signOut}
          className="group flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-[13px] font-semibold text-textMedium hover:bg-redLight hover:text-red transition-all"
        >
          <span className="w-8 h-8 rounded-lg bg-bg text-textLight group-hover:bg-red/10 group-hover:text-red flex items-center justify-center shrink-0 transition">
            <LogOut size={15} strokeWidth={2} />
          </span>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}