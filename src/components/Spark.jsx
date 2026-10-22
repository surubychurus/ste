const W = 400;
const H = 90;
const PAD = 6;

/** Línea de historial en SVG. `domain` fija el rango vertical. */
export default function Spark({ title, values, domain, accent = false, dashed = false }) {
  const [lo, hi] = domain;
  const pts = values
    .filter((v) => v != null)
    .map((v, i, arr) => {
      const x = arr.length === 1 ? W : (i / (arr.length - 1)) * W;
      const y = H - PAD - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (H - PAD * 2);
      return [x, y];
    });

  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = pts.length ? `${line} L${W} ${H} L${pts[0][0]} ${H} Z` : '';
  const end = pts[pts.length - 1];
  const stroke = accent ? 'var(--accent)' : 'var(--ink)';

  return (
    <figure className="spark">
      <figcaption>{title}</figcaption>
      <div className="spark__plot">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={title}>
        <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} stroke="var(--ink)" strokeOpacity="0.15" />
        {pts.length > 1 && (
          <>
            <path d={area} fill={stroke} fillOpacity="0.07" />
            <path d={line} fill="none" stroke={stroke} strokeWidth="1.6" strokeDasharray={dashed ? "5 4" : undefined} vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      {end && <span className="spark__dot" style={{ top: `${(end[1] / H) * 100}%`, background: stroke }} />}
      </div>
    </figure>
  );
}
