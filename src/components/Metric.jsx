import { useEffect, useRef } from 'react';
import gsap from 'gsap';

/** Panel de una magnitud: número animado, unidad, barra y descriptor. */
export default function Metric({ label, value, unit, decimals = 0, min, max, describe, align = 'left' }) {
  const num = useRef(null);
  const bar = useRef(null);
  const state = useRef({ v: null });

  useEffect(() => {
    if (value == null) return;
    const s = state.current;
    if (s.v == null) s.v = value;
    const tl = gsap.timeline();
    tl.to(s, {
      v: value,
      duration: 0.8,
      ease: 'power2.out',
      onUpdate: () => {
        if (num.current) num.current.textContent = s.v.toFixed(decimals);
      },
    });
    const pct = Math.min(1, Math.max(0, (value - min) / (max - min))) * 100;
    tl.to(bar.current, { width: `${pct}%`, duration: 0.9, ease: 'power3.out' }, 0);
    return () => tl.kill();
  }, [value, decimals, min, max]);

  return (
    <div className={`metric metric--${align}`}>
      <span className="metric__label">{label}</span>
      <div className="metric__value">
        <span ref={num} className="metric__num">--</span>
        <span className="metric__unit">{unit}</span>
      </div>
      <div className="metric__track">
        <div ref={bar} className="metric__bar" />
      </div>
      <span className="metric__hint">{value == null ? 'Sin datos' : describe(value)}</span>
    </div>
  );
}
