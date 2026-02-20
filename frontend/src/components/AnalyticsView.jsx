import React, { useMemo } from 'react';

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const PATTERN_COLORS = {
  cycle: '#00E5FF',
  smurfing_fan_in: '#D000FF',
  smurfing_fan_out: '#FFB400',
  layered_shell: '#00FFB3',
  consolidation: '#FF4DC4',
  funnel: '#A8FF3E',
  smurfing: '#FFB400',
  shell: '#00FFB3',
};
const patternColor = (t) => {
  if (t.includes('→')) return '#FF6B35';
  return PATTERN_COLORS[t] ?? '#c77dff';
};

function fmt(n) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Number(n).toFixed(2)}`;
}

function Card({ title, subtitle, children, style }) {
  return (
    <div style={{
      background: 'rgba(10,10,18,0.95)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column',
      gap: 14, ...style,
    }}>
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--t1)', letterSpacing: '0.04em' }}>{title}</p>
        {subtitle && <p style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PIE CHART (pure SVG)
══════════════════════════════════════════════════════════════ */
function PieChart({ slices, size = 140 }) {
  const r = size / 2 - 10;
  const cx = size / 2, cy = size / 2;
  let cumAngle = -Math.PI / 2;
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) return <p style={{ fontSize: 12, color: 'var(--t3)' }}>No data</p>;

  const paths = slices.map((s) => {
    const angle = (s.value / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(cumAngle);
    const y1 = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + r * Math.cos(cumAngle);
    const y2 = cy + r * Math.sin(cumAngle);
    const large = angle > Math.PI ? 1 : 0;
    return { path: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`, color: s.color };
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ flexShrink: 0 }}>
      {/* Subtle bg circle */}
      <circle cx={cx} cy={cy} r={r + 1} fill="rgba(255,255,255,0.03)" />
      {paths.map((p, i) => (
        <path key={i} d={p.path} fill={p.color} opacity={0.92}
          stroke="rgba(0,0,0,0.4)" strokeWidth={1.5} />
      ))}
      {/* Inner ring cutout */}
      <circle cx={cx} cy={cy} r={r * 0.42} fill="rgba(8,8,15,0.95)" />
    </svg>
  );
}

function PieLegend({ slices, total }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
      {slices.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'var(--t2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {s.label}
          </span>
          <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--t1)', flexShrink: 0 }}>
            {total > 0 ? ((s.value / total) * 100).toFixed(1) : 0}%
          </span>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   HORIZONTAL BAR CHART
══════════════════════════════════════════════════════════════ */
function HBarChart({ bars, maxVal, unitLabel = '' }) {
  if (!bars.length) return <p style={{ fontSize: 12, color: 'var(--t3)' }}>No data</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
      {bars.map((b, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 100, flexShrink: 0, fontSize: 10.5, fontFamily: 'monospace',
            color: 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            textAlign: 'right',
          }}>{b.label}</span>
          <div style={{ flex: 1, height: 16, background: 'rgba(255,255,255,0.04)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              width: `${maxVal > 0 ? (b.value / maxVal) * 100 : 0}%`,
              height: '100%', borderRadius: 4,
              background: b.color ?? 'var(--cyan)',
              transition: 'width 0.6s ease',
              boxShadow: `0 0 6px ${b.color ?? 'var(--cyan)'}60`,
            }} />
          </div>
          <span style={{ width: 64, flexShrink: 0, fontSize: 10.5, fontFamily: 'monospace', color: 'var(--t1)', fontWeight: 700 }}>
            {b.formatted ?? `${b.value}${unitLabel}`}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   VERTICAL BAR / HISTOGRAM
══════════════════════════════════════════════════════════════ */
function VBarChart({ bars, height = 110, unitLabel = '' }) {
  if (!bars.length) return <p style={{ fontSize: 12, color: 'var(--t3)' }}>No data</p>;
  const maxVal = Math.max(...bars.map(b => b.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height }}>
        {bars.map((b, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--t1)', fontWeight: 700 }}>
              {b.value > 0 ? b.value : ''}
            </span>
            <div style={{
              width: '100%', borderRadius: '3px 3px 0 0',
              height: `${(b.value / maxVal) * (height - 24)}px`,
              background: b.color ?? 'var(--cyan)',
              boxShadow: `0 0 8px ${b.color ?? 'var(--cyan)'}50`,
              transition: 'height 0.5s ease',
              minHeight: b.value > 0 ? 4 : 0,
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 5 }}>
        {bars.map((b, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: 'var(--t3)', fontFamily: 'monospace', lineHeight: 1.3 }}>
            {b.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   LINE / AREA CHART (pure SVG)
══════════════════════════════════════════════════════════════ */
function LineChart({ points, width = 400, height = 110, color = '#00E5FF', label = '' }) {
  if (!points.length) return <p style={{ fontSize: 12, color: 'var(--t3)' }}>No data</p>;
  const maxY = Math.max(...points.map(p => p.y), 1);
  const minY = 0;
  const pad = { t: 10, b: 24, l: 36, r: 10 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;

  function sx(i) { return pad.l + (i / (points.length - 1 || 1)) * w; }
  function sy(y) { return pad.t + h - ((y - minY) / (maxY - minY || 1)) * h; }

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(i)},${sy(p.y)}`).join(' ');
  const areaPath = `${linePath} L${sx(points.length - 1)},${pad.t + h} L${pad.l},${pad.t + h} Z`;

  // Y-axis tick labels (3 ticks)
  const yTicks = [0, Math.round(maxY / 2), maxY];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ height, display: 'block' }}>
      {/* Grid lines */}
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={pad.l} y1={sy(v)} x2={pad.l + w} y2={sy(v)}
            stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          <text x={pad.l - 4} y={sy(v) + 4} textAnchor="end"
            fill="rgba(255,255,255,0.3)" fontSize={8} fontFamily="monospace">
            {v}
          </text>
        </g>
      ))}
      {/* Area fill */}
      <path d={areaPath} fill={`${color}18`} />
      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth={2}
        strokeLinejoin="round" strokeLinecap="round" />
      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={sx(i)} cy={sy(p.y)} r={3}
          fill={color} stroke="rgba(8,8,15,0.9)" strokeWidth={1.5} />
      ))}
      {/* X-axis labels (max 8 shown) */}
      {points.filter((_, i) => points.length <= 8 || i % Math.ceil(points.length / 8) === 0).map((p, i, arr) => {
        const origIdx = points.indexOf(p);
        return (
          <text key={i} x={sx(origIdx)} y={height - 4} textAnchor="middle"
            fill="rgba(255,255,255,0.35)" fontSize={7.5} fontFamily="monospace">
            {p.label}
          </text>
        );
      })}
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   STAT PILL
══════════════════════════════════════════════════════════════ */
function StatPill({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 9, color: 'var(--t3)', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</p>
      <p style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 800, color: color ?? 'var(--t1)' }}>{value}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN ANALYTICS VIEW
══════════════════════════════════════════════════════════════ */
export default function AnalyticsView({ data }) {
  const rings = data?.fraud_rings ?? [];
  const accounts = data?.suspicious_accounts ?? [];
  const summary = data?.summary;

  /* ── Derived data ── */
  const derived = useMemo(() => {
    // 1. Pattern distribution (pie 1)
    const patternCount = {};
    rings.forEach(r => { patternCount[r.pattern_type] = (patternCount[r.pattern_type] || 0) + 1; });
    const patternSlices = Object.entries(patternCount)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ label: type, value: count, color: patternColor(type) }));

    // 2. Clean vs Suspicious accounts (pie 2)
    const totalAccounts = summary?.total_accounts_analyzed ?? 0;
    const suspCount = summary?.suspicious_accounts_flagged ?? 0;
    const cleanCount = Math.max(0, totalAccounts - suspCount);
    const accountSlices = [
      { label: 'Clean accounts', value: cleanCount, color: '#00E676' },
      { label: 'Suspicious / flagged', value: suspCount, color: '#FF4D6D' },
    ];

    // 3. Pattern volume (total_amount per pattern type) — pie 3 / bar
    const patternVolume = {};
    rings.forEach(r => {
      patternVolume[r.pattern_type] = (patternVolume[r.pattern_type] || 0) + (r.total_amount ?? 0);
    });
    const volumeSlices = Object.entries(patternVolume)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([type, vol]) => ({ label: type, value: vol, color: patternColor(type), formatted: fmt(vol) }));

    // 4. Top rings by risk score (h-bar)
    const topRings = [...rings].sort((a, b) => b.risk_score - a.risk_score).slice(0, 10);
    const riskBars = topRings.map(r => ({
      label: r.ring_id,
      value: r.risk_score,
      color: r.risk_score >= 90 ? '#FF2222' : r.risk_score >= 75 ? '#FF6B35' : r.risk_score >= 60 ? '#FFB400' : '#00E5FF',
      formatted: r.risk_score.toFixed(1),
    }));

    // 5. Suspicion score histogram
    const buckets = [
      { label: '0–50', range: [0, 50], color: '#00E676' },
      { label: '50–65', range: [50, 65], color: '#FFB400' },
      { label: '65–75', range: [65, 75], color: '#FF6B35' },
      { label: '75–90', range: [75, 90], color: '#FF4D6D' },
      { label: '90+', range: [90, 101], color: '#FF2222' },
    ];
    const histogram = buckets.map(b => ({
      label: b.label,
      value: accounts.filter(a => a.suspicion_score >= b.range[0] && a.suspicion_score < b.range[1]).length,
      color: b.color,
    }));

    // 6. Ring size line chart (sorted by ring size ascending)
    const ringsBySize = [...rings].sort((a, b) => (a.member_accounts?.length ?? 0) - (b.member_accounts?.length ?? 0));
    const sizePoints = ringsBySize.map((r, i) => ({
      y: r.member_accounts?.length ?? 0,
      label: r.ring_id.replace('RING_', ''),
    }));

    // 7. Bridge ring count vs clean rings
    const bridgeCount = rings.filter(r => r.bridge_nodes?.length > 0).length;
    const hybridCount = rings.filter(r => r.pattern_type.includes('→')).length;
    const cleanRingCount = rings.length - bridgeCount;

    // 8. Risk score over ring index (line chart — detect if risk escalates)
    const riskLine = rings.map((r, i) => ({
      y: r.risk_score,
      label: `R${i + 1}`,
    }));

    // 9. Total illicit volume vs ring count per pattern
    const totalVolume = rings.reduce((s, r) => s + (r.total_amount ?? 0), 0);

    return {
      patternSlices,
      accountSlices,
      volumeSlices,
      riskBars,
      histogram,
      sizePoints,
      riskLine,
      bridgeCount,
      hybridCount,
      totalVolume,
      patternCount,
    };
  }, [rings, accounts, summary]);

  /* ── No data state ── */
  if (!data) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 12, color: 'var(--t3)', fontSize: 13,
      }}>
        <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
        <p>Upload a CSV on the Dashboard to generate analytics</p>
      </div>
    );
  }

  const totalAccts = summary?.total_accounts_analyzed ?? 0;
  const suspAccts = summary?.suspicious_accounts_flagged ?? 0;
  const volTotal = derived.totalVolume;
  const maxRiskBar = derived.riskBars[0]?.value ?? 100;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Top KPI strip ── */}
      <div style={{
        display: 'flex', gap: 12,
        background: 'rgba(10,10,18,0.95)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '14px 22px',
      }}>
        <StatPill label="ACCOUNTS ANALYZED" value={totalAccts.toLocaleString()} color="var(--cyan)" />
        <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
        <StatPill label="SUSPICIOUS FLAGGED" value={suspAccts} color="var(--red)" />
        <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
        <StatPill label="FRAUD RINGS" value={rings.length} color="var(--amber)" />
        <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
        <StatPill label="BRIDGE RINGS" value={derived.bridgeCount} color="#FF6B35" />
        <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
        <StatPill label="HYBRID PATTERNS" value={derived.hybridCount} color="#c77dff" />
        <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
        <StatPill label="ILLICIT VOLUME" value={fmt(volTotal)} color="var(--red)" />
        <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
        <StatPill
          label="SUSPICION RATE"
          value={totalAccts > 0 ? `${((suspAccts / totalAccts) * 100).toFixed(1)}%` : '—'}
          color={suspAccts / totalAccts > 0.3 ? 'var(--red)' : 'var(--amber)'}
        />
      </div>

      {/* ── Row 1: two pie charts ── */}
      <div style={{ display: 'flex', gap: 16 }}>

        {/* PIE 1 — Pattern distribution */}
        <Card title="Fraud Pattern Distribution" subtitle="% of detected rings per pattern type" style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <PieChart slices={derived.patternSlices} size={150} />
            <PieLegend slices={derived.patternSlices} total={rings.length} />
          </div>
        </Card>

        {/* PIE 2 — Clean vs suspicious accounts */}
        <Card title="Account Risk Split" subtitle="Clean vs suspicious accounts in dataset" style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <PieChart slices={derived.accountSlices} size={150} />
            <PieLegend slices={derived.accountSlices} total={totalAccts} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <div style={{
              flex: 1, padding: '8px 10px', borderRadius: 8,
              background: 'rgba(0,230,118,0.07)', border: '1px solid rgba(0,230,118,0.2)',
            }}>
              <p style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 3 }}>CLEAN</p>
              <p style={{ fontSize: 17, fontWeight: 800, fontFamily: 'monospace', color: 'var(--green)' }}>
                {Math.max(0, totalAccts - suspAccts).toLocaleString()}
              </p>
            </div>
            <div style={{
              flex: 1, padding: '8px 10px', borderRadius: 8,
              background: 'rgba(255,77,109,0.07)', border: '1px solid rgba(255,77,109,0.2)',
            }}>
              <p style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 3 }}>SUSPICIOUS</p>
              <p style={{ fontSize: 17, fontWeight: 800, fontFamily: 'monospace', color: 'var(--red)' }}>
                {suspAccts.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        {/* PIE 3 — Illicit volume by pattern (only if total_amount data exists) */}
        {derived.volumeSlices.length > 0 && (
          <Card title="Illicit Volume by Pattern" subtitle="Total transaction value per pattern type" style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <PieChart slices={derived.volumeSlices} size={150} />
              <PieLegend slices={derived.volumeSlices} total={derived.volumeSlices.reduce((s, x) => s + x.value, 0)} />
            </div>
          </Card>
        )}
      </div>

      {/* ── Row 2: risk score bars + histogram ── */}
      <div style={{ display: 'flex', gap: 16 }}>

        {/* H-BAR — Top rings by risk score */}
        <Card title="Top Rings by Risk Score" subtitle="Highest-risk detected laundering chains" style={{ flex: 2 }}>
          {derived.riskBars.length > 0 ? (
            <HBarChart bars={derived.riskBars} maxVal={100} unitLabel="" />
          ) : (
            <p style={{ fontSize: 12, color: 'var(--t3)' }}>No rings detected yet</p>
          )}
        </Card>

        {/* V-BAR — Suspicion score histogram */}
        <Card title="Suspicion Score Distribution" subtitle="How many accounts fall in each risk bucket" style={{ flex: 1 }}>
          <VBarChart bars={derived.histogram} height={120} />
          <p style={{ fontSize: 10, color: 'var(--t3)', textAlign: 'center', fontFamily: 'monospace' }}>
            Score bands: Low → Medium → High → Critical
          </p>
        </Card>
      </div>

      {/* ── Row 3: ring size line + risk timeline ── */}
      <div style={{ display: 'flex', gap: 16 }}>

        {/* LINE — Ring size progression */}
        <Card title="Ring Size Curve" subtitle="Number of member accounts per ring (sorted ascending)" style={{ flex: 1 }}>
          {derived.sizePoints.length >= 2 ? (
            <LineChart points={derived.sizePoints} width={500} height={130} color="#00E5FF" />
          ) : derived.sizePoints.length === 1 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
              <span style={{ fontSize: 10, color: 'var(--t3)' }}>Single ring detected:</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--cyan)', fontSize: 14 }}>
                {derived.sizePoints[0].y} members
              </span>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--t3)' }}>No data</p>
          )}
          {derived.sizePoints.length >= 2 && (
            <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--t3)' }}>
                Smallest: <span style={{ color: 'var(--cyan)', fontWeight: 700, fontFamily: 'monospace' }}>
                  {Math.min(...derived.sizePoints.map(p => p.y))} nodes
                </span>
              </span>
              <span style={{ fontSize: 10, color: 'var(--t3)' }}>
                Largest: <span style={{ color: 'var(--amber)', fontWeight: 700, fontFamily: 'monospace' }}>
                  {Math.max(...derived.sizePoints.map(p => p.y))} nodes
                </span>
              </span>
              <span style={{ fontSize: 10, color: 'var(--t3)' }}>
                Avg: <span style={{ color: 'var(--t1)', fontWeight: 700, fontFamily: 'monospace' }}>
                  {(derived.sizePoints.reduce((s, p) => s + p.y, 0) / (derived.sizePoints.length || 1)).toFixed(1)} nodes
                </span>
              </span>
            </div>
          )}
        </Card>

        {/* LINE — Risk score across rings */}
        <Card title="Risk Score Timeline" subtitle="Risk score per detected ring (in detection order)" style={{ flex: 1 }}>
          {derived.riskLine.length >= 2 ? (
            <LineChart points={derived.riskLine} width={500} height={130} color="#FF4D6D" />
          ) : derived.riskLine.length === 1 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
              <span style={{ fontSize: 10, color: 'var(--t3)' }}>Single ring, risk:</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#FF4D6D', fontSize: 14 }}>
                {derived.riskLine[0].y.toFixed(1)}
              </span>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--t3)' }}>No data</p>
          )}
          {derived.riskLine.length >= 2 && (
            <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--t3)' }}>
                Min: <span style={{ color: 'var(--green)', fontWeight: 700, fontFamily: 'monospace' }}>
                  {Math.min(...derived.riskLine.map(p => p.y)).toFixed(1)}
                </span>
              </span>
              <span style={{ fontSize: 10, color: 'var(--t3)' }}>
                Max: <span style={{ color: 'var(--red)', fontWeight: 700, fontFamily: 'monospace' }}>
                  {Math.max(...derived.riskLine.map(p => p.y)).toFixed(1)}
                </span>
              </span>
              <span style={{ fontSize: 10, color: 'var(--t3)' }}>
                Avg: <span style={{ color: 'var(--amber)', fontWeight: 700, fontFamily: 'monospace' }}>
                  {(derived.riskLine.reduce((s, p) => s + p.y, 0) / (derived.riskLine.length || 1)).toFixed(1)}
                </span>
              </span>
            </div>
          )}
        </Card>
      </div>

      {/* ── Row 4: pattern volume bars + role breakdown ── */}
      <div style={{ display: 'flex', gap: 16 }}>

        {/* H-BAR — Pattern by transaction volume */}
        {derived.volumeSlices.length > 0 && (
          <Card title="Transaction Volume per Pattern" subtitle="Cumulative value of transactions in each pattern type" style={{ flex: 2 }}>
            <HBarChart
              bars={derived.volumeSlices}
              maxVal={derived.volumeSlices[0]?.value ?? 1}
            />
          </Card>
        )}

        {/* Role breakdown */}
        <Card title="Account Role Breakdown" subtitle="Source → Layer → Collector role distribution" style={{ flex: 1 }}>
          {(() => {
            const roleCounts = { source: 0, layer: 0, collector: 0, unknown: 0 };
            accounts.forEach(a => {
              const r = a.role ?? 'unknown';
              roleCounts[r] = (roleCounts[r] || 0) + 1;
            });
            const roleColors = { source: '#00FF00', layer: '#00E5FF', collector: '#FF2222', unknown: 'rgba(255,255,255,0.3)' };
            const roleSlices = Object.entries(roleCounts).filter(([, v]) => v > 0).map(([role, count]) => ({
              label: role.charAt(0).toUpperCase() + role.slice(1),
              value: count,
              color: roleColors[role],
            }));
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <PieChart slices={roleSlices} size={130} />
                <PieLegend slices={roleSlices} total={accounts.length} />
              </div>
            );
          })()}
        </Card>
      </div>

    </div>
  );
}
