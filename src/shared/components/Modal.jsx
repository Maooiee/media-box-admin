import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-lg',
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-textDark/35 p-4 backdrop-blur-[3px] animate-[fadeIn_150ms_ease-out]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[90vh] w-full ${maxWidth} flex-col overflow-hidden rounded-3xl border border-white/60 bg-white shadow-float animate-[slideUp_220ms_ease-out]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-gradient-to-r from-primary-light/40 via-white to-white px-6 pb-4 pt-6">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold tracking-tight text-textDark md:text-xl">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-textLight md:text-sm">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-white text-textLight shadow-sm transition hover:rotate-90 hover:border-primary/30 hover:text-primary"
          >
            <X size={17} />
          </button>
        </div>

        <div className="hide-scrollbar overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
