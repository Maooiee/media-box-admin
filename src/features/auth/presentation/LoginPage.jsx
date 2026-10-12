import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldAlert } from 'lucide-react';
import { authRepository } from '../data/authRepository';
import { supabase } from '../../../core/config/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { user } = await authRepository.signIn(email, password);
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

  return (
    <div className="min-h-screen flex bg-bg">
      {/* ─── Left: brand panel (desktop only) ─── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary-dark">
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.35) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.2) 0%, transparent 50%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center text-white font-bold text-lg shadow-lg">
              MB
            </div>
            <div>
              <p className="text-white font-bold text-base leading-tight">
                Media Box
              </p>
              <p className="text-[10px] font-semibold tracking-[0.18em] text-white/70 uppercase mt-0.5">
                Admin Console
              </p>
            </div>
          </div>

          <div className="max-w-md">
            <h2 className="text-4xl xl:text-5xl font-bold text-white leading-[1.1] tracking-tight">
              Manage your team,
              <br />
              <span className="text-white/70">effortlessly.</span>
            </h2>
            <p className="text-white/75 text-sm xl:text-base mt-5 leading-relaxed">
              Attendance, shifts, tasks, and payroll — all in one elegant
              dashboard built for Media Box.
            </p>

            <div className="flex flex-wrap gap-2 mt-8">
              {['Attendance', 'Shifts', 'Tasks', 'Payroll'].map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/90 text-[11px] font-semibold tracking-wide"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <p className="text-white/50 text-xs">
            © {new Date().getFullYear()} Media Box. All rights reserved.
          </p>
        </div>
      </div>

      {/* ─── Right: login form ─── */}
      <div className="flex-1 flex items-center justify-center p-5 sm:p-8 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary/30 mb-4">
              MB
            </div>
            <p className="text-base font-bold text-textDark">Media Box</p>
            <p className="text-[10px] font-semibold tracking-[0.18em] text-textLight uppercase mt-0.5">
              Admin Console
            </p>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-textDark tracking-tight">
              Welcome back
            </h1>
            <p className="text-sm text-textLight mt-1.5">
              Sign in to continue to your dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-[11px] font-bold tracking-[0.12em] text-textMedium uppercase mb-2">
                Email
              </label>
              <div className="relative group">
                <Mail
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-textLight group-focus-within:text-primary transition-colors pointer-events-none"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-border bg-white text-sm text-textDark placeholder:text-textFaint outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
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
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative group">
                <Lock
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-textLight group-focus-within:text-primary transition-colors pointer-events-none"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full pl-11 pr-12 py-3.5 rounded-2xl border border-border bg-white text-sm text-textDark placeholder:text-textFaint outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-textLight hover:text-textDark hover:bg-bg transition"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3.5 rounded-2xl bg-redLight border border-red/20 text-red text-xs font-semibold flex items-start gap-2">
                <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="group w-full inline-flex items-center justify-center gap-2 bg-gradient-to-br from-primary to-primary-dark text-white py-3.5 rounded-2xl font-semibold text-sm shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Verifying access…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight
                    size={16}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-textLight mt-8">
            Admin access is granted by Media Box management only.
          </p>
        </div>
      </div>
    </div>
  );
}