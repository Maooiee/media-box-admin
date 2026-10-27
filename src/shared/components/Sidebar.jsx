import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../core/hooks/useAuth';
import { supabase } from '../../core/config/supabase';
import { passwordResetsRepository } from '../../features/passwordResets/data/passwordResetsRepository';
import { NAV_GROUPS, NAV_ITEMS } from '../navigation';
import CommandPalette from './CommandPalette';

const COLLAPSED_KEY = 'sidebar_collapsed';
const GROUPS_KEY = 'sidebar_groups';
const DEFAULT_GROUPS = { scheduling: false, tools: false };

const IS_MAC =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform || '');
const SHORTCUT_LABEL = IS_MAC ? '⌘K' : 'Ctrl K';

function readFlag(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function readGroups() {
  try {
    const raw = localStorage.getItem(GROUPS_KEY);
    if (!raw) return DEFAULT_GROUPS;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return { ...DEFAULT_GROUPS, ...parsed };
    }
  } catch {
    // Storage may be unavailable — fall back to the defaults.
  }
  return DEFAULT_GROUPS;
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Non-fatal: the sidebar still works without persistence.
  }
}

// Floating glassmorphic sidebar.
//   variant='desktop' → sticky rounded glass panel with a collapse toggle
//   variant='drawer'  → slide-in glass sheet for mobile (never collapses)
export default function Sidebar({ variant = 'desktop' }) {
  const { session, signOut } = useAuth();
  const location = useLocation();
  const isDrawer = variant === 'drawer';

  const [collapsed, setCollapsed] = useState(
    () => !isDrawer && readFlag(COLLAPSED_KEY),
  );
  const [openGroups, setOpenGroups] = useState(readGroups);
  const [closedActive, setClosedActive] = useState({});
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pendingResets, setPendingResets] = useState(0);
  const [channelName] = useState(
    () => `sidebar-password-resets-${Math.random().toString(36).slice(2)}`,
  );

  const isCollapsed = !isDrawer && collapsed;
  const email = session?.user?.email || 'admin@mediabox';
  const initial = (email.trim()[0] || 'A').toUpperCase();
  const activeItem = NAV_ITEMS.find(
    (item) =>
      location.pathname === item.to ||
      location.pathname.startsWith(`${item.to}/`),
  );
  const activeGroupId = activeItem?.group;

  useEffect(() => {
    if (!isDrawer) writeStorage(COLLAPSED_KEY, collapsed ? '1' : '0');
  }, [collapsed, isDrawer]);

  useEffect(() => {
    writeStorage(GROUPS_KEY, JSON.stringify(openGroups));
  }, [openGroups]);

  // Ctrl/⌘ + K opens quick find on desktop.
  useEffect(() => {
    if (isDrawer) return undefined;
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDrawer]);

  // Small live badge so new reset requests are impossible to miss.
  useEffect(() => {
    let active = true;

    const refresh = async () => {
      try {
        const count = await passwordResetsRepository.countPending();
        if (active) setPendingResets(count);
      } catch {
        // The table may not exist until the migration runs — ignore silently.
      }
    };

    refresh();

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'password_reset_requests' },
        refresh,
      )
      .subscribe();

    const timer = window.setInterval(refresh, 60000);

    return () => {
      active = false;
      window.clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [channelName]);

  function toggleGroup(groupId) {
    // The group that owns the current page opens automatically. Let the user
    // close it for this page, but don't remember that across navigation.
    if (groupId === activeGroupId) {
      setClosedActive((prev) => ({
        ...prev,
        [groupId]: prev[groupId] === location.pathname ? null : location.pathname,
      }));
      return;
    }
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }

  function renderItem(item, index) {
    return (
      <NavLink
        key={item.to}
        to={item.to}
        title={isCollapsed ? item.label : undefined}
        aria-label={isCollapsed ? item.label : undefined}
        style={{ animationDelay: `${Math.min(index, 8) * 25}ms` }}
        className={({ isActive }) =>
          `group relative flex items-center rounded-xl text-[13px] font-semibold transition-all duration-200 animate-[navItemIn_360ms_ease-out_both] ${
            isCollapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-2.5 py-2'
          } ${
            isActive
              ? 'bg-gradient-to-br from-primary to-primary-dark text-white shadow-md shadow-primary/25'
              : 'text-textMedium hover:bg-white hover:text-textDark hover:shadow-sm hover:shadow-primary/5'
          }`
        }
      >
        {({ isActive }) => (
          <>
            <span
              className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all ${
                isActive
                  ? 'bg-white/15 text-white'
                  : 'bg-transparent text-textLight group-hover:bg-primary-light/50 group-hover:text-primary'
              }`}
            >
              <item.icon
                size={17}
                strokeWidth={isActive ? 2.35 : 1.9}
                className="transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110"
              />
              {isCollapsed &&
                item.to === '/password-resets' &&
                pendingResets > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                )}
            </span>
            {!isCollapsed && (
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            )}
            {!isCollapsed &&
              item.to === '/password-resets' &&
              pendingResets > 0 && (
                <span
                  title={`${pendingResets} pending request${pendingResets === 1 ? '' : 's'}`}
                  className={`flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                    isActive ? 'bg-white text-primary' : 'bg-red-500 text-white'
                  }`}
                >
                  {pendingResets > 9 ? '9+' : pendingResets}
                </span>
              )}
            {!isCollapsed && isActive && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/80 animate-[livePulse_2s_ease-out_infinite]" />
            )}
          </>
        )}
      </NavLink>
    );
  }

  return (
    <aside
      className={`relative flex shrink-0 flex-col overflow-hidden bg-white/70 backdrop-blur-xl transition-[width] duration-300 ease-out ${
        isDrawer
          ? 'h-full w-72 rounded-r-[28px] px-3 py-5 shadow-[-8px_0_40px_-12px_rgba(31,41,55,0.25)]'
          : `sticky top-3 m-3 hidden h-[calc(100vh-1.5rem)] rounded-[26px] border border-white/70 px-3 py-5 shadow-[0_10px_44px_-16px_rgba(31,41,55,0.22)] md:flex ${
              isCollapsed ? 'w-[84px]' : 'w-[272px]'
            }`
      }`}
    >
      {/* Glass top reflection line */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />

      {/* Soft ambient glow at top */}
      <div
        className="pointer-events-none absolute -left-20 -top-28 h-64 w-64 rounded-full animate-[glowPulse_5s_ease-in-out_infinite]"
        style={{
          background:
            'radial-gradient(circle, rgba(242,106,27,0.18) 0%, rgba(242,106,27,0) 70%)',
        }}
      />

      {/* Logo block + collapse toggle */}
      <div
        className={`relative mb-4 flex items-center ${
          isCollapsed ? 'flex-col gap-2.5' : 'gap-3'
        }`}
      >
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-2xl bg-primary opacity-30 blur-md animate-[glowPulse_4s_ease-in-out_infinite]" />
          <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-lg shadow-primary/25 ring-1 ring-black/5">
            <img src="/MB.png" alt="Media Box Logo" className="h-full w-full object-contain" />
          </div>
        </div>

        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-tight tracking-tight text-textDark">
              Media Box
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary/80">
              <Sparkles size={9} /> Admin
            </p>
          </div>
        )}

        {!isDrawer && (
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand' : 'Collapse'}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-white/80 text-textLight shadow-sm transition hover:border-primary/40 hover:bg-white hover:text-primary ${
              isCollapsed ? '' : 'ml-auto'
            }`}
          >
            {isCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          </button>
        )}
      </div>

      {/* Quick find */}
      <div className="relative mb-2">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          title={`Quick find (${SHORTCUT_LABEL})`}
          aria-label="Quick find"
          className={`group flex w-full items-center rounded-xl border border-border/80 bg-white/55 text-textLight shadow-sm transition hover:border-primary/35 hover:bg-white hover:text-textDark ${
            isCollapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2'
          }`}
        >
          <Search size={15} className="shrink-0 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110 group-hover:text-primary" />
          {!isCollapsed && (
            <>
              <span className="flex-1 truncate text-left text-[12px] font-semibold">
                Quick find
              </span>
              <kbd className="rounded-md border border-border bg-white px-1.5 py-0.5 text-[9px] font-bold text-textLight">
                {SHORTCUT_LABEL}
              </kbd>
            </>
          )}
        </button>
      </div>

      {/* Nav — grouped so secondary pages stay out of the way */}
      <nav className="hide-scrollbar relative -mx-1 flex-1 overflow-y-auto px-1 pb-2">
        {NAV_GROUPS.map((group, groupIndex) => {
          const items = NAV_ITEMS.filter((item) => item.group === group.id);
          if (items.length === 0) return null;

          const isActiveGroup = group.id === activeGroupId;
          const isOpen =
            isCollapsed ||
            !group.collapsible ||
            (isActiveGroup
              ? closedActive[group.id] !== location.pathname
              : !!openGroups[group.id]);

          return (
            <div key={group.id}>
              {isCollapsed ? (
                groupIndex > 0 && (
                  <div className="mx-2 my-1.5 h-px bg-border/60" />
                )
              ) : group.collapsible ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isOpen}
                  className="group/header flex w-full items-center gap-1.5 px-2.5 pb-1.5 pt-3"
                >
                  <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-textFaint transition group-hover/header:text-textLight">
                    {group.label}
                  </span>
                  <ChevronDown
                    size={12}
                    className={`text-textFaint transition-transform duration-200 ${
                      isOpen ? '' : '-rotate-90'
                    }`}
                  />
                  <span className="h-px flex-1 bg-border/60" />
                </button>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 pb-1.5 pt-2">
                  <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-textFaint">
                    {group.label}
                  </span>
                  <span className="h-px flex-1 bg-border/60" />
                </div>
              )}

              <div
                aria-hidden={!isOpen}
                inert={!isOpen ? true : undefined}
                className={`grid transition-all duration-300 ease-out ${
                  isOpen
                    ? 'grid-rows-[1fr] opacity-100'
                    : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="flex flex-col gap-0.5 pt-0.5">
                    {items.map((item, index) => renderItem(item, index))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Account + sign out */}
      <div className="relative mt-3 border-t border-border/70 pt-3">
        {!isCollapsed && (
          <div className="mb-1.5 flex items-center gap-2.5 rounded-xl border border-white/70 bg-white/55 px-2.5 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-dark text-[11px] font-bold text-white shadow-sm shadow-primary/25">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-bold text-textDark">Administrator</p>
              <p className="truncate text-[10px] text-textLight">{email}</p>
            </div>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green" title="Online" />
          </div>
        )}

        <button
          onClick={signOut}
          title={isCollapsed ? 'Sign Out' : undefined}
          aria-label="Sign Out"
          className={`group flex w-full items-center rounded-xl text-[13px] font-semibold text-textMedium transition-all hover:bg-redLight hover:text-red ${
            isCollapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-2.5 py-2'
          }`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-transparent text-textLight transition group-hover:bg-red/10 group-hover:text-red">
            <LogOut size={16} strokeWidth={2} />
          </span>
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        shortcut={SHORTCUT_LABEL}
      />
    </aside>
  );
}
