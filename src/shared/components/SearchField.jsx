import { Search, X } from 'lucide-react';

// Shared search box. Same height, radius, and focus treatment everywhere.
export default function SearchField({
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
  ariaLabel = 'Search',
}) {
  return (
    <div className={`field-shell ${className}`}>
      <Search size={15} className="shrink-0 text-textLight" />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="field-input"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bg text-textLight transition hover:bg-redLight hover:text-red"
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
}
