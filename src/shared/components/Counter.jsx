import { useEffect, useRef, useState } from 'react';

/**
 * Animated counter — counts from 0 to `value` over `duration` ms.
 * Falls back to a plain number for non-numeric values.
 */
export default function Counter({
  value,
  duration = 800,
  className = '',
  suffix = '',
}) {
  const numeric = typeof value === 'number' && Number.isFinite(value);
  const [display, setDisplay] = useState(numeric ? 0 : value);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!numeric) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const from = 0;
    const to = value;

    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, numeric]);

  return (
    <span className={className}>
      {display}
      {suffix}
    </span>
  );
}