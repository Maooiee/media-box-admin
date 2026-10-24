import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LogOut, Sparkles, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '../../core/hooks/useAuth';
import { NAV_ITEMS } from '../navigation';

// Floating glassmorphic sidebar.
//   variant='desktop' → sticky rounded glass panel with a collapse toggle
//   variant='drawer'  → slide-in glass sheet for mobile (never collapses)
export default function Sidebar({ variant = 'desktop' }) {
  const { signOut } = useAuth();
  const isDrawer = variant === 'drawer';
  const [collapsed, setCollapsed] = useState(false);
  const isCollapsed = !isDrawer && collapsed;

  return (
    <aside
      className={`bg-white/70 backdrop-blur-xl flex-col shrink-0 relative overflow-hidden transition-[width] duration-300 ease-out ${
        isDrawer
          ? 'flex w-72 h-full px-3 py-5 rounded-r-[28px] shadow-[-8px_0_40px_-12px_rgba(31,41,55,0.25)]'
          : `hidden md:flex h-[calc(100vh-1.5rem)] m-3 sticky top-3 px-3 py-5 rounded-[26px] border border-white/70 shadow-[0_10px_44px_-16px_rgba(31,41,55,0.22)] ${
              isCollapsed ? 'w-[86px]' : 'w-64'
            }`
      }`}
    >
      {/* ─── Glass top reflection line ─── */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />

      {/* ─── Soft ambient glow at top ─── */}
      <div
        className="pointer-events-none absolute -top-24 -left-16 w-64 h-64 rounded-full animate-[glowPulse_5s_ease-in-out_infinite]"
        style={{ background: 'radial-gradient(circle, rgba(242,106,27,0.22) 0%, rgba(242,106,27,0) 70%)' }}
      />

      {/* ─── Logo block + collapse toggle ─── */}
      <div className="relative mb-5">
        <div className={`flex items-center px-2 ${isCollapsed ? 'flex-col gap-2' : 'gap-3'}`}>
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-primary rounded-2xl blur-md opacity-30" />
            <div className="relative w-11 h-11 rounded-2xl bg-white flex items-center justify-center shadow-lg shadow-primary/25 ring-1 ring-black/5 overflow-hidden p-1.5">
              <img src="/MB.png" alt="Media Box Logo" className="w-full h-full object-contain" />
            </div>
          </div>

          {!isCollapsed && (
            <div className="min-w-0 flex-1 pr-7">
              <p className="text-sm font-bold text-textDark leading-tight truncate tracking-tight">
                Media Box
              </p>
              <p className="text-[10px] font-bold tracking-[0.16em] text-primary/80 uppercase mt-0.5 flex items-center gap-1">
                <Sparkles size={9} /> Admin
              </p>
            </div>
          )}
        </div>

        {/* Collapse toggle — desktop only */}
        {!isDrawer && (
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand' : 'Collapse'}
            className={`w-7 h-7 rounded-lg bg-white/80 border border-border text-textLight hover:text-primary hover:border-primary/40 hover:bg-white flex items-center justify-center transition shadow-sm ${
              isCollapsed ? 'mx-auto mt-3' : 'absolute right-2 top-1/2 -translate-y-1/2'
            }`}
          >
            {isCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          </button>
        )}
      </div>

      {/* ─── Section label ─── */}
      <div className="relative px-3 mb-2 flex items-center gap-2">
        {!isCollapsed && (
          <p className="text-[10px] font-bold tracking-[0.16em] text-textFaint uppercase">Menu</p>
        )}
        <span className="flex-1 h-px bg-border/70" />
      </div>

      {/* ─── Nav ─── */}
      <nav className="relative flex-1 flex flex-col gap-1 overflow-y-auto pb-2 hide-scrollbar">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={isCollapsed ? item.label : undefined}
            className={({ isActive }) =>
              `group relative flex items-center rounded-2xl transition-all duration-200 text-[13px] font-semibold ${
                isCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
              } ${
                isActive
                  ? 'bg-gradient-to-br from-primary to-primary-dark text-white shadow-lg shadow-primary/30'
                  : 'text-textMedium hover:bg-white hover:text-textDark hover:shadow-sm hover:shadow-primary/10'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-white/70 text-textLight shadow-sm shadow-black/5 group-hover:bg-primary-light group-hover:text-primary'
                  }`}
                >
                  <item.icon size={16} strokeWidth={isActive ? 2.4 : 2} />
                </span>
                {!isCollapsed && <span className="truncate flex-1">{item.label}</span>}
                {!isCollapsed && isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white/80 shrink-0" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ─── Sign out ─── */}
      <div className="relative mt-3 pt-3 border-t border-border/70">
        <button
          onClick={signOut}
          title={isCollapsed ? 'Sign Out' : undefined}
          className={`group flex items-center rounded-2xl w-full text-[13px] font-semibold text-textMedium hover:bg-redLight hover:text-red transition-all ${
            isCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
          }`}
        >
          <span className="w-9 h-9 rounded-xl bg-white/70 text-textLight shadow-sm shadow-black/5 group-hover:bg-red/10 group-hover:text-red flex items-center justify-center shrink-0 transition">
            <LogOut size={16} strokeWidth={2} />
          </span>
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
