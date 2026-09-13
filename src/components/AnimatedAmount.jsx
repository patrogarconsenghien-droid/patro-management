import { useEffect, useRef, useState } from 'react';
import { formatCurrency } from '../lib/format';

/**
 * Montant qui défile jusqu'à sa nouvelle valeur au lieu de sauter : on voit
 * la différence quand un total ou un solde change.
 */
export default function AnimatedAmount({ value, className, duration = 600 }) {
  const target = Number(value) || 0;
  const [shown, setShown] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    const start = current.current;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (start === target || reduced) {
      current.current = target;
      setShown(target);
      return undefined;
    }

    let frame;
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / duration);
      const eased = 1 - (1 - k) ** 3;
      const next = start + (target - start) * eased;
      current.current = next;
      setShown(next);
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return <span className={className}>{formatCurrency(shown)}</span>;
}
