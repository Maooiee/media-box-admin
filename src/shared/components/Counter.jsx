import { useEffect, useRef, useState } from 'react';

/**
 * Animated counter — eases from the previous value to `value`.
 * Falls back to plain text for non-numeric values.
 */
export default function Counter({ value, duration = 700, className = '', suffix = '' }) {
  const numeric = typeof value === 'number' && Number.isFinite(value);
  const [display, setDisplay] = useState(numeric ? 0 : value);
  const displayRef = useRef(numeric ? 0 : value);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!numeric) {
      displayRef.current = value;
      setDisplay(value);
      return undefined;
    }

    const from = Number.isFinite(displayRef.current) ? displayRef.current : 0;
    const to = value;
    if (from === to) {
      setDisplay(to);
      return undefined;
    }

    const start = performance.now();

    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * eased;
      displayRef.current = next;
      setDisplay(Math.round(next));
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
