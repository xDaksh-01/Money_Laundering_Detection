import React, { useState } from 'react';

function ScoreBadge({ score }) {
    let cls = 'badge badge-medium', label = 'MED';
    if (score >= 90) { cls = 'badge badge-critical'; label = 'CRIT'; }
    else if (score >= 75) { cls = 'badge badge-high'; label = 'HIGH'; }
    else if (score >= 60) { cls = 'badge badge-medium'; label = 'MED'; }
    else { cls = 'badge badge-low'; label = 'LOW'; }
    return (
        <span className={cls}>
            <span className="badge-dot" />
            {score.toFixed(1)} <span style={{ opacity: 0.7 }}>{label}</span>
        </span>
    );
}

function PatternChips({ patterns }) {
    if (!patterns?.length) return <span style={{ color: 'var(--t3)' }}>—</span>;

    // Flatten comma-separated backend strings into individual tokens
    const flat = patterns.flatMap(p => p.split(/,\s*/));

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {flat.map((p, i) => {
                const t = p.trim().toLowerCase();
                const isShell = t.includes('shell');
                const isPeel = t === 'peeling_chain' || t === 'smurfing';
                const isCycle = t === 'cycle' || t.startsWith('cycle') || t.startsWith('length_');
                const isHop = t.startsWith('hop_count_') || t.startsWith('hops_');
                const isConsol = t.includes('consolidation');

                const style = isShell ? {
                    background: 'rgba(208,0,255,0.14)', border: '1px solid rgba(208,0,255,0.4)', color: '#D000FF', fontWeight: 700,
                } : isPeel ? {
                    background: 'rgba(255,140,0,0.14)', border: '1px solid rgba(255,140,0,0.4)', color: '#FF8C00', fontWeight: 700,
                } : isCycle ? {
                    background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF', fontWeight: 700,
                } : isHop ? {
                    background: 'rgba(255,49,49,0.12)', border: '1px solid rgba(255,49,49,0.38)', color: '#FF3131', fontWeight: 700,
                } : isConsol ? {
                    background: 'rgba(255,0,0,0.12)', border: '1px solid rgba(255,0,0,0.4)', color: '#FF0000', fontWeight: 700,
                } : {};

                return <span key={i} className="chip" style={{ ...style, fontSize: '9.5px', padding: '3px 8px' }}>{p.trim()}</span>;
            })}
        </div>
    );
}

const COLS = [
    { key: 'account_id', label: 'Account ID' },
    { key: 'suspicion_score', label: 'Score' },
    { key: 'role', label: 'Role' },
    { key: 'ring_id', label: 'Ring ID' },
    { key: 'detected_patterns', label: 'Detected Patterns', noSort: true },
];

// Traffic light dot for the Role column
const ROLE_DOT = {
    source: { bg: '#00FF00', label: 'Source' },
    layer: { bg: '#FFFF00', label: 'Layer' },
    collector: { bg: '#FF0000', label: 'Collector' },
};

export default function FraudTable({ accounts, hopMap = {} }) {
    const [q, setQ] = useState('');
    const [sortKey, setSortKey] = useState('suspicion_score');
    const [dir, setDir] = useState('desc');

    if (!accounts?.length) return null;

    const filtered = accounts.filter(a =>
        [a.account_id, a.ring_id, ...(a.detected_patterns || [])].some(s =>
            s?.toLowerCase().includes(q.toLowerCase())
        )
    );
    const sorted = [...filtered].sort((a, b) => {
        let va = a[sortKey], vb = b[sortKey];
        if (typeof va === 'string') [va, vb] = [va.toLowerCase(), vb.toLowerCase()];
        return dir === 'asc' ? (va < vb ? -1 : 1) : (va > vb ? -1 : 1);
    });
    const toggle = (k) => { k === sortKey ? setDir(d => d === 'asc' ? 'desc' : 'asc') : (setSortKey(k), setDir('desc')); };

    return (
        <div style={{
            background: 'rgba(10,10,18,0.95)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderBottom: '1px solid var(--border)',
            }}>
                <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>Flagged Accounts</p>
                    <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>
                        {sorted.length} / {accounts.length} records
                    </p>
                </div>
                <div style={{ position: 'relative' }}>
                    <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                        width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth={2}>
                        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                    <input
                        value={q} onChange={e => setQ(e.target.value)}
                        placeholder="Search…"
                        style={{
                            paddingLeft: 30, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
                            background: 'var(--surface)', border: '1px solid var(--border)',
                            borderRadius: 7, color: 'var(--t1)', fontSize: 12, width: 180, outline: 'none',
                        }}
                    />
                </div>
            </div>
            {/* Table */}
            <div style={{ overflowY: 'auto', maxHeight: 340 }}>
                <table className="tbl">
                    <thead>
                        <tr>
                            {COLS.map(c => (
                                <th key={c.key} onClick={() => !c.noSort && toggle(c.key)}>
                                    {c.label}
                                    {!c.noSort && (
                                        <span style={{ marginLeft: 4, opacity: sortKey === c.key ? 0.8 : 0.3 }}>
                                            {sortKey === c.key && dir === 'asc' ? '↑' : '↓'}
                                        </span>
                                    )}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((a) => (
                            <tr key={a.account_id}>
                                <td>
                                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--cyan)' }}>
                                        {a.account_id}
                                    </span>
                                </td>
                                <td><ScoreBadge score={a.suspicion_score} /></td>
                                <td>
                                    {(() => {
                                        const r = ROLE_DOT[a.role] || ROLE_DOT.layer;
                                        return (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.bg, boxShadow: `0 0 6px ${r.bg}`, flexShrink: 0 }} />
                                                <span style={{ fontSize: 11, fontWeight: 600, color: r.bg }}>{r.label}</span>
                                            </span>
                                        );
                                    })()}
                                </td>
                                <td>
                                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--t2)' }}>
                                        {a.ring_id || '—'}
                                    </span>
                                </td>
                                <td>
                                    <PatternChips
                                        patterns={(() => {
                                            const base = a.detected_patterns || [];
                                            const hops = hopMap[a.account_id];
                                            if (!hops?.length) return base;
                                            const peel = hops.find(h => h.isPeel);
                                            if (!peel) return base;
                                            const augmented = [...base];
                                            const chainTag = peel.patternType === 'shell' ? 'shell_chain' : 'peeling_chain';
                                            if (!augmented.includes(chainTag)) augmented.push(chainTag);
                                            const hopTag = `hop_count_${peel.hopIndex + 1}`;
                                            if (!augmented.some(s => s.startsWith('hop_count_'))) augmented.push(hopTag);
                                            return augmented;
                                        })()}
                                    />
                                </td>
                            </tr>
                        ))}
                        {!sorted.length && (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--t3)', fontSize: 12 }}>
                                No matching records
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
