// Pill-shaped segmented control for page-level tabs and view switches.
// `items` = [{ key, label, icon, count }]
export default function SegmentedTabs({
  items = [],
  value,
  onChange,
  className = '',
  full = false,
}) {
  return (
    <div
      className={`segmented hide-scrollbar max-w-full overflow-x-auto ${
        full ? 'flex w-full' : 'inline-flex shrink-0'
      } ${className}`}
      role="tablist"
    >
      {items.map((item) => {
        const active = item.key === value;
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={`segmented-item ${full ? 'flex-1' : ''} ${
              active ? 'segmented-item-active' : ''
            }`}
          >
            {Icon && <Icon size={13} />}
            {item.label}
            {item.count !== undefined && item.count !== null && (
              <span
                className={`min-w-[16px] rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                  active ? 'bg-white/25 text-white' : 'bg-bg text-textLight'
                }`}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
