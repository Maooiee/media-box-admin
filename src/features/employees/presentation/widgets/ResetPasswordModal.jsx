import { useEffect, useState } from 'react';
import { X, KeyRound, Copy, Check, Eye, EyeOff, Mail, Shuffle } from 'lucide-react';
import { employeesRepository } from '../../data/employeesRepository';

export default function ResetPasswordModal({ open, employee, onClose, onSaved }) {
  // 'temporary' — server generates a random password (forgotten password case)
  // 'custom'    — admin types the new password themselves
  const [mode, setMode] = useState('temporary');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && employee) {
      setMode('temporary');
      setPassword('');
      setConfirm('');
      setShowPassword(false);
      setError('');
      setSuccess(null);
      setCopied(false);
    }
  }, [open, employee]);

  async function handleSubmit(e) {
    e?.preventDefault();
    setError('');

    if (mode === 'custom') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      if (password !== confirm) {
        setError('Passwords do not match');
        return;
      }
    }

    setSaving(true);
    try {
      const result = await employeesRepository.resetPassword({
        userId: employee.id,
        password: mode === 'custom' ? password : null,
      });
      setSuccess({ ...result, email: employee.email });
      onSaved?.();
    } catch (err) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  }

  function copyCredentials() {
    if (!success || !employee) return;
    navigator.clipboard.writeText(
      `Email: ${employee.email}\nPassword: ${success.password}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4 animate-[fadeIn_150ms_ease-out]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] animate-[slideUp_220ms_ease-out]"
      >
        {/* ─── Header with gradient band ─── */}
        <div className="relative px-6 pt-6 pb-5 border-b border-border/60">
          <div
            className="absolute -top-20 -right-20 w-64 h-64 rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(242,106,27,0.15) 0%, rgba(242,106,27,0) 70%)',
            }}
          />

          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-primary rounded-2xl blur-md opacity-30" />
                <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white shadow-lg shadow-primary/25">
                  <KeyRound size={20} strokeWidth={2.4} />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-textDark tracking-tight">
                  Reset Password
                </h3>
                <p className="text-[11.5px] text-textLight mt-0.5">
                  {employee?.fullName} · {employee?.employeeId}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-bg flex items-center justify-center text-textLight hover:text-textDark transition"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ─── Body ─── */}
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
          {success ? (
            <SuccessPanel
              success={success}
              copied={copied}
              onCopy={copyCredentials}
              onDone={onClose}
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Mode selector */}
              <ModeCard
                active={mode === 'temporary'}
                onClick={() => setMode('temporary')}
                icon={<Shuffle size={16} />}
                title="Temporary password"
                description="We generate a strong random password you can share with the employee"
              />
              <ModeCard
                active={mode === 'custom'}
                onClick={() => setMode('custom')}
                icon={<KeyRound size={16} />}
                title="Set password manually"
                description="Type the new password yourself"
              />

              {mode === 'custom' && (
                <div className="space-y-3 pt-1">
                  <ModernField label="New Password" required>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      autoComplete="new-password"
                      required
                      className="flex-1 min-w-0 bg-transparent outline-none text-sm text-textDark placeholder:text-textLight"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="text-textLight hover:text-textDark transition shrink-0"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </ModernField>

                  <ModernField label="Confirm Password" required>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repeat the new password"
                      autoComplete="new-password"
                      required
                      className="flex-1 min-w-0 bg-transparent outline-none text-sm text-textDark placeholder:text-textLight"
                    />
                  </ModernField>
                </div>
              )}

              {mode === 'temporary' && (
                <p className="text-[11px] text-textLight leading-relaxed">
                  The password appears once after resetting — copy it and hand it
                  to the employee securely. They should change it after signing in.
                </p>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5">
                    !
                  </div>
                  <p className="text-xs text-red-700 font-medium">{error}</p>
                </div>
              )}
            </form>
          )}
        </div>

        {/* ─── Footer ─── */}
        {!success && (
          <div className="px-6 py-4 bg-bg/60 border-t border-border/60 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-sm font-semibold text-textMedium hover:bg-white transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="px-6 py-2.5 rounded-full bg-gradient-to-br from-primary to-primary/90 text-white text-sm font-bold shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {saving
                ? 'Resetting...'
                : mode === 'custom'
                ? 'Set New Password'
                : 'Generate Temporary Password'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
//  Success panel — the password is shown only once
// ─────────────────────────────────────────────────────
function SuccessPanel({ success, copied, onCopy, onDone }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center text-center pt-2 pb-3">
        <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
          <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center">
            <Check size={18} strokeWidth={3.5} className="text-white" />
          </div>
        </div>
        <p className="text-base font-bold text-textDark">Password updated</p>
        <p className="text-xs text-textLight mt-1 max-w-[280px]">
          Copy this password and share it securely. It is shown only once.
        </p>
      </div>

      <div className="bg-bg rounded-2xl p-4 space-y-3">
        <div>
          <p className="text-[10px] font-bold tracking-wider text-textLight uppercase mb-1 flex items-center gap-1.5">
            <Mail size={11} /> Email
          </p>
          <p className="text-sm font-semibold text-textDark break-all font-mono">
            {success.email}
          </p>
        </div>
        <div className="pt-3 border-t border-border/60">
          <p className="text-[10px] font-bold tracking-wider text-textLight uppercase mb-1">
            {success.temporary ? 'Temporary Password' : 'New Password'}
          </p>
          <p className="text-sm font-semibold text-textDark font-mono tracking-wider">
            {success.password}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <button
          onClick={onCopy}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-br from-primary to-primary/90 text-white font-bold text-sm shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all"
        >
          {copied ? (
            <>
              <Check size={16} strokeWidth={3} /> Copied to clipboard
            </>
          ) : (
            <>
              <Copy size={16} /> Copy credentials
            </>
          )}
        </button>
        <button
          onClick={onDone}
          className="w-full px-4 py-3 rounded-2xl border border-border text-textMedium font-semibold text-sm hover:bg-bg transition"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
//  Mode card (radio-style selector)
// ─────────────────────────────────────────────────────
function ModeCard({ active, onClick, icon, title, description }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left ${
        active
          ? 'bg-primary/5 border-primary/40 shadow-sm'
          : 'bg-bg border-border hover:border-primary/30'
      }`}
    >
      <div
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition shrink-0 ${
          active ? 'border-primary' : 'border-border bg-white'
        }`}
      >
        {active && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
      </div>
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          active ? 'bg-primary/10 text-primary' : 'bg-white text-textLight border border-border'
        }`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-textDark">{title}</p>
        <p className="text-[11px] text-textLight leading-snug">{description}</p>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────
//  Modern field
// ─────────────────────────────────────────────────────
function ModernField({ label, required, children }) {
  return (
    <div className="group">
      <label className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-textLight uppercase mb-2">
        {label}
        {required && <span className="text-primary">*</span>}
      </label>
      <div className="flex items-center px-4 py-3 rounded-2xl border border-border bg-bg focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/60 transition-all">
        {children}
      </div>
    </div>
  );
}
