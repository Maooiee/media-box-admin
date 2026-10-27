import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, ArrowRight, ShieldAlert, CircleCheck, ArrowLeft } from 'lucide-react';
import { supabase } from '../../../core/config/supabase';

const MIN_PASSWORD = 8;

/** Reads `#error=...` left behind by Supabase when a recovery link is bad. */
function readHashError() {
  const hash = window.location.hash?.replace(/^#/, '') ?? '';
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const error = params.get('error') ?? params.get('error_code');
  if (!error) return null;
  return params.get('error_description')?.replace(/\+/g, ' ') ?? 'This reset link is invalid or has expired.';
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const hashError = useMemo(() => readHashError(), []);

  const [status, setStatus] = useState(hashError ? 'invalid' : 'checking');
  const [message, setMessage] = useState(hashError ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  // A recovery link signs the user in with a short-lived session. Wait for
  // supabase-js to parse the token from the URL before showing the form.
  useEffect(() => {
    if (hashError) return;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) setStatus('ready');
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (session && (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY' || event === 'INITIAL_SESSION')) {
        setStatus('ready');
      }
    });

    // A link that carries no usable token should fail with guidance, not spin.
    const timer = setTimeout(() => {
      if (!active) return;
      setStatus((prev) => (prev === 'checking' ? 'invalid' : prev));
    }, 6000);

    return () => {
      active = false;
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, [hashError]);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');

    if (password.length < MIN_PASSWORD) {
      setMessage(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setMessage('The two passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      // The recovery session is single-use; make the user sign in with the
      // password they just chose.
      try {
        await supabase.auth.signOut();
      } catch {
        // The password change already succeeded — a failed sign-out must not
        // be reported as a failed reset.
      }
      setStatus('done');
      if (window.history.replaceState) {
        window.history.replaceState(null, '', '/reset-password');
      }
    } catch (err) {
      setMessage(err?.message || 'Could not update the password. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] p-5 sm:p-8 relative overflow-hidden">
      <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-28 -right-10 w-80 h-80 rounded-full bg-amber-300/25 blur-3xl pointer-events-none" />

      <div className="w-full max-w-[420px] relative z-10">
        <div className="flex flex-col items-center mb-7">
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
          <p className="text-[10px] font-bold tracking-[0.18em] text-textLight uppercase">
            Media Box Admin Console
          </p>
        </div>

        <div className="bg-white/70 backdrop-blur-xl rounded-[32px] border border-white/70 shadow-[0_24px_70px_-24px_rgba(31,41,55,0.30)] p-6 sm:p-8">
          {status === 'checking' && (
            <div className="py-8 flex flex-col items-center text-center gap-4">
              <span className="w-8 h-8 rounded-full border-[3px] border-primary/20 border-t-primary animate-spin" />
              <div>
                <h1 className="text-lg font-bold text-textDark">Verifying your reset link</h1>
                <p className="text-sm text-textLight mt-1">This only takes a moment.</p>
              </div>
            </div>
          )}

          {status === 'invalid' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-[26px] font-bold text-textDark tracking-tight">
                  Link not valid
                </h1>
                <p className="text-sm text-textLight mt-2">
                  Password reset links can only be used once, and they expire.
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-redLight border border-red/20 text-red text-xs font-semibold flex items-start gap-2.5">
                <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                <span className="leading-relaxed">
                  {message ||
                    'This reset link is invalid or has expired. Request a new one from the sign-in page.'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/login', { replace: true })}
                className="w-full inline-flex items-center justify-center gap-2.5 bg-gradient-to-br from-primary to-primary-dark text-white py-3.5 rounded-2xl font-bold text-sm shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all duration-200"
              >
                <ArrowLeft size={17} /> Back to sign in
              </button>
            </div>
          )}

          {status === 'ready' && (
            <>
              <div className="mb-7">
                <h1 className="text-[26px] font-bold text-textDark tracking-tight">
                  Set a new password
                </h1>
                <p className="text-sm text-textLight mt-2">
                  Choose a new password for your admin account. You&apos;ll sign in with it next time.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-bold tracking-[0.12em] text-textMedium uppercase mb-2">
                    New password
                  </label>
                  <div className="relative group">
                    <Lock
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-textLight group-focus-within:text-primary transition-colors pointer-events-none"
                    />
                    <input
                      type={show ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={MIN_PASSWORD}
                      autoComplete="new-password"
                      autoFocus
                      className="w-full pl-12 pr-12 py-3.5 rounded-2xl border border-border bg-white/85 text-sm text-textDark placeholder:text-textFaint outline-none transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white shadow-sm"
                      placeholder={`At least ${MIN_PASSWORD} characters`}
                    />
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl flex items-center justify-center text-textLight hover:text-textDark hover:bg-bg transition-colors"
                      aria-label={show ? 'Hide password' : 'Show password'}
                    >
                      {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold tracking-[0.12em] text-textMedium uppercase mb-2">
                    Confirm password
                  </label>
                  <div className="relative group">
                    <Lock
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-textLight group-focus-within:text-primary transition-colors pointer-events-none"
                    />
                    <input
                      type={show ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      minLength={MIN_PASSWORD}
                      autoComplete="new-password"
                      className="w-full pl-12 pr-12 py-3.5 rounded-2xl border border-border bg-white/85 text-sm text-textDark placeholder:text-textFaint outline-none transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white shadow-sm"
                      placeholder="Type it again"
                    />
                  </div>
                </div>

                {message && (
                  <div className="p-3.5 rounded-2xl bg-redLight border border-red/20 text-red text-xs font-semibold flex items-start gap-2.5">
                    <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                    <span className="leading-relaxed">{message}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="group relative w-full overflow-hidden inline-flex items-center justify-center gap-2.5 bg-gradient-to-br from-primary to-primary-dark text-white py-3.5 rounded-2xl font-bold text-sm shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  {saving ? (
                    <span className="inline-flex items-center gap-2.5">
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2.5">
                      Update password <ArrowRight size={18} />
                    </span>
                  )}
                </button>
              </form>
            </>
          )}

          {status === 'done' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-greenLight border border-green/25 text-green text-sm font-semibold flex items-start gap-2.5">
                <CircleCheck size={18} className="mt-0.5 shrink-0" />
                <span className="leading-relaxed">
                  Password updated. Sign in with your new password.
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/login', { replace: true })}
                className="w-full inline-flex items-center justify-center gap-2.5 bg-gradient-to-br from-primary to-primary-dark text-white py-3.5 rounded-2xl font-bold text-sm shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all duration-200"
              >
                Go to sign in <ArrowRight size={18} />
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] font-medium text-textLight mt-6">
          Media Box — Admin Console
        </p>
      </div>
    </div>
  );
}
