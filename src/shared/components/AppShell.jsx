import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, X, MoreHorizontal } from 'lucide-react';
import Sidebar from './Sidebar';
import { NAV_ITEMS, MOBILE_PRIMARY_ITEMS } from '../navigation';

export default function AppShell() {
  const location = useLocation();
  const [key, setKey] = useState(location.pathname);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setKey(location.pathname);
  }, [location.pathname]);

  // Auto-close drawer on navigation
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  // Check whether the current route is one of the primary mobile items
  const isPrimaryMobileRoute = MOBILE_PRIMARY_ITEMS.some(
    (i) => location.pathname === i.to || location.pathname.startsWith(i.to + '/')
  );

  return (
    <div className="min-h-screen bg-bg flex">
      {/* ─── Desktop sidebar (md and up) ─── */}
      <div className="hidden md:flex">
        <Sidebar variant="desktop" />
      </div>

      {/* ─── Mobile drawer (opened via hamburger or More) ─── */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className="fixed top-0 left-0 bottom-0 z-50 md:hidden animate-[slideInRight_240ms_ease-out]"
            style={{ width: 'min(18rem, 85vw)' }}
          >
            <Sidebar variant="drawer" />
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute top-4 right-3 w-9 h-9 rounded-full bg-white border border-border shadow-md flex items-center justify-center text-textDark z-10"
              aria-label="Close menu"
            >
              <X size={16} />
            </button>
          </div>
        </>
      )}

      <main className="flex-1 min-w-0 overflow-x-hidden flex flex-col">
        {/* ─── Mobile top bar ─── */}
        <div className="md:hidden sticky top-0 z-30 bg-bg/90 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setDrawerOpen(true)}
              className="w-10 h-10 rounded-xl border border-border bg-white flex items-center justify-center text-textDark shrink-0"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                MB
              </div>
              <span className="text-sm font-bold text-textDark truncate">
                Media Box Admin
              </span>
            </div>
          </div>
        </div>

        {/* ─── Content (bottom padding so mobile nav doesn't cover it) ─── */}
        <div className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 pb-24 md:pb-6">
          <div key={key} className="animate-page-enter">
            <Outlet />
          </div>
        </div>
      </main>

      {/* ─── Mobile bottom navigation ─── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur border-t border-border">
        <div className="grid grid-cols-5 h-16">
          {MOBILE_PRIMARY_ITEMS.map((item) => {
            const isActive =
              location.pathname === item.to ||
              location.pathname.startsWith(item.to + '/');
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex flex-col items-center justify-center gap-0.5 transition"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
                    isActive
                      ? 'bg-gradient-to-br from-primary to-primary-dark text-white shadow-md shadow-primary/30'
                      : 'text-textLight'
                  }`}
                >
                  <item.icon size={18} strokeWidth={2} />
                </div>
                <span
                  className={`text-[10px] font-semibold ${
                    isActive ? 'text-primary' : 'text-textLight'
                  }`}
                >
                  {item.shortLabel}
                </span>
              </NavLink>
            );
          })}

          {/* More button — highlights when the current route is NOT a primary item */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 transition"
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
                !isPrimaryMobileRoute
                  ? 'bg-gradient-to-br from-primary to-primary-dark text-white shadow-md shadow-primary/30'
                  : 'text-textLight'
              }`}
            >
              <MoreHorizontal size={18} strokeWidth={2} />
            </div>
            <span
              className={`text-[10px] font-semibold ${
                !isPrimaryMobileRoute ? 'text-primary' : 'text-textLight'
              }`}
            >
              More
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
}