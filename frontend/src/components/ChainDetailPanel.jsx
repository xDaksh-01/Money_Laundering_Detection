import React, { useCallback } from 'react';

/* ══════════════════════════════════════════════════════════════
   Pattern color map (mirrors App.jsx)
══════════════════════════════════════════════════════════════ */
const PATTERN_COLORS = {
    cycle: '#00E5FF',
    smurfing_fan_in: '#D000FF',
    smurfing_fan_out: '#FFB400',
    layered_shell: '#00FFB3',
    consolidation: '#FF4DC4',
    'smurfing_fan_in→cycle': '#FF6B35',
    'smurfing_fan_out→cycle': '#FF6B35',
    'layered_shell→cycle': '#FF6B35',
    'smurfing_fan_out→layered_shell': '#FF6B35',
    smurfing: '#FFB400',
    shell: '#00FFB3',
};
const patternColor = (t) => PATTERN_COLORS[t] ?? '#c77dff';

const ROLE_COLORS = { source: '#00FF00', layer: '#FFFF00', collector: '#FF2222' };

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
function fmt(n) {
    if (n == null || isNaN(n)) return '—';
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${Number(n).toFixed(2)}`;
}

function riskLabel(score) {
    if (score >= 90) return { label: 'CRITICAL', color: '#FF2222' };
    if (score >= 75) return { label: 'HIGH', color: '#FF6B35' };
    if (score >= 60) return { label: 'MEDIUM', color: '#FFB400' };
    return { label: 'LOW', color: '#00FF00' };
}

/* ══════════════════════════════════════════════════════════════
   JSON DOWNLOAD (exactly the spec format from the image)
══════════════════════════════════════════════════════════════ */
function buildDownloadPayload(ring, suspiciousAccounts, summary) {
    const memberSet = new Set(ring.member_accounts);

    // Build a lookup of flagged account details
    const flaggedMap = {};
    (suspiciousAccounts || [])
        .filter(a => memberSet.has(a.account_id))
        .forEach(a => { flaggedMap[a.account_id] = a; });

    // Every ring member gets a full entry — flagged or not
    const allMemberAccounts = ring.member_accounts.map(id => {
        const flagged = flaggedMap[id];
        if (flagged) {
            return {
                account_number: id,          // exact ID from input CSV
                suspicion_score: flagged.suspicion_score,
                detected_patterns: flagged.detected_patterns,
                role: flagged.role ?? 'layer',
                flagged: true,
                ring_id: ring.ring_id,
            };
        }
        return {
            account_number: id,              // exact ID from input CSV
            suspicion_score: null,
            detected_patterns: [],
            role: 'unknown',
            flagged: false,
            ring_id: ring.ring_id,
        };
    }).sort((a, b) => (b.suspicion_score ?? -1) - (a.suspicion_score ?? -1));

    return {
        ring_members: allMemberAccounts,
        fraud_ring: {
            ring_id: ring.ring_id,
            member_account_numbers: ring.member_accounts,   // exact IDs from input CSV
            pattern_type: ring.pattern_type,
            risk_score: ring.risk_score,
            total_amount: ring.total_amount ?? null,
            bridge_nodes: ring.bridge_nodes ?? [],
            overlap_with: ring.overlap_with ?? null,
        },
        summary: {
            total_accounts_analyzed: summary?.total_accounts_analyzed ?? 0,
            suspicious_accounts_flagged: Object.keys(flaggedMap).length,
            total_ring_members: ring.member_accounts.length,
            fraud_rings_detected: 1,
            processing_time_seconds: summary?.processing_time_seconds ?? 0,
        },
    };
}

function downloadJSON(ring, suspiciousAccounts, summary) {
    const payload = buildDownloadPayload(ring, suspiciousAccounts, summary);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ring.ring_id}_report.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function ChainDetailPanel({ ring, suspiciousAccounts, summary, onClose }) {
    if (!ring) return null;

    const color = patternColor(ring.pattern_type);
    const risk = riskLabel(ring.risk_score);
    const isHybrid = ring.pattern_type.includes('→');
    const memberSet = new Set(ring.member_accounts);

    // Get account details for ring members (sorted by suspicion score)
    const memberAccounts = (suspiciousAccounts || [])
        .filter(a => memberSet.has(a.account_id))
        .sort((a, b) => b.suspicion_score - a.suspicion_score);

    // Accounts in ring but not in suspicious_accounts (not flagged individually)
    const knownIds = new Set(memberAccounts.map(a => a.account_id));
    const unknownMembers = ring.member_accounts.filter(id => !knownIds.has(id));

    const handleDownload = useCallback(() => {
        downloadJSON(ring, suspiciousAccounts, summary);
    }, [ring, suspiciousAccounts, summary]);

    return (
        <div style={{
            width: 340, minWidth: 340, height: '100%',
            display: 'flex', flexDirection: 'column',
            background: 'rgba(6,6,14,0.98)',
            borderLeft: `1px solid ${color}40`,
            overflow: 'hidden',
            boxShadow: `-4px 0 30px ${color}15`,
            animation: 'slideInRight 0.22s ease-out',
        }}>
            {/* ── Header ── */}
            <div style={{
                padding: '14px 16px', flexShrink: 0,
                borderBottom: `1px solid ${color}30`,
                background: `${color}08`,
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                        {/* Pattern badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <span style={{
                                fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                                padding: '2px 7px', borderRadius: 4,
                                background: `${color}18`, border: `1px solid ${color}40`, color,
                            }}>
                                {isHybrid ? '⚡ ' : ''}{ring.pattern_type.toUpperCase()}
                            </span>
                            <span style={{
                                fontSize: 9, fontWeight: 700, padding: '2px 6px',
                                borderRadius: 4, background: `${risk.color}18`,
                                border: `1px solid ${risk.color}40`, color: risk.color,
                            }}>
                                {risk.label}
                            </span>
                        </div>
                        {/* Ring ID */}
                        <p style={{
                            fontFamily: 'monospace', fontSize: 14, fontWeight: 700,
                            color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                            {ring.ring_id}
                        </p>
                        {/* overlap_with reference */}
                        {ring.overlap_with && (
                            <p style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'monospace', marginTop: 2 }}>
                                bridges: {ring.overlap_with}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} style={{
                        width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                        background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                        color: 'var(--t2)', fontSize: 16, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>×</button>
                </div>
            </div>

            {/* ── Key Metrics ── */}
            <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                gap: 1, background: 'var(--border)', flexShrink: 0,
            }}>
                {[
                    { label: 'RISK SCORE', value: ring.risk_score?.toFixed(1), color: risk.color },
                    { label: 'MEMBERS', value: ring.member_accounts?.length ?? 0, color },
                    { label: 'TOTAL FLOW', value: fmt(ring.total_amount), color: '#00FFB3' },
                ].map(({ label, value, color: c }) => (
                    <div key={label} style={{ background: 'rgba(8,8,15,0.97)', padding: '12px 12px 10px' }}>
                        <p style={{ fontSize: 8, color: 'var(--t3)', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4 }}>
                            {label}
                        </p>
                        <p style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 800, color: c }}>
                            {value}
                        </p>
                    </div>
                ))}
            </div>

            {/* ── Bridge nodes (hybrid rings) ── */}
            {ring.bridge_nodes?.length > 0 && (
                <div style={{
                    margin: '10px 12px 0', padding: '8px 10px', borderRadius: 7, flexShrink: 0,
                    background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.35)',
                }}>
                    <p style={{ fontSize: 9, fontWeight: 700, color: '#FF6B35', letterSpacing: '0.08em', marginBottom: 5 }}>
                        ⚡ BRIDGE NODES (appear in both patterns)
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {ring.bridge_nodes.map(id => (
                            <span key={id} style={{
                                fontFamily: 'monospace', fontSize: 10, fontWeight: 700,
                                padding: '2px 7px', borderRadius: 4,
                                background: 'rgba(255,107,53,0.15)', border: '1px solid rgba(255,107,53,0.45)',
                                color: '#FF6B35',
                            }}>{id}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Member Accounts list ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
                <p style={{
                    fontSize: 9, fontWeight: 700, color: 'var(--t3)',
                    letterSpacing: '0.1em', marginBottom: 8,
                }}>
                    MEMBER ACCOUNTS ({ring.member_accounts?.length ?? 0})
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {/* Flagged accounts with full details */}
                    {memberAccounts.map((a, i) => {
                        const roleColor = ROLE_COLORS[a.role] ?? '#00E5FF';
                        const isBridge = ring.bridge_nodes?.includes(a.account_id);
                        return (
                            <div key={a.account_id} style={{
                                padding: '8px 10px', borderRadius: 7,
                                background: isBridge ? 'rgba(255,107,53,0.08)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${isBridge ? 'rgba(255,107,53,0.3)' : 'rgba(255,255,255,0.07)'}`,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--t1)' }}>
                                        {a.account_id}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{
                                            width: 7, height: 7, borderRadius: '50%',
                                            background: roleColor, boxShadow: `0 0 6px ${roleColor}`, flexShrink: 0,
                                        }} />
                                        <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 800, color: roleColor }}>
                                            {a.suspicion_score?.toFixed(1)}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                    {/* Role chip */}
                                    <span style={{
                                        fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                                        background: `${roleColor}15`, border: `1px solid ${roleColor}30`,
                                        color: roleColor, textTransform: 'uppercase',
                                    }}>
                                        {a.role || 'layer'}
                                    </span>
                                    {/* Pattern chips */}
                                    {(a.detected_patterns || []).slice(0, 3).map((p, pi) => (
                                        <span key={pi} style={{
                                            fontSize: 9, padding: '1px 5px', borderRadius: 3,
                                            background: 'rgba(255,255,255,0.06)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            color: 'var(--t3)',
                                        }}>
                                            {p}
                                        </span>
                                    ))}
                                    {isBridge && (
                                        <span style={{
                                            fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                                            background: 'rgba(255,107,53,0.15)', border: '1px solid rgba(255,107,53,0.4)',
                                            color: '#FF6B35',
                                        }}>
                                            ⚡ bridge
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* Accounts in ring but not individually flagged */}
                    {unknownMembers.map(id => (
                        <div key={id} style={{
                            padding: '6px 10px', borderRadius: 7,
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--t2)' }}>{id}</span>
                            <span style={{ fontSize: 10, color: 'var(--t3)' }}>not flagged</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Download Button ── */}
            <div style={{
                padding: '12px 12px', borderTop: '1px solid var(--border)', flexShrink: 0,
                background: 'rgba(8,8,15,0.95)',
            }}>
                <button
                    onClick={handleDownload}
                    style={{
                        width: '100%', padding: '10px 16px', borderRadius: 8,
                        background: `${color}18`, border: `1px solid ${color}45`,
                        color, fontWeight: 700, fontSize: 12,
                        cursor: 'pointer', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: 8,
                        transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = `${color}30`}
                    onMouseLeave={e => e.currentTarget.style.background = `${color}18`}
                >
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download {ring.ring_id}_report.json
                </button>
                <p style={{ fontSize: 10, color: 'var(--t3)', textAlign: 'center', marginTop: 6, fontFamily: 'monospace' }}>
                    RIFT 2026 forensic export format
                </p>
            </div>
        </div>
    );
}
