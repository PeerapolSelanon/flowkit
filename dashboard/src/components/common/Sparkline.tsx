/** Tiny area sparkline. `values` are equally spaced samples; colour comes from `currentColor`. */
export default function Sparkline({ values, className = '' }: { values: number[]; className?: string }) {
  const w = 84, h = 30, pad = 2
  const max = Math.max(1, ...values)
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0
  const pts = values.map((v, i) => [pad + i * step, h - pad - (v / max) * (h - pad * 2)] as const)
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${(pad + (values.length - 1) * step).toFixed(1)},${h - pad} L${pad},${h - pad} Z`
  return (
    <svg className={`fk-spark ${className}`} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path className="area" d={area} />
      <path d={line} stroke="currentColor" />
    </svg>
  )
}
