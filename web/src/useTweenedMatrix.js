import { useEffect, useRef, useState } from "react";

/* Tween the matrix values when the selection changes, so numbers roll and
   colors step through the scale (split-flap style, as old HDO did with
   react-motion) instead of the table re-rendering cold. Cells without a
   counterpart in the previous selection snap directly to their value.
   Shared by the front-page matrix and the party-page ranking bars. */
export function useTweenedMatrix(matrix) {
  const [disp, setDisp] = useState(matrix);
  const prevRef = useRef(matrix);
  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = matrix;
    if (
      !matrix || !from || from === matrix ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisp(matrix);
      return;
    }
    const DUR = 650;
    const t0 = performance.now();
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    let raf;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / DUR);
      const k = ease(t);
      const next = new Map();
      for (const [key, to] of matrix) {
        const f = from.get(key);
        if (!f || !f.total || !to.total) {
          next.set(key, to);
          continue;
        }
        const fp = (100 * f.agree) / f.total;
        const tp = (100 * to.agree) / to.total;
        next.set(key, {
          agree: Math.round(f.agree + (to.agree - f.agree) * k),
          total: Math.round(f.total + (to.total - f.total) * k),
          pct: fp + (tp - fp) * k,
        });
      }
      setDisp(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [matrix]);
  return disp ?? matrix;
}
