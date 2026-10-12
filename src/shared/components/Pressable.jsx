import { useRef } from 'react';

/**
 * Wraps a component with both:
 *  - onClick (short tap/click)
 *  - onLongPress (500ms hold or right-click)
 */
export default function Pressable({ onTap, onLongPress, children, className = '' }) {
  const timerRef = useRef(null);
  const longFiredRef = useRef(false);

  function start() {
    longFiredRef.current = false;
    timerRef.current = setTimeout(() => {
      longFiredRef.current = true;
      onLongPress?.();
    }, 500);
  }

  function cancel() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handleClick(e) {
    cancel();
    if (longFiredRef.current) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    onTap?.(e);
  }

  function handleContextMenu(e) {
    e.preventDefault();
    cancel();
    onLongPress?.();
  }

  return (
    <div
      className={className}
      onMouseDown={start}
      onMouseUp={cancel}
      onMouseLeave={cancel}
      onTouchStart={start}
      onTouchEnd={cancel}
      onTouchCancel={cancel}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {children}
    </div>
  );
}
