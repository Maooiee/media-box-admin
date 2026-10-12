import { useState } from 'react';
import { X, UserPlus, Copy, Check, Mail, BadgeCheck, Briefcase, Calendar } from 'lucide-react';
import { employeesRepository } from '../../data/employeesRepository';

export default function AddEmployeeModal({ open, onClose, onCreated }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [position, setPosition] = useState('');
  const [schedule, setSchedule] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [copied, setCopied] = useState(false);

  function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    return pwd;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!fullName.trim() || !email.trim() || !employeeId.trim()) {
      setError('Name, email, and employee ID are required');
      return;
    }

    setSaving(true);
    try {
      const password = generatePassword();
      await employeesRepository.createEmployee({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        employeeId: employeeId.trim(),
        position: position.trim() || 'Employee',
        schedule: schedule.trim(),
        isAdmin,
      });

      setSuccess({ email: email.trim(), password });
      onCreated?.();
    } catch (err) {
      setError(err.message || 'Failed to create employee');
    } finally {
      setSaving(false);
    }
  }

  function copyPassword() {
    if (!success) return;
    navigator.clipboard.writeText(
      `Email: ${success.email}\nPassword: ${success.password}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose() {
    setFullName('');
    setEmail('');
    setEmployeeId('');
    setPosition('');
    setSchedule('');
    setIsAdmin(false);
    setError('');
    setSuccess(null);
    setCopied(false);
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4 animate-[fadeIn_150ms_ease-out]"
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] animate-[slideUp_220ms_ease-out]"
      >
        {/* ─── Header with gradient band ─── */}
        <div className="relative px-6 pt-6 pb-5 border-b border-border/60">
          {/* Soft gradient glow */}
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
                  <UserPlus size={20} strokeWidth={2.4} />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-textDark tracking-tight">
                  Add New Employee
                </h3>
                <p className="text-[11.5px] text-textLight mt-0.5">
                  Creates a login + profile
                </p>
              </div>
            </div>

            <button
              onClick={handleClose}
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
              onCopy={copyPassword}
              onDone={handleClose}
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Section: Identity */}
              <SectionLabel>Identity</SectionLabel>

              <ModernField
                label="Full Name"
                icon={<UserPlus size={14} />}
                required
              >
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Juan Dela Cruz"
                  required
                  className="w-full bg-transparent outline-none text-sm text-textDark placeholder:text-textLight"
                />
              </ModernField>

              <ModernField
                label="Email Address"
                icon={<Mail size={14} />}
                required
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="juan@company.com"
                  required
                  className="w-full bg-transparent outline-none text-sm text-textDark placeholder:text-textLight"
                />
              </ModernField>

              <ModernField
                label="Employee ID"
                icon={<BadgeCheck size={14} />}
                required
              >
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="EMP001"
                  required
                  className="w-full bg-transparent outline-none text-sm text-textDark placeholder:text-textLight"
                />
              </ModernField>

              {/* Section: Work details */}
              <SectionLabel className="pt-1">Work Details</SectionLabel>

              <ModernField label="Position" icon={<Briefcase size={14} />}>
                <input
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="Cashier"
                  className="w-full bg-transparent outline-none text-sm text-textDark placeholder:text-textLight"
                />
              </ModernField>

              <ModernField label="Schedule" icon={<Calendar size={14} />}>
                <input
                  type="text"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  placeholder="Mon–Fri · 9AM–6PM"
                  className="w-full bg-transparent outline-none text-sm text-textDark placeholder:text-textLight"
                />
              </ModernField>

              {/* Admin toggle */}
              <button
                type="button"
                onClick={() => setIsAdmin((v) => !v)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left ${
                  isAdmin
                    ? 'bg-primary/5 border-primary/40 shadow-sm'
                    : 'bg-bg border-border hover:border-primary/30'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition ${
                    isAdmin
                      ? 'bg-primary border-primary'
                      : 'border-border bg-white'
                  }`}
                >
                  {isAdmin && (
                    <Check size={12} strokeWidth={3.5} className="text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-textDark">
                    Grant admin access
                  </p>
                  <p className="text-[11px] text-textLight">
                    Can manage employees, tasks, and approve attendance
                  </p>
                </div>
              </button>

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
              onClick={handleClose}
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
              {saving ? 'Creating...' : 'Create Employee'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
//  Success panel
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
        <p className="text-base font-bold text-textDark">Employee created</p>
        <p className="text-xs text-textLight mt-1 max-w-[280px]">
          Copy these credentials and share them securely. The password is
          shown only once.
        </p>
      </div>

      <div className="bg-bg rounded-2xl p-4 space-y-3">
        <div>
          <p className="text-[10px] font-bold tracking-wider text-textLight uppercase mb-1">
            Email
          </p>
          <p className="text-sm font-semibold text-textDark break-all font-mono">
            {success.email}
          </p>
        </div>
        <div className="pt-3 border-t border-border/60">
          <p className="text-[10px] font-bold tracking-wider text-textLight uppercase mb-1">
            Temporary Password
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
//  Modern field
// ─────────────────────────────────────────────────────
function ModernField({ label, icon, required, children }) {
  return (
    <div className="group">
      <label className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-textLight uppercase mb-2">
        {icon && <span className="text-textLight">{icon}</span>}
        {label}
        {required && <span className="text-primary">*</span>}
      </label>
      <div className="flex items-center px-4 py-3 rounded-2xl border border-border bg-bg focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/60 transition-all">
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
//  Section label
// ─────────────────────────────────────────────────────
function SectionLabel({ children, className = '' }) {
  return (
    <p
      className={`text-[10px] font-bold tracking-[0.15em] text-textLight/70 uppercase flex items-center gap-2 ${className}`}
    >
      <span className="w-1 h-1 rounded-full bg-primary/60" />
      {children}
      <span className="flex-1 h-px bg-border/60" />
    </p>
  );
}