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

        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 w-full">
          
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-lg ring-1 ring-black/5 overflow-hidden p-2">
              <img
                src="/MB.png"
                alt="Media Box Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.innerHTML = '<span class="font-bold text-primary text-lg">MB</span>';
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

          {/* Hero Text */}
          <div className="max-w-md">
            <h2 className="text-4xl xl:text-5xl font-bold text-white leading-[1.15] tracking-tight">
              Manage your team,
              <br />
              <span className="text-white/60">effortlessly.</span>
            </h2>
            <p className="text-white/80 text-sm xl:text-base mt-6 leading-relaxed">
              Attendance, shifts, tasks, and payroll — all in one elegant dashboard built for Media Box.
            </p>

            <div className="flex flex-wrap gap-2 mt-8">
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
            © {new Date().getFullYear()} Media Box. All rights reserved.
          </p>
        </div>
      </div>

      {/* ─── Right Panel (Form) ─── */}
      <div className="flex-1 flex items-center justify-center p-5 sm:p-8 lg:p-12 relative">
        
        {/* Subtle mobile background */}
        <div
          className="absolute inset-0 pointer-events-none lg:hidden opacity-40"
          style={{
            background: 'radial-gradient(circle at 50% 0%, rgba(242,106,27,0.08) 0%, transparent 60%)',
          }}
        />

        <div className="w-full max-w-[400px] relative z-10">
          
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center mb-10">
            <div className="w-16 h-16 rounded-3xl bg-white flex items-center justify-center shadow-xl shadow-primary/10 ring-1 ring-black/5 mb-4 p-3">
               <img
                src="/MB.png"
                alt="Media Box Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.innerHTML = '<span class="font-bold text-primary text-xl">MB</span>';
                }}
              />
            </div>
            <h1 className="text-xl font-bold text-textDark tracking-tight">Media Box</h1>
            <p className="text-[10px] font-bold tracking-[0.18em] text-textLight uppercase mt-1">
              Admin Console
            </p>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-textDark tracking-tight">
              Welcome back
            </h1>
            <p className="text-sm text-textLight mt-2">
              Sign in to continue to your dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
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
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-border bg-white text-sm text-textDark placeholder:text-textFaint outline-none transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-primary/10 shadow-sm"
                  placeholder="admin@mediabox.com"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[11px] font-bold tracking-[0.12em] text-textMedium uppercase">
                  Password
                </label>
                <button
                  type="button"
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
                  className="w-full pl-12 pr-12 py-3.5 rounded-2xl border border-border bg-white text-sm text-textDark placeholder:text-textFaint outline-none transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-primary/10 shadow-sm"
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
              <div className="p-3.5 rounded-2xl bg-redLight border border-red/20 text-red text-xs font-semibold flex items-start gap-2.5 animate-[slideUp_200ms_ease-out]">
                <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="group w-full inline-flex items-center justify-center gap-2.5 bg-gradient-to-br from-primary to-primary-dark text-white py-3.5 rounded-2xl font-bold text-sm shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 mt-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Verifying access...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight
                    size={18}
                    className="transition-transform duration-200 group-hover:translate-x-1"
                  />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-[11px] font-medium text-textLight mt-10">
            Admin access is granted by Media Box management only.
          </p>
        </div>
      </div>
    </div>
  );
}