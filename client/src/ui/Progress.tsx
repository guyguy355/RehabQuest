export function ProgressBar({ value, max, label, tone = 'brand', size = 'md' }: { value: number; max: number; label: string; tone?: 'brand' | 'sun' | 'coral'; size?: 'sm' | 'md' | 'lg' }) {
  const percent = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  const fill = { brand: 'bg-brand-500', sun: 'bg-sun-400', coral: 'bg-coral-500' }[tone];
  const height = { sm: 'h-2.5', md: 'h-4', lg: 'h-5' }[size];

  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className={`relative w-full overflow-hidden rounded-full bg-ink-100 ${height}`}>
      <div className={`h-full rounded-full ${fill} transition-[width] duration-500 ease-out`} style={{ width: `${percent}%` }}>
        {size !== 'sm' && percent > 6 ? <span className="absolute left-2 right-2 top-[3px] h-[4px] rounded-full bg-white/35" aria-hidden="true" style={{ width: `calc(${percent}% - 1rem)` }} /> : null}
      </div>
    </div>
  );
}

export function ProgressRing({ value, max, size = 64, label }: { value: number; max: number; size?: number; label: string }) {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = max <= 0 ? 0 : Math.min(1, value / max);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="#E9EFEF" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#12A58B"
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - ratio)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset .6s ease-out' }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="tabular" fontFamily="Nunito, sans-serif" fontWeight="900" fontSize={size / 4} fill="#152A2C">
        {value}/{max}
      </text>
    </svg>
  );
}
