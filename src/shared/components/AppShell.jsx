import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';
import { useScrollReveal } from '../../core/hooks/useScrollReveal'; // 👈 1. IMPORT HOOK

export default function AppShell() {
  const location = useLocation();
  const pageKey = location.pathname;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const progressRef = useRef(null);

  // 👈 2. INITIALIZE HOOK HERE
  useScrollReveal(); 

  // Thin scroll-progress line. Updating the transform directly avoids
  // re-rendering the whole shell on every scroll event.
  useEffect(() => {
    const update = () => {
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress =
        scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 0;
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${progress})`;
      }
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const settle = window.setTimeout(update, 350);

    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.clearTimeout(settle);
    };
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
    <div className="relative flex min-h-screen w-full bg-bg">
      {/* Ambient page background — very soft, purely decorative */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-32 -top-40 h-[30rem] w-[30rem] rounded-full bg-primary/[0.07] blur-3xl animate-[floatY_18s_ease-in-out_infinite] will-change-transform" />
        <div className="absolute -left-40 top-1/3 h-[26rem] w-[26rem] rounded-full bg-amber-300/[0.10] blur-3xl animate-[floatYAlt_22s_ease-in-out_infinite] will-change-transform" />
        <div className="absolute -bottom-40 right-1/3 h-80 w-80 rounded-full bg-primary/[0.05] blur-3xl animate-[floatY_26s_ease-in-out_infinite] will-change-transform" />
      </div>

      {/* Scroll progress */}
      <div
        ref={progressRef}
        className="fixed inset-x-0 top-0 z-[70] h-[2px] origin-left scale-x-0 bg-gradient-to-r from-primary via-amber-400 to-primary shadow-[0_0_10px_rgba(242,106,27,0.55)] will-change-transform"
      />

      {/* ─── Desktop sidebar ─── */}
      <Sidebar variant="desktop" />

      {/* ─── Mobile drawer — glass sheet ─── */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-[fadeIn_180ms_ease-out] md:hidden"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className="fixed top-0 left-0 bottom-0 z-50 md:hidden animate-[slideInLeft_240ms_ease-out]"
            style={{ width: 'min(18rem, 85vw)' }}
          >
            <Sidebar variant="drawer" />
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute top-5 right-3 w-9 h-9 rounded-full bg-white/80 backdrop-blur border border-border shadow-md flex items-center justify-center text-textDark z-10 hover:bg-white hover:text-primary hover:rotate-90 transition-all duration-200"
              aria-label="Close menu"
            >
              <X size={16} />
            </button>
          </div>
        </>
      )}

      <main className="flex-1 min-w-0 flex flex-col relative z-10">
        {/* ─── Mobile top bar — glass ─── */}
        <div className="md:hidden sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-white/60 px-3 py-2.5 flex items-center gap-3 shadow-[0_4px_20px_-8px_rgba(31,41,55,0.12)]">
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-10 h-10 rounded-2xl bg-white/80 border border-border flex items-center justify-center text-textDark shrink-0 hover:bg-white hover:border-primary/40 hover:text-primary transition shadow-sm"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>

          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-primary rounded-xl blur-sm opacity-30" />
              <div className="relative w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-md shadow-primary/30 ring-1 ring-black/5 overflow-hidden p-1.5">
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

          <span className="w-1.5 h-1.5 rounded-full bg-green shrink-0 shadow-sm shadow-green/50 animate-[livePulse_2s_ease-out_infinite]" />
        </div>

        {/* ─── Content ─── */}
        <div className="flex-1 w-full p-3 md:p-6 pb-12">
          {/* 👈 3. key={pageKey} triggers the hook to re-run on every page change */}
          {/*
            NOTE: keep this wrapper transform-free. A transform (or
            `will-change: transform`) makes the element a containing block
            for `position: fixed` descendants, which traps page modals and
            their backdrops inside the content column instead of the
            viewport. A fade-only entrance keeps the polish without that bug.
          */}
          <div
            key={pageKey}
            className="max-w-7xl mx-auto animate-[fadeIn_300ms_ease-out]"
          >
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}