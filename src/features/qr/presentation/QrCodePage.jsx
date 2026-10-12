import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Copy,
  Check,
  RefreshCw,
  Clock,
  ShieldCheck,
  Calendar,
  Lock,
  Sparkles,
} from 'lucide-react';
import { qrRepository } from '../data/qrRepository';
import { createQrCode } from '../domain/QrCode';
import { formatPH } from '../../../core/utils/formatters';

export default function QrCodePage() {
  const [qr, setQr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadCode();
    const interval = setInterval(loadCode, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!qr?.validUntil) return;
    const tick = setInterval(() => {
      setSecondsLeft(
        Math.max(0, Math.floor((new Date(qr.validUntil) - new Date()) / 1000))
      );
    }, 1000);
    return () => clearInterval(tick);
  }, [qr]);

  async function loadCode() {
    setLoading(true);
    try {
      const data = await qrRepository.fetchTodayCode();
      setQr(createQrCode(data));
    } catch (e) {
      console.error(e);
      setQr(null);
    } finally {
      setLoading(false);
    }
  }

  async function copyCode() {
    if (!qr?.code) return;
    try {
      await navigator.clipboard.writeText(qr.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      console.error(e);
    }
  }

  function formatCountdown(s) {
    if (s === null) return '--';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  }

  // 24h progress: 0% at start of day, 100% at expiry
  const progressPct = (() => {
    if (secondsLeft === null) return 0;
    const total = 24 * 3600; // 24 hours
    const elapsed = total - secondsLeft;
    return Math.max(0, Math.min(100, (elapsed / total) * 100));
  })();

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold text-textDark tracking-tight flex items-center gap-2">
            <Sparkles size={22} className="text-primary" />
            Today's Check-In QR
          </h2>
          <p className="text-sm text-textLight mt-1">
            Show this to employees · It refreshes at midnight
          </p>
        </div>
        <button
          onClick={loadCode}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold bg-white border border-border text-textMedium hover:border-primary hover:text-primary transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Main QR card */}
      <div className="relative overflow-hidden bg-white rounded-3xl border border-border shadow-sm">
        {/* Soft orange glow */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full pointer-events-none opacity-50"
          style={{
            background:
              'radial-gradient(circle, rgba(242,106,27,0.18) 0%, rgba(242,106,27,0) 70%)',
          }}
        />

        <div className="relative p-8 flex flex-col items-center">
          {loading ? (
            <div className="py-24 flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-textLight">Loading code…</p>
            </div>
          ) : qr ? (
            <>
              {/* Live status pill */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold uppercase tracking-wider mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Active
              </div>

              {/* QR with modern frame */}
              <div className="relative">
                <div className="absolute inset-0 rounded-[32px] bg-gradient-to-br from-primary/20 via-primary/5 to-transparent blur-2xl" />

                <div className="relative bg-white rounded-[28px] p-5 border border-border shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
                  {/* Corner brackets */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl-2xl" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr-2xl" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl-2xl" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-primary rounded-br-2xl" />

                  <div className="relative bg-white p-2 rounded-xl">
                    <QRCodeSVG
                      value={qr.code}
                      size={260}
                      level="H"
                    />
                    {/* MB logo in center */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-white rounded-2xl p-2 shadow-md border border-border">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primaryDark flex items-center justify-center text-white text-xs font-bold">
                          MB
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Copyable code chip */}
              <button
                onClick={copyCode}
                className="mt-6 inline-flex items-center gap-3 px-4 py-2.5 rounded-full bg-bg border border-border hover:border-primary/40 hover:bg-white transition group"
              >
                <div className="text-left">
                  <p className="text-[9px] font-bold tracking-widest text-textLight uppercase">
                    Code
                  </p>
                  <p className="font-mono text-[13px] font-semibold text-textDark tracking-tight">
                    {qr.code}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full bg-white border border-border flex items-center justify-center text-textLight group-hover:text-primary group-hover:border-primary/40 transition">
                  {copied ? (
                    <Check size={14} className="text-emerald-600" />
                  ) : (
                    <Copy size={14} />
                  )}
                </div>
              </button>
            </>
          ) : (
            <div className="py-20 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-bg flex items-center justify-center text-textLight">
                <ShieldCheck size={28} />
              </div>
              <p className="text-textLight">No active QR code for today</p>
              <button
                onClick={loadCode}
                className="bg-primary text-white px-6 py-2.5 rounded-full font-semibold hover:bg-primaryDark transition"
              >
                Refresh
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Validity + Countdown strip */}
      {qr && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Valid until */}
          <div className="bg-white rounded-2xl border border-border shadow-sm p-5 relative overflow-hidden">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <ShieldCheck size={18} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold tracking-widest text-textLight uppercase">
                  Valid until
                </p>
                <p className="text-lg font-bold text-textDark mt-0.5">
                  {formatPH(qr.validUntil, {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </p>
                <p className="text-xs text-textLight mt-1 flex items-center gap-1.5">
                  <Calendar size={11} />
                  {formatPH(qr.validUntil, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Refreshes in */}
          <div className="bg-white rounded-2xl border border-border shadow-sm p-5 relative overflow-hidden">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 text-primary flex items-center justify-center shrink-0">
                <Clock size={18} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold tracking-widest text-textLight uppercase">
                  Refreshes in
                </p>
                <p className="text-lg font-bold text-primary mt-0.5">
                  {formatCountdown(secondsLeft)}
                </p>
                {/* 24h progress bar */}
                <div className="mt-3 h-1.5 bg-bg rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primaryDark rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security tip */}
      <div className="bg-amber-50/60 border border-amber-200/70 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <Lock size={16} />
        </div>
        <div className="flex-1 text-xs text-amber-800 leading-relaxed">
          <p className="font-bold mb-1">Security tip</p>
          <p>
            This QR expires at midnight. Only display it inside the store on a
            device employees can see. Do not share it via chat or email.
          </p>
        </div>
      </div>
    </div>
  );
}