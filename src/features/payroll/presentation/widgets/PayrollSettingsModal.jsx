// admin-panel/src/features/payroll/presentation/widgets/PayrollSettingsModal.jsx
import { useEffect, useState } from 'react';
import { Save, AlertTriangle } from 'lucide-react';
import Modal from '../../../../shared/components/Modal';
import Button from '../../../../shared/components/Button';
import { payrollSettingsRepository } from '../../data/payrollSettingsRepository';
import { DEFAULT_PAYROLL_SETTINGS, mergePayrollSettings } from '../../domain/payrollRules';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const CONTRIBUTIONS = [
  { key: 'sss', label: 'SSS', hint: 'Monthly salary credit base' },
  { key: 'philhealth', label: 'PhilHealth', hint: 'Monthly premium base' },
  { key: 'pagibig', label: 'Pag-IBIG', hint: 'Monthly fund base' },
];

export default function PayrollSettingsModal({
  open,
  onClose,
  settings,
  onSaved,
  onToast,
  readOnly = false,
  available = true,
}) {
  const [draft, setDraft] = useState(clone(DEFAULT_PAYROLL_SETTINGS));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setDraft(clone(mergePayrollSettings(settings)));
      setError('');
      setSaving(false);
    }
  }, [open, settings]);

  function setContribution(key, field, value) {
    setDraft((d) => ({
      ...d,
      contributions: {
        ...d.contributions,
        [key]: { ...d.contributions[key], [field]: value },
      },
    }));
  }

  function setNumber(path, value) {
    const num = value === '' ? '' : Number(value);
    setDraft((d) => {
      const next = { ...d };
      if (path.includes('.')) {
        const [group, key] = path.split('.');
        next[group] = { ...next[group], [key]: num };
      } else {
        next[path] = num;
      }
      return next;
    });
  }

  async function handleSave() {
    if (readOnly) return;
    setSaving(true);
    setError('');
    try {
      const payload = clone(draft);
      payload.nightDiffRate = (Number(payload.nightDiffRate) || 0) / 100;
      payload.restDayPremium = (Number(payload.restDayPremium) || 0) / 100;
      for (const key of ['sss', 'philhealth', 'pagibig']) {
        const c = payload.contributions[key];
        c.rate = (Number(c.rate) || 0) / 100;
        c.employerRate = (Number(c.employerRate) || 0) / 100;
        c.minBase = Number(c.minBase) || 0;
        c.maxBase = c.maxBase === '' ? null : Number(c.maxBase) || 0;
      }
      await payrollSettingsRepository.saveSettings(payload);
      onToast?.('Payroll settings saved', 'success');
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Payroll settings"
      subtitle="Contribution rates, premiums, and 13th-month accrual"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5">
        {!available && (
          <div className="flex items-start gap-2 rounded-xl border border-yellow/40 bg-yellowLight/70 px-3 py-2.5">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-yellow" />
            <p className="text-xs text-textMedium">
              The payroll settings table is missing. Run{' '}
              <span className="font-mono font-semibold text-textDark">
                20261027120000_payroll_suite.sql
              </span>{' '}
              to save changes. Defaults are still applied on screen.
            </p>
          </div>
        )}

        {readOnly && (
          <div className="flex items-start gap-2 rounded-xl border border-blue/25 bg-blueLight/50 px-3 py-2.5">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-blue" />
            <p className="text-xs text-textMedium">
              Payroll settings are read-only for this period or your access
              level. Switch to an editable period or ask an admin to update
              them.
            </p>
          </div>
        )}

        <section>
          <h3 className="text-sm font-bold text-textDark">Government contributions</h3>
          <p className="mt-0.5 text-[11px] text-textLight">
            Bases are monthly amounts and are prorated to the selected cutoff.
            Set a rate to 0 or turn a contribution off to exclude it.
          </p>

          <div className="mt-3 space-y-3">
            {CONTRIBUTIONS.map((c) => {
              const cfg = draft.contributions[c.key] ?? {};
              return (
                <div
                  key={c.key}
                  className="rounded-2xl border border-border bg-bg/40 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-textDark">{c.label}</p>
                      <p className="text-[10px] text-textLight">{c.hint}</p>
                    </div>
                    <label className="flex items-center gap-2 text-[11px] font-semibold text-textMedium">
                      <input
                        type="checkbox"
                        checked={!!cfg.enabled}
                        onChange={(e) =>
                          setContribution(c.key, 'enabled', e.target.checked)
                        }
                        disabled={readOnly}
                        className="h-4 w-4 accent-primary"
                      />
                      Enabled
                    </label>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                    <NumberField
                      label="Employee %"
                      value={roundPct(cfg.rate)}
                      onChange={(v) => setContribution(c.key, 'rate', v)}
                      suffix="%"
                      disabled={readOnly}
                    />
                    <NumberField
                      label="Employer %"
                      value={roundPct(cfg.employerRate)}
                      onChange={(v) => setContribution(c.key, 'employerRate', v)}
                      suffix="%"
                      disabled={readOnly}
                    />
                    <NumberField
                      label="Min base"
                      value={cfg.minBase ?? 0}
                      onChange={(v) => setContribution(c.key, 'minBase', v)}
                      prefix="₱"
                      disabled={readOnly}
                    />
                    <NumberField
                      label="Max base"
                      value={cfg.maxBase ?? ''}
                      onChange={(v) => setContribution(c.key, 'maxBase', v)}
                      prefix="₱"
                      disabled={readOnly}
                    />
                  </div>
                </div>
              );
            })}

            <div className="rounded-2xl border border-border bg-bg/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-textDark">Withholding tax</p>
                  <p className="text-[10px] text-textLight">
                    BIR progressive brackets, prorated to the cutoff length.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-[11px] font-semibold text-textMedium">
                  <input
                    type="checkbox"
                    checked={!!draft.contributions.tax?.enabled}
                    onChange={(e) =>
                      setContribution('tax', 'enabled', e.target.checked)
                    }
                    disabled={readOnly}
                    className="h-4 w-4 accent-primary"
                  />
                  Enabled
                </label>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-bold text-textDark">Premiums</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <NumberField
              label="Night differential"
              value={roundPct(draft.nightDiffRate)}
              onChange={(v) => setNumber('nightDiffRate', v)}
              suffix="%"
              disabled={readOnly}
            />
            <NumberField
              label="Rest-day premium"
              value={roundPct(draft.restDayPremium)}
              onChange={(v) => setNumber('restDayPremium', v)}
              suffix="%"
              disabled={readOnly}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-textLight">
            Night differential applies to work between 22:00 and 06:00 Manila.
            Rest-day premium applies when an employee works on their configured
            rest day.
          </p>
        </section>

        <section>
          <h3 className="text-sm font-bold text-textDark">13th month</h3>
          <label className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-bg/40 px-3 py-2.5 text-xs font-semibold text-textDark">
            <input
              type="checkbox"
              checked={draft.thirteenthMonth !== false}
              onChange={(e) => setNumber('thirteenthMonth', e.target.checked)}
              disabled={readOnly}
              className="h-4 w-4 accent-primary"
            />
            Accrue 13th month pay (basic + holiday + paid leave ÷ 12)
          </label>
        </section>

        {error && (
          <div className="rounded-xl border border-red/25 bg-redLight/60 px-3 py-2.5 text-xs text-red">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Close
          </Button>
          <Button
            icon={Save}
            onClick={handleSave}
            disabled={saving || readOnly || !available}
          >
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function roundPct(value) {
  if (value === '' || value == null) return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return Math.round(n * 1000000) / 10000;
}

function NumberField({ label, value, onChange, prefix, suffix, disabled = false }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-textLight">
        {label}
      </span>
      <div className="flex items-center gap-1 rounded-lg border border-border bg-white px-2 py-1.5 focus-within:border-primary/50">
        {prefix && <span className="text-[11px] text-textLight">{prefix}</span>}
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full bg-transparent text-xs font-semibold text-textDark outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />
        {suffix && <span className="text-[11px] text-textLight">{suffix}</span>}
      </div>
    </label>
  );
}
