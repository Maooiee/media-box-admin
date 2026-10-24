import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

export default function DatePicker({ value, onChange, placeholder = "Select date", min, max }) {
  const [open, setOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const popupRef = useRef(null);

  useEffect(() => {
    if (value) {
      setCurrentMonth(new Date(value + 'T00:00:00'));
    } else {
      setCurrentMonth(new Date());
    }
  }, [value, open]);

  useEffect(() => {
    function onClick(e) {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target) &&
        popupRef.current && !popupRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // 🛠️ FIX: Calculate position relative to the VIEWPORT and flip if near the bottom
  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popupHeight = 340; // Approximate height of the calendar
      const spaceBelow = window.innerHeight - rect.bottom;

      // If there's not enough space below, open it upwards
      const openUp = spaceBelow < popupHeight && rect.top > popupHeight;
      
      setCoords({
        top: openUp ? (rect.top - popupHeight - 8) : (rect.bottom + 8),
        left: rect.left,
      });
    }
  }, [open]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const daysInMonth = getDaysInMonth(year, month);
  const startWeekday = getFirstDayOfMonth(year, month);
  const daysInPrev = getDaysInMonth(year, month - 1);

  const days = [];

  for (let i = startWeekday - 1; i >= 0; i--) {
    days.push({ day: daysInPrev - i, muted: true, date: new Date(year, month - 1, daysInPrev - i) });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ day: i, muted: false, date: new Date(year, month, i) });
  }
  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    days.push({ day: i, muted: true, date: new Date(year, month + 1, i) });
  }

  const selectDate = (dateObj, isMuted) => {
    if (isMuted) setCurrentMonth(dateObj);
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
    setOpen(false);
  };

  // A date is outside the allowed window if it falls before `min` or after `max`.
  // Both bounds are 'YYYY-MM-DD' strings, so plain string comparison works.
  const toStr = (dt) => {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const isOutOfRange = (dt) => {
    const s = toStr(dt);
    if (min && s < min) return true;
    if (max && s > max) return true;
    return false;
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setOpen(false);
  };

  const handleToday = (e) => {
    e.stopPropagation();
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
    setOpen(false);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const displayValue = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    : placeholder;

  return (
    <div className="relative w-full">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-between gap-2 px-3 py-1.5 md:py-2 rounded-xl border text-[11px] md:text-xs font-semibold transition w-full ${
          open
            ? 'bg-white border-primary ring-2 ring-primary/20'
            : value
            ? 'bg-primary-light/20 border-primary/30 text-primary'
            : 'bg-white border-border text-textMedium hover:border-primary/40 hover:bg-primary-light/10'
        }`}
      >
        <div className="flex items-center gap-2">
          <CalendarIcon size={14} className={value ? 'text-primary' : 'text-textLight'} />
          <span className="truncate">{displayValue}</span>
        </div>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div 
          ref={popupRef}
          style={{ top: coords.top, left: coords.left }}
          // 🛠️ FIX: Use fixed positioning so it's relative to the screen, not the scrolled page
          className="fixed z-[9999] bg-white rounded-2xl border border-border shadow-xl p-4 w-64 animate-[slideUp_200ms_ease-out]"
        >
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-bg text-textDark transition"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="font-bold text-sm text-textDark">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <button
              onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-bg text-textDark transition"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-bold text-textLight uppercase">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {days.map((d, i) => {
              const y = d.date.getFullYear();
              const m = String(d.date.getMonth() + 1).padStart(2, '0');
              const day = String(d.date.getDate()).padStart(2, '0');
              const dateStr = `${y}-${m}-${day}`;
              const isSelected = dateStr === value;
              const isToday = dateStr === todayStr;
              const disabled = isOutOfRange(d.date);

              return (
                <button
                  key={i}
                  onClick={() => !disabled && selectDate(d.date, d.muted)}
                  disabled={disabled}
                  className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center text-xs font-semibold transition
                    ${d.muted ? 'text-textFaint hover:bg-bg' : 'text-textDark hover:bg-bg'}
                    ${isSelected ? '!bg-primary !text-white shadow-sm shadow-primary/30' : ''}
                    ${isToday && !isSelected ? 'ring-1 ring-primary/40 text-primary' : ''}
                    ${disabled ? 'opacity-30 cursor-not-allowed hover:bg-transparent line-through' : ''}
                  `}
                >
                  {d.day}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/60">
            <button
              onClick={handleClear}
              className="text-[11px] font-bold text-textLight hover:text-red transition"
            >
              Clear
            </button>
            <button
              onClick={handleToday}
              className="text-[11px] font-bold text-primary hover:underline transition"
            >
              Today
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}