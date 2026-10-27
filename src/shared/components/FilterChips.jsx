// Filter pills with an optional count badge. Used for date ranges,
// status filters, and anything else that narrows a list.
export default function FilterChips({
  options = [],
  value,
  onChange,
  className = '',
}) {
  return (
    <div
      className={`hide-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 md:mx-0 md:gap-2 md:px-0 ${className}`}
      role="group"
    >
      {options.map((option) => {
        const active = option.key === value;
        const count = option.count;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            aria-pressed={active}
            className={`chip ${active ? 'chip-active' : ''}`}
          >
            {option.icon && <option.icon size={12} />}
            {option.label}
            {count !== undefined && count !== null && (
              <span
                className={`min-w-[16px] rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                  active ? 'bg-white/25 text-white' : 'bg-bg text-textLight'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
