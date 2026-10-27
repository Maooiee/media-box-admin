// Shared KPI tile. Keeps numbers visually consistent on every page:
// a tinted icon chip, a quiet uppercase label, and a strong value.
import { isValidElement } from 'react';
import Counter from './Counter';

const TONES = {
  brand: { value: 'text-textDark', icon: 'bg-primary-light text-primary' },
  good: { value: 'text-green', icon: 'bg-greenLight text-green' },
  warn: { value: 'text-yellow', icon: 'bg-yellowLight text-yellow' },
  bad: { value: 'text-red', icon: 'bg-redLight text-red' },
  info: { value: 'text-blue', icon: 'bg-blueLight text-blue' },
  muted: { value: 'text-textMedium', icon: 'bg-bg text-textLight' },
};

export default function StatTile({
  label,
  value,
  tone = 'brand',
  icon: Icon,
  hint,
  className = '',
  valueClassName = '',
}) {
  const toneStyles = TONES[tone] ?? TONES.brand;
  const renderIcon = () => {
    if (!Icon) return null;

    // Callers pass either a ready-made element (`<Camera size={13} />`) or the
    // component itself (`icon={Camera}`). Lucide icons are forwardRef objects,
    // so `typeof Icon === 'function'` is not enough — returning the raw
    // component object as a child is what caused
    // "Objects are not valid as a React child (found: object with keys
    // {$$typeof, render})".
    if (isValidElement(Icon)) return Icon;

    if (typeof Icon === 'function' || typeof Icon === 'object') {
      const IconComp = Icon;
      return (
        <>
          <IconComp size={13} className="md:hidden" />
          <IconComp size={15} className="hidden md:block" />
        </>
      );
    }

    return null;
  };

  return (
    <div
      className={`group flex items-center gap-2.5 rounded-xl border border-border bg-white p-2.5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-card-hover md:rounded-2xl md:px-3.5 md:py-3 ${className}`}
    >
      {Icon && (
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105 md:h-9 md:w-9 ${toneStyles.icon}`}
        >
          {renderIcon()}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase leading-tight tracking-wider text-textLight md:text-[10px]">
          {label}
        </p>
        <p
          className={`whitespace-nowrap text-base font-bold leading-tight tabular-nums md:text-xl ${toneStyles.value} ${valueClassName}`}
        >
          {typeof value === 'number' ? <Counter value={value} /> : value}
        </p>
        {hint && (
          <p className="truncate text-[10px] text-textFaint">{hint}</p>
        )}
      </div>
    </div>
  );
}
