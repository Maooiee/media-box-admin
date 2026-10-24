import { Component, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TriangleAlert,
  RotateCcw,
  LayoutDashboard,
  Copy,
  Check,
  ChevronDown,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
//  ErrorBoundary
//  A crash anywhere in the wrapped subtree renders a friendly
//  fallback instead of white-screening the whole admin panel.
//
//  Recovery: give it a `key` that changes on navigation (e.g. the
//  route pathname). React then remounts a fresh boundary, clearing
//  the error — so a broken page can't permanently wedge the app.
// ─────────────────────────────────────────────────────────────
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the full detail in the console for debugging / bug reports.
    console.error('[ErrorBoundary]', error, info);
    this._stack = info?.componentStack ?? '';
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          stack={this._stack}
          onRetry={this.handleRetry}
        />
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────
//  Fallback UI — themed to match the glass/brand design.
//  A separate function component so it can use hooks (useNavigate).
// ─────────────────────────────────────────────────────────────
function ErrorFallback({ error, stack, onRetry }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const detail = [
    String(error?.message || error || 'Unknown error'),
    stack ? String(stack).trim() : '',
  ]
    .filter(Boolean)
    .join('\n');

  async function copyDetail() {
    try {
      await navigator.clipboard.writeText(detail);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable (permissions/insecure context) — ignore.
    }
  }

  return (
    <div className="min-h-[60vh] w-full flex items-center justify-center p-5">
      <div className="w-full max-w-md bg-white/70 backdrop-blur-xl rounded-[28px] border border-white/70 shadow-[0_24px_70px_-24px_rgba(31,41,55,0.30)] p-7 text-center animate-[fadeUp_400ms_ease-out]">
        <div className="relative inline-flex mb-5">
          <div className="absolute inset-0 bg-red/30 rounded-2xl blur-md" />
          <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-red to-red/80 flex items-center justify-center text-white shadow-lg shadow-red/30">
            <TriangleAlert size={26} strokeWidth={2.2} />
          </div>
        </div>

        <h1 className="text-xl font-bold text-textDark tracking-tight">
          Something went wrong
        </h1>
        <p className="text-sm text-textLight mt-2 leading-relaxed">
          This page hit an unexpected error. Your data is safe — try again, or head
          back to the dashboard.
        </p>

        <div className="flex flex-col gap-2.5 mt-6">
          <button
            onClick={onRetry}
            className="group w-full inline-flex items-center justify-center gap-2 bg-gradient-to-br from-primary to-primary-dark text-white py-3 rounded-2xl font-bold text-sm shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
          >
            <RotateCcw size={16} className="transition-transform group-hover:-rotate-180 duration-300" />
            Try again
          </button>

          <div className="flex gap-2.5">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-white/80 border border-border text-sm font-semibold text-textMedium hover:border-primary hover:text-primary transition"
            >
              <LayoutDashboard size={15} /> Dashboard
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-white/80 border border-border text-sm font-semibold text-textMedium hover:border-primary hover:text-primary transition"
            >
              Reload
            </button>
          </div>
        </div>

        {/* Collapsible technical details */}
        <details className="mt-5 text-left group">
          <summary className="cursor-pointer list-none inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-textLight uppercase hover:text-primary transition select-none">
            <ChevronDown size={13} className="transition-transform group-open:rotate-180" />
            Technical details
          </summary>
          <div className="relative mt-2.5">
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-bg border border-border p-3 text-[11px] leading-relaxed text-textMedium font-mono">
              {detail}
            </pre>
            <button
              onClick={copyDetail}
              title="Copy error details"
              className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-white border border-border flex items-center justify-center transition hover:border-primary/40"
            >
              {copied ? (
                <Check size={13} className="text-green" />
              ) : (
                <Copy size={13} className="text-textLight hover:text-primary" />
              )}
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}
