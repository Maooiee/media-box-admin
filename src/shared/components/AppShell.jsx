import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';
import { useScrollReveal } from '../../core/hooks/useScrollReveal'; // 👈 1. IMPORT HOOK

export default function AppShell() {
  const location = useLocation();
  const [key, setKey] = useState(location.pathname);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 👈 2. INITIALIZE HOOK HERE
  useScrollReveal(); 

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

  return (
    <div className="flex min-h-screen w-full bg-bg">
      {/* ─── Desktop sidebar ─── */}
      <Sidebar variant="desktop" />

      {/* ─── Mobile drawer ─── */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className="fixed top-0 left-0 bottom-0 z-50 md:hidden animate-[slideInLeft_240ms_ease-out] shadow-2xl"
            style={{ width: 'min(18rem, 85vw)' }}
          >
            <Sidebar variant="drawer" />
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute top-4 right-3 w-9 h-9 rounded-full bg-white border border-border shadow-md flex items-center justify-center text-textDark z-10 hover:bg-bg transition"
              aria-label="Close menu"
            >
              <X size={16} />
            </button>
          </div>
        </>
      )}

      <main className="flex-1 min-w-0 flex flex-col relative">
        {/* ─── Mobile top bar ─── */}
        <div className="md:hidden sticky top-0 z-30 bg-gradient-to-br from-primary-light/60 via-white to-white border-b border-primary/15 backdrop-blur-md px-3 py-3 flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-10 h-10 rounded-xl border border-border bg-white flex items-center justify-center text-textDark shrink-0 hover:bg-primary-light/20 hover:border-primary/30 transition shadow-sm"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>

          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-primary rounded-xl blur-sm opacity-30" />
              <div className="relative w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-md shadow-primary/30 ring-1 ring-black/5 overflow-hidden p-1.5">
                {/* 👈 Updated to MB.png */}
                <img src="/MB.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-textDark leading-tight truncate tracking-tight">
                Media Box
              </p>
              <p className="text-[9px] font-bold tracking-[0.14em] text-primary/80 uppercase">
                Admin
              </p>
            </div>
          </div>
        </div>

        {/* ─── Content ─── */}
        <div className="flex-1 w-full p-3 md:p-6 pb-12">
          {/* 👈 3. key={key} triggers the hook to re-run on every page change */}
          <div key={key} className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}