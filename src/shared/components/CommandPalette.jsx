import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, CornerDownLeft, Search } from 'lucide-react';
import { NAV_GROUPS, NAV_ITEMS } from '../navigation';

const GROUP_LABELS = Object.fromEntries(NAV_GROUPS.map((g) => [g.id, g.label]));

// Keyboard-first navigation for an app with a growing number of pages.
// Opens from the sidebar search button or Ctrl/⌘ + K.
export default function CommandPalette({ open, onClose, shortcut = 'Ctrl K' }) {
  if (!open) return null;
  return <PaletteDialog onClose={onClose} shortcut={shortcut} />;
}

function PaletteDialog({ onClose, shortcut }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const listRef = useRef(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV_ITEMS;
    return NAV_ITEMS.filter((item) => {
      const haystack = `${item.label} ${item.shortLabel ?? ''} ${GROUP_LABELS[item.group] ?? ''}`;
      return haystack.toLowerCase().includes(q);
    });
  }, [query]);

  // `activeIdx` may briefly outrun a filtered list; clamp it while rendering.
  const safeActiveIdx = results.length
    ? Math.min(activeIdx, results.length - 1)
    : 0;

  // Lock page scroll while the palette is up.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Keep the highlighted row visible.
  useEffect(() => {
    const el = listRef.current?.children?.[safeActiveIdx];
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [safeActiveIdx]);

  function go(item) {
    if (!item) return;
    onClose();
    navigate(item.to);
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIdx((i) =>
        results.length
          ? (Math.min(i, results.length - 1) + 1) % results.length
          : 0,
      );
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIdx((i) =>
        results.length
          ? (Math.min(i, results.length - 1) - 1 + results.length) %
            results.length
          : 0,
      );
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      go(results[safeActiveIdx]);
    }
  }

  return createPortal(
    <div
      role="presentation"
      onMouseDown={onClose}
      className="fixed inset-0 z-[120] flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm animate-[fadeIn_120ms_ease-out]"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick find"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_24px_70px_-20px_rgba(31,41,55,0.45)] animate-[slideUp_180ms_ease-out]"
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
          <Search size={17} className="shrink-0 text-textLight" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Jump to a page..."
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-textDark outline-none placeholder:text-textFaint"
          />
          <kbd className="hidden rounded-md border border-border bg-bg px-1.5 py-0.5 text-[10px] font-bold text-textLight sm:inline-flex">
            {shortcut}
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-3 py-10 text-center">
              <p className="text-sm font-semibold text-textMedium">No pages found</p>
              <p className="mt-1 text-xs text-textLight">
                Try "attendance", "employee", or "payroll".
              </p>
            </div>
          ) : (
            results.map((item, idx) => {
              const Icon = item.icon;
              const isActive = idx === safeActiveIdx;
              return (
                <button
                  key={item.to}
                  type="button"
                  onMouseEnter={() => setActiveIdx(idx)}
                  onClick={() => go(item)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                    isActive
                      ? 'bg-primary-light/60 text-textDark'
                      : 'text-textMedium hover:bg-bg'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      isActive
                        ? 'bg-white text-primary shadow-sm'
                        : 'bg-bg text-textLight'
                    }`}
                  >
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">
                      {item.label}
                    </span>
                    <span className="block text-[10px] font-medium uppercase tracking-wider text-textFaint">
                      {GROUP_LABELS[item.group]}
                    </span>
                  </span>
                  {isActive && (
                    <CornerDownLeft size={13} className="shrink-0 text-primary" />
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border bg-bg/50 px-4 py-2.5 text-[10px] font-semibold text-textLight">
          <span className="flex items-center gap-1.5">
            <ArrowUp size={11} />
            <ArrowDown size={11} />
            Navigate
          </span>
          <span className="flex items-center gap-1.5">
            <CornerDownLeft size={11} />
            Open
          </span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
