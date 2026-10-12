import { useEffect, useRef, useState } from 'react';

/**
 * Scroll-triggered reveal — matches the mobile app's Reveal feel,
 * but only fires when the element enters the viewport.
 *
 * Props (same as before, plus scroll options):
 *   start   0.0–1.0   -  delay within a group (like Flutter's `start`)
 *   span    0.18      -  duration share of the timeline
 *   offsetY 16        -  starting offset in px
 *   totalMs 900       -  total timeline length
 *   threshold 0.15    -  how much of the element must be visible to trigger
 *   once    true      -  only animate once (don't reverse on scroll up)
 */
export default function Reveal({
  start = 0,
  span = 0.18,
  offsetY = 16,
  totalMs = 900,
  threshold = 0.12,
  once = true,
  className = '',
  children,
}) {
  const ref = useRef(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // If IntersectionObserver isn't available, just show it
    if (typeof IntersectionObserver === 'undefined') {
      setEntered(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setEntered(true);
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            setEntered(false);
          }
        }
      },
      {
        threshold,
        rootMargin: '0px 0px -40px 0px', // trigger slightly before fully visible
      }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [threshold, once]);

  // Delay within a group (matches Flutter's `start` prop)
  const delayMs = Math.round(start * totalMs);
  const durationMs = Math.max(400, Math.round(span * totalMs * 2.4));

  return (
    <div
      ref={ref}
      className={`transform transition-all ease-out ${className}`}
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? 'translateY(0)' : `translateY(${offsetY}px)`,
        transitionDelay: `${delayMs}ms`,
        transitionDuration: `${durationMs}ms`,
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {children}
    </div>
  );
}