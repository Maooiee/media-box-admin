import { CheckCircle2, XCircle } from 'lucide-react';

// Shared transient message. Each page owns the state (message + timeout);
// this component only renders it so the styling stays consistent.
export default function Toast({ message, type = 'success' }) {
  if (!message) return null;
  const isSuccess = type === 'success';
  const Icon = isSuccess ? CheckCircle2 : XCircle;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 left-1/2 z-[60] flex max-w-[min(92vw,40rem)] -translate-x-1/2 items-start gap-2 rounded-2xl border px-4 py-2.5 text-left text-xs font-semibold text-white shadow-float animate-[toastIn_220ms_ease-out] md:text-sm ${
        isSuccess
          ? 'border-white/20 bg-gradient-to-br from-green to-green/85'
          : 'border-white/20 bg-gradient-to-br from-red to-red/85'
      }`}
    >
      <Icon size={15} className="mt-0.5 shrink-0" />
      <span className="leading-snug">{message}</span>
    </div>
  );
}
