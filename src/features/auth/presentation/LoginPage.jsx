import { useEffect, useState } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  CircleCheck,
  Send,
} from 'lucide-react';
import { authRepository } from '../data/authRepository';
import { supabase } from '../../../core/config/supabase';

/// Ticking clock for the branding panel (honest live time, Manila zone).
function useManilaClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const LOGO_FALLBACK =
  '<span class="font-bold text-primary text-lg">MB</span>';

/// Computed once at module load (not during render) to keep renders pure.
const CURRENT_YEAR = new Date().getFullYear();

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 'signin' → normal login · 'reset' → forgot-password email flow
  const [mode, setMode] = useState('signin');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const now = useManilaClock();
  const manilaTime = now.toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  });
  const manilaDate = now.toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { user } = await authRepository.signIn(email.trim(), password);
      if (!user) throw new Error('Login failed');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.is_admin) {
        await supabase.auth.signOut();
        setError('This account does not have admin access.');
        return;
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    setError('');
    setResetLoading(true);
    try {
      await authRepository.resetPassword(email.trim());
      setResetSent(true);
    } catch (err) {
      setError(err.message || 'Could not send the reset email.');
    } finally {
      setResetLoading(false);
    }
  }

  function backToSignIn() {
    setMode('signin');
    setResetSent(false);
    setError('');
  }

  return (
    <div className="min-h-screen flex bg-[#FAF7F2]">
      {/* ─── Left Panel (Branding) ─── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[50%] relative overflow-hidden bg-gradient-to-br from-[#F26A1B] via-[#E85D0D] to-[#C94D08]">
        {/* Soft ambient glows */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 20% 10%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 90% 90%, rgba(255,255,255,0.15) 0%, transparent 50%)',
          }}
        />
        {/* Subtle dot grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Floating glass orbs for depth */}
        <div className="absolute -top-16 -left-10 w-64 h-64 rounded-full bg-white/15 blur-2xl animate-[floatY_10s_ease-in-out_infinite] pointer-events-none" />
        <div className="absolute bottom-24 right-10 w-52 h-52 rounded-full bg-white/12 blur-2xl animate-[floatYAlt_13s_ease-in-out_infinite] pointer-events-none" />

        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3 animate-[fadeUp_500ms_ease-out]">
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-lg ring-1 ring-black/5 overflow-hidden p-2">
              <img
                src="/MB.png"
                alt="Media Box Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.innerHTML = LOGO_FALLBACK;
                }}
              />
            </div>
            <div>
              <p className="text-white font-bold text-base leading-tight tracking-tight">
                Media Box
              </p>
              <p className="text-[10px] font-bold tracking-[0.18em] text-white/70 uppercase mt-0.5">
                Admin Console
              </p>
            </div>
          </div>

          {/* Hero + floating glass cards */}
          <div className="relative max-w-md">
            {/* Floating clock card */}
            <div className="absolute -top-24 right-0 hidden xl:block animate-[floatY_7s_ease-in-out_infinite]">
              <div className="px-4 py-3 rounded-2xl bg-white/12 backdrop-blur-xl border border-white/25 shadow-xl">
                <p className="text-[9px] font-bold tracking-[0.16em] text-white/60 uppercase">
                  Manila Time
                </p>
                <p className="text-white font-bold text-lg leading-tight tabular-nums">
                  {manilaTime}
                </p>
                <p className="text-white/60 text-[11px] font-medium">{manilaDate}</p>
              </div>
            </div>

            {/* Floating status chip */}
            <div className="absolute -bottom-16 -left-6 hidden xl:block animate-[floatYAlt_8s_ease-in-out_infinite]">
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-white/12 backdrop-blur-xl border border-white/25 shadow-xl">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 shadow-[0_0_10px_2px_rgba(110,231,183,0.7)] animate-pulse" />
                <span className="text-white text-xs font-semibold">
                  All systems operational
                </span>
              </div>
            </div>

            <h2 className="text-4xl xl:text-5xl font-bold text-white leading-[1.15] tracking-tight animate-[fadeUp_600ms_ease-out]">
              Manage your team,
              <br />
              <span className="text-white/60">effortlessly.</span>
            </h2>
            <p className="text-white/80 text-sm xl:text-base mt-6 leading-relaxed animate-[fadeUp_700ms_ease-out]">
              Attendance, shifts, tasks, and payroll — all in one elegant dashboard built for
              Media Box.
            </p>

            <div className="flex flex-wrap gap-2 mt-8 animate-[fadeUp_800ms_ease-out]">
              {['Attendance', 'Shifts', 'Tasks', 'Payroll'].map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/90 text-[11px] font-semibold tracking-wide shadow-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="text-white/50 text-xs font-medium">
            © {CURRENT_YEAR} Media Box. All rights reserved.
          </p>
        </div>
      </div>

      {/* ─── Right Panel (Form) — glass ─── */}
      <div className="flex-1 flex items-center justify-center p-5 sm:p-8 lg:p-12 relative overflow-hidden">
        {/* Floating blurred orbs behind the glass card (they get blurred by the glass) */}
        <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-primary/25 blur-3xl animate-[floatY_11s_ease-in-out_infinite] pointer-events-none" />
        <div className="absolute -bottom-28 -right-10 w-80 h-80 rounded-full bg-amber-300/25 blur-3xl animate-[floatYAlt_14s_ease-in-out_infinite] pointer-events-none" />

        <div className="w-full max-w-[420px] relative z-10">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-3xl bg-white flex items-center justify-center shadow-xl shadow-primary/10 ring-1 ring-black/5 mb-4 p-3">
              <img
                src="/MB.png"
                alt="Media Box Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.innerHTML =
                    '<span class="font-bold text-primary text-xl">MB</span>';
                }}
              />
            </div>
            <h1 className="text-xl font-bold text-textDark tracking-tight">Media Box</h1>
            <p className="text-[10px] font-bold tracking-[0.18em] text-textLight uppercase mt-1">
              Admin Console
            </p>
          </div>

          {/* Glass form card */}
          <div className="bg-white/70 backdrop-blur-xl rounded-[32px] border border-white/70 shadow-[0_24px_70px_-24px_rgba(31,41,55,0.30)] p-6 sm:p-8 animate-[fadeUp_450ms_ease-out]">
            <div className="mb-7">
              <h1 className="text-[26px] font-bold text-textDark tracking-tight">
                {mode === 'reset' ? 'Reset password' : 'Welcome back'}
              </h1>
              <p className="text-sm text-textLight mt-2">
                {mode === 'reset'
                  ? "Enter your email and we'll send you a reset link."
                  : 'Sign in to continue to your dashboard.'}
              </p>
            </div>

            {mode === 'signin' ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email */}
                <div>
                  <label className="block text-[11px] font-bold tracking-[0.12em] text-textMedium uppercase mb-2">
                    Email
                  </label>
                  <div className="relative group">
                    <Mail
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-textLight group-focus-within:text-primary transition-colors pointer-events-none"
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-border bg-white/85 text-sm text-textDark placeholder:text-textFaint outline-none transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white shadow-sm"
                      placeholder="admin@mediabox.com"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[11px] font-bold tracking-[0.12em] text-textMedium uppercase">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('reset');
                        setResetSent(false);
                        setError('');
                      }}
                      className="text-[11px] font-bold text-primary hover:underline"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative group">
                    <Lock
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-textLight group-focus-within:text-primary transition-colors pointer-events-none"
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="w-full pl-12 pr-12 py-3.5 rounded-2xl border border-border bg-white/85 text-sm text-textDark placeholder:text-textFaint outline-none transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white shadow-sm"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl flex items-center justify-center text-textLight hover:text-textDark hover:bg-bg transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="p-3.5 rounded-2xl bg-redLight border border-red/20 text-red text-xs font-semibold flex items-start gap-2.5 animate-[fadeUp_200ms_ease-out]">
                    <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                    <span className="leading-relaxed">{error}</span>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full overflow-hidden inline-flex items-center justify-center gap-2.5 bg-gradient-to-br from-primary to-primary-dark text-white py-3.5 rounded-2xl font-bold text-sm shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 mt-2"
                >
                  <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                    <span className="absolute top-0 bottom-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent skew-x-20 group-hover:animate-[sheen_0.8s_ease-out]" />
                  </span>
                  {loading ? (
                    <span className="relative inline-flex items-center gap-2.5">
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Verifying access...
                    </span>
                  ) : (
                    <span className="relative inline-flex items-center gap-2.5">
                      Sign in
                      <ArrowRight
                        size={18}
                        className="transition-transform duration-200 group-hover:translate-x-1"
                      />
                    </span>
                  )}
                </button>
              </form>
            ) : (
              /* ─── Forgot-password form ─── */
              <form onSubmit={handleReset} className="space-y-5">
                {resetSent ? (
                  <div className="p-4 rounded-2xl bg-greenLight border border-green/25 text-green text-xs font-semibold flex items-start gap-2.5 animate-[fadeUp_200ms_ease-out]">
                    <CircleCheck size={17} className="mt-0.5 shrink-0" />
                    <span className="leading-relaxed">
                      Reset link sent to <b>{email}</b>. Check your inbox — the link expires
                      shortly.
                    </span>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold tracking-[0.12em] text-textMedium uppercase mb-2">
                      Email
                    </label>
                    <div className="relative group">
                      <Mail
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-textLight group-focus-within:text-primary transition-colors pointer-events-none"
                      />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        autoFocus
                        className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-border bg-white/85 text-sm text-textDark placeholder:text-textFaint outline-none transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white shadow-sm"
                        placeholder="admin@mediabox.com"
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-3.5 rounded-2xl bg-redLight border border-red/20 text-red text-xs font-semibold flex items-start gap-2.5 animate-[fadeUp_200ms_ease-out]">
                    <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                    <span className="leading-relaxed">{error}</span>
                  </div>
                )}

                <button
                  type={resetSent ? 'button' : 'submit'}
                  onClick={resetSent ? backToSignIn : undefined}
                  className="group relative w-full overflow-hidden inline-flex items-center justify-center gap-2.5 bg-gradient-to-br from-primary to-primary-dark text-white py-3.5 rounded-2xl font-bold text-sm shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  {resetLoading ? (
                    <span className="inline-flex items-center gap-2.5">
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Sending...
                    </span>
                  ) : resetSent ? (
                    <span className="inline-flex items-center gap-2.5">
                      <ArrowLeft size={17} /> Back to sign in
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2.5">
                      <Send size={16} /> Send reset link
                    </span>
                  )}
                </button>

                {!resetSent && (
                  <button
                    type="button"
                    onClick={backToSignIn}
                    className="w-full inline-flex items-center justify-center gap-1.5 text-[12px] font-bold text-textMedium hover:text-primary transition py-1"
                  >
                    <ArrowLeft size={14} /> Back to sign in
                  </button>
                )}
              </form>
            )}
          </div>

          <p className="text-center text-[11px] font-medium text-textLight mt-6">
            Admin access is granted by Media Box management only.
          </p>
        </div>
      </div>
    </div>
  );
}
