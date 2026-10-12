import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';

export default function AppShell() {
  const location = useLocation();
  const [key, setKey] = useState(location.pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Remount content on route change
  useEffect(() => {
    setKey(location.pathname);
  }, [location.pathname]);

  // Auto-close the mobile drawer on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Lock body scroll when the drawer is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen bg-bg flex">
      {/* ─── Desktop sidebar (md and up) ─── */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* ─── Mobile drawer ─── */}
      {sidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <div className="fixed top-0 left-0 bottom-0 z-50 w-72 max-w-[85vw] md:hidden animate-[slideInRight_240ms_ease-out]">
            <Sidebar />
            {/* Close button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white border border-border shadow-md flex items-center justify-center text-textDark"
              aria-label="Close menu"
            >
              <X size={16} />
            </button>
          </div>
        </>
      )}

      <main className="flex-1 min-w-0 overflow-x-hidden">
        {/* ─── Mobile top bar (hamburger) ─── */}
        <div className="md:hidden sticky top-0 z-30 bg-bg/90 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-10 h-10 rounded-xl border border-border bg-white flex items-center justify-center text-textDark"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-bold text-xs">
              MB
            </div>
            <span className="text-sm font-bold text-textDark">Media Box Admin</span>
          </div>
        </div>

        {/* ─── Content ─── */}
        <div className="max-w-7xl mx-auto p-4 md:p-6">
          <div key={key} className="animate-page-enter">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}