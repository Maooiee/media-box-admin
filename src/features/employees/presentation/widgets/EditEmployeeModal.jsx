import { useEffect, useState } from 'react';
import { X, Landmark, ShieldCheck, Building2 } from 'lucide-react';
import { employeesRepository } from '../../data/employeesRepository';

const REST_DAYS = [
  { value: '', label: 'No fixed rest day' },
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

const PAYROLL_ROLES = [
  { value: '', label: 'Inherit admin access' },
  { value: 'viewer', label: 'Viewer (read-only)' },
  { value: 'admin', label: 'Payroll admin' },
];

const INPUT =
  'w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-textDark focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30';

export default function EditEmployeeModal({
  open,
  employee,
  onClose,
  onSaved,
  onToast,
}) {
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [schedule, setSchedule] = useState('');
  const [dailyRate, setDailyRate] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [department, setDepartment] = useState('');
  const [restDay, setRestDay] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [sssNumber, setSssNumber] = useState('');
  const [philhealthNumber, setPhilhealthNumber] = useState('');
  const [pagibigNumber, setPagibigNumber] = useState('');
  const [tin, setTin] = useState('');
  const [payrollRole, setPayrollRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && employee) {
      setFullName(employee.fullName ?? '');
      setPosition(employee.position ?? '');
      setSchedule(employee.schedule ?? '');
      setDailyRate(employee.dailyRate != null ? String(employee.dailyRate) : '');
      setIsAdmin(employee.isAdmin ?? false);
      setIsActive(employee.isActive ?? true);
      setDepartment(employee.department ?? '');
      setRestDay(employee.restDay != null ? String(employee.restDay) : '');
      setBankName(employee.bankName ?? '');
      setBankAccountName(employee.bankAccountName ?? '');
      setBankAccountNumber(employee.bankAccountNumber ?? '');
      setSssNumber(employee.sssNumber ?? '');
      setPhilhealthNumber(employee.philhealthNumber ?? '');
      setPagibigNumber(employee.pagibigNumber ?? '');
      setTin(employee.tin ?? '');
      setPayrollRole(employee.payrollRole ?? '');
      setError('');
    }
  }, [open, employee]);

  function optional(value) {
    const trimmed = String(value ?? '').trim();
    return trimmed === '' ? null : trimmed;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const trimmedRate = dailyRate.trim();
      const rate = trimmedRate === '' ? null : Number(trimmedRate);
      if (trimmedRate !== '' && (Number.isNaN(rate) || rate < 0)) {
        throw new Error('Daily rate must be a valid amount');
      }
      const result = await employeesRepository.updateEmployee(employee.id, {
        fullName: fullName.trim(),
        position: position.trim(),
        schedule: schedule.trim(),
        dailyRate: rate,
        isAdmin,
        isActive,
        department: optional(department),
        restDay: restDay === '' ? null : Number(restDay),
        bankName: optional(bankName),
        bankAccountName: optional(bankAccountName),
        bankAccountNumber: optional(bankAccountNumber),
        sssNumber: optional(sssNumber),
        philhealthNumber: optional(philhealthNumber),
        pagibigNumber: optional(pagibigNumber),
        tin: optional(tin),
        payrollRole: optional(payrollRole),
      });

      onSaved?.();

      if (result?.skipped?.length) {
        onToast?.(
          `Employee saved, but these payroll fields are not in the database yet: ${result.skipped.join(
            ', '
          )}. Run the payroll suite migration to store them.`,
          'error'
        );
      }

      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/60 bg-white shadow-float"
      >
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h3 className="text-lg font-bold text-textDark">Edit Employee</h3>
            <p className="text-[11px] text-textLight">
              {employee?.employeeId}
              {employee?.fullName ? ` · ${employee.fullName}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-textLight transition hover:bg-bg hover:text-textDark"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="max-h-[72vh] space-y-4 overflow-y-auto p-5"
        >
          <Section icon={Building2} title="Profile">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Full Name">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={INPUT}
                />
              </Field>
              <Field label="Position">
                <input
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="Cashier"
                  className={INPUT}
                />
              </Field>
              <Field label="Department">
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Operations"
                  className={INPUT}
                />
              </Field>
              <Field label="Schedule">
                <input
                  type="text"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  placeholder="Mon-Fri 9AM-6PM"
                  className={INPUT}
                />
              </Field>
              <Field label="Daily Rate (₱)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={dailyRate}
                  onChange={(e) => setDailyRate(e.target.value)}
                  placeholder="Leave empty for no rate"
                  className={INPUT}
                />
              </Field>
              <Field label="Rest day">
                <select
                  value={restDay}
                  onChange={(e) => setRestDay(e.target.value)}
                  className={INPUT}
                >
                  {REST_DAYS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Section>

          <Section icon={ShieldCheck} title="Payroll access">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Payroll role">
                <select
                  value={payrollRole}
                  onChange={(e) => setPayrollRole(e.target.value)}
                  className={INPUT}
                >
                  {PAYROLL_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="space-y-2">
                <Toggle
                  checked={isAdmin}
                  onChange={setIsAdmin}
                  label="Admin access"
                />
                <Toggle
                  checked={isActive}
                  onChange={setIsActive}
                  label="Active employee"
                />
              </div>
            </div>
          </Section>

          <Section icon={Landmark} title="Bank & government IDs">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Bank name">
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="BDO / BPI / GCash"
                  className={INPUT}
                />
              </Field>
              <Field label="Account name">
                <input
                  type="text"
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  placeholder="As printed on the account"
                  className={INPUT}
                />
              </Field>
              <Field label="Account number">
                <input
                  type="text"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  placeholder="0000 0000 0000"
                  className={INPUT}
                />
              </Field>
              <Field label="TIN">
                <input
                  type="text"
                  value={tin}
                  onChange={(e) => setTin(e.target.value)}
                  placeholder="000-000-000-000"
                  className={INPUT}
                />
              </Field>
              <Field label="SSS number">
                <input
                  type="text"
                  value={sssNumber}
                  onChange={(e) => setSssNumber(e.target.value)}
                  className={INPUT}
                />
              </Field>
              <Field label="PhilHealth number">
                <input
                  type="text"
                  value={philhealthNumber}
                  onChange={(e) => setPhilhealthNumber(e.target.value)}
                  className={INPUT}
                />
              </Field>
              <Field label="Pag-IBIG number">
                <input
                  type="text"
                  value={pagibigNumber}
                  onChange={(e) => setPagibigNumber(e.target.value)}
                  className={INPUT}
                />
              </Field>
            </div>
          </Section>

          {error && (
            <div className="rounded-xl border border-red/20 bg-redLight/60 p-3 text-xs text-red">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-textMedium transition hover:bg-bg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary-dark disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <section>
      <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-textLight">
        <Icon size={12} className="text-primary" />
        {title}
      </h4>
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-textLight">
        {label}
      </span>
      {children}
    </label>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-primary"
      />
      <span className="text-sm font-semibold text-textDark">{label}</span>
    </label>
  );
}
